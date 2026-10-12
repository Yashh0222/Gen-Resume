const Groq = require("groq-sdk")
const { z } = require("zod")
const puppeteer = require("puppeteer")

let groqClient = null

function getGroq() {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing or empty")
    }
    if (!groqClient) {
        groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY })
    }
    return groqClient
}

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b"

function toStrictJsonSchema(schema) {
    const jsonSchema = z.toJSONSchema(schema)
    delete jsonSchema.$schema

    const strictify = (node) => {
        if (!node || typeof node !== "object") return
        if (node.type === "object" && node.properties) {
            node.additionalProperties = false
            node.required = Object.keys(node.properties)
            Object.values(node.properties).forEach(strictify)
        }
        if (node.type === "array") strictify(node.items)
    }

    strictify(jsonSchema)
    return jsonSchema
}

async function generateStructuredContent({ name, schema, prompt }) {
    const response = await getGroq().chat.completions.create({
        model: GROQ_MODEL,
        messages: [
            { role: "user", content: prompt }
        ],
        response_format: {
            type: "json_schema",
            json_schema: {
                name,
                strict: true,
                schema: toStrictJsonSchema(schema)
            }
        }
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error("Groq returned an empty response")

    return schema.parse(JSON.parse(content))
}


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`

    return generateStructuredContent({
        name: "interview_report",
        schema: interviewReportSchema,
        prompt
    })
}



async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]
    })

    try {
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })

        const pdfData = await page.pdf({
            format: "A4", margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        })

        // Puppeteer v23+ returns a Uint8Array; Express would JSON-serialize it
        // and produce a corrupt, unopenable PDF. Always return a Buffer.
        return Buffer.from(pdfData)
    } finally {
        await browser.close()
    }
}

// The model only produces plain resume CONTENT. The HTML/CSS is built here in
// code so a full HTML document (with braces and quotes) is never forced through
// Groq's strict JSON schema, which was failing with `json_validate_failed`.
const resumeContentSchema = z.object({
    name: z.string().describe("Candidate's full name"),
    email: z.string().describe("Email address, or an empty string if unknown"),
    phone: z.string().describe("Phone number, or an empty string if unknown"),
    location: z.string().describe("City and country, or an empty string if unknown"),
    links: z.array(z.string()).describe("LinkedIn, GitHub or portfolio URLs, or an empty array"),
    summary: z.string().describe("A 2-3 sentence professional summary tailored to the job description"),
    skills: z.array(z.string()).describe("Relevant technical and soft skills tailored to the job description"),
    experience: z.array(z.object({
        title: z.string().describe("Job title"),
        company: z.string().describe("Company name"),
        location: z.string().describe("Job location, or empty string"),
        startDate: z.string().describe("Start date, e.g. 'Jan 2023'"),
        endDate: z.string().describe("End date, e.g. 'Present'"),
        bullets: z.array(z.string()).describe("Achievement-oriented bullet points, each starting with an action verb and quantifying impact where possible")
    })).describe("Work experience, most recent first"),
    projects: z.array(z.object({
        name: z.string().describe("Project name"),
        description: z.string().describe("One-line project description"),
        bullets: z.array(z.string()).describe("Achievement-oriented bullet points")
    })).describe("Relevant projects"),
    education: z.array(z.object({
        degree: z.string().describe("Degree or qualification"),
        institution: z.string().describe("Institution name"),
        location: z.string().describe("Location, or empty string"),
        startDate: z.string().describe("Start date"),
        endDate: z.string().describe("End date")
    })).describe("Education history"),
    certifications: z.array(z.string()).describe("Certifications, or an empty array")
})

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
}

function dateRange(startDate, endDate) {
    return [startDate, endDate].filter(Boolean).join(" \u2013 ")
}

function buildResumeHtml(data) {
    const contact = [data.email, data.phone, data.location, ...data.links]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" &nbsp;|&nbsp; ")

    const bullets = (items) => items.filter(Boolean).map((b) => `<li>${escapeHtml(b)}</li>`).join("")

    const summary = data.summary
        ? `<section class="section"><h2>Summary</h2><p>${escapeHtml(data.summary)}</p></section>`
        : ""

    const skills = data.skills.length
        ? `<section class="section"><h2>Skills</h2><ul class="skills">${data.skills.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></section>`
        : ""

    const experience = data.experience.length
        ? `<section class="section"><h2>Experience</h2>${data.experience.map((exp) => `
            <div class="item">
                <div class="item-title">${escapeHtml(exp.title)} \u2014 ${escapeHtml(exp.company)}</div>
                <div class="item-subtitle">${escapeHtml([exp.location, dateRange(exp.startDate, exp.endDate)].filter(Boolean).join(" | "))}</div>
                <ul>${bullets(exp.bullets)}</ul>
            </div>`).join("")}</section>`
        : ""

    const projects = data.projects.length
        ? `<section class="section"><h2>Projects</h2>${data.projects.map((project) => `
            <div class="item">
                <div class="item-title">${escapeHtml(project.name)}</div>
                <div class="item-subtitle">${escapeHtml(project.description)}</div>
                <ul>${bullets(project.bullets)}</ul>
            </div>`).join("")}</section>`
        : ""

    const education = data.education.length
        ? `<section class="section"><h2>Education</h2>${data.education.map((edu) => `
            <div class="item">
                <div class="item-title">${escapeHtml(edu.degree)} \u2014 ${escapeHtml(edu.institution)}</div>
                <div class="item-subtitle">${escapeHtml([edu.location, dateRange(edu.startDate, edu.endDate)].filter(Boolean).join(" | "))}</div>
            </div>`).join("")}</section>`
        : ""

    const certifications = data.certifications.length
        ? `<section class="section"><h2>Certifications</h2><ul>${bullets(data.certifications)}</ul></section>`
        : ""

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(data.name)} - Resume</title>
<style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.4; }
    .header { border-bottom: 2px solid #4A90E2; padding-bottom: 10px; margin-bottom: 20px; }
    .name { font-size: 28px; font-weight: bold; color: #4A90E2; }
    .contact { font-size: 13px; margin-top: 5px; color: #555; }
    .section { margin-bottom: 15px; }
    .section h2 { font-size: 17px; color: #4A90E2; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 8px; }
    .section p { margin: 0; }
    .item { margin-bottom: 10px; }
    .item-title { font-weight: bold; }
    .item-subtitle { font-style: italic; font-size: 13px; color: #555; margin-bottom: 3px; }
    ul { margin: 4px 0 0 18px; padding: 0; }
    li { margin-bottom: 3px; }
    .skills { list-style: none; margin-left: 0; column-count: 2; }
</style>
</head>
<body>
    <div class="header">
        <div class="name">${escapeHtml(data.name)}</div>
        <div class="contact">${contact}</div>
    </div>
    ${summary}
    ${skills}
    ${experience}
    ${projects}
    ${education}
    ${certifications}
</body>
</html>`
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const prompt = `You are writing resume content for a candidate, tailored to a specific job.

Resume:
${resume}

Self description:
${selfDescription}

Target job description:
${jobDescription}

Produce concise, ATS-friendly resume content tailored to the job description. Highlight the candidate's strengths and relevant experience. Do not invent employers, dates, degrees or skills that are not supported by the resume or self description. Use plain text only in every field - no markdown and no HTML tags. Each experience/project bullet must be achievement-oriented and start with an action verb. Keep the overall content short enough to fit on 1-2 pages.`

    const data = await generateStructuredContent({
        name: "resume_content",
        schema: resumeContentSchema,
        prompt
    })

    const html = buildResumeHtml(data)

    return generatePdfFromHtml(html)
}

module.exports = { generateInterviewReport, generateResumePdf, toStrictJsonSchema }
