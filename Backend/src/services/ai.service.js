const Groq = require("groq-sdk")
const { z } = require("zod")
const PDFDocument = require("pdfkit")

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



function buildResumePdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: "A4", margin: 50 })
            const chunks = []

            doc.on("data", (chunk) => chunks.push(chunk))
            doc.on("end", () => resolve(Buffer.concat(chunks)))
            doc.on("error", reject)

            const BLUE = { r: 74 / 255, g: 144 / 255, b: 226 / 255 }
            const GRAY = { r: 0.33, g: 0.33, b: 0.33 }
            const LIGHT = { r: 0.87, g: 0.87, b: 0.87 }

            const sectionHeader = (title) => {
                doc.moveDown(0.6)
                doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(13).text(title)
                const y = doc.y + 2
                doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y)
                doc.strokeColor(LIGHT).lineWidth(1).stroke()
                doc.y = y + 6
                doc.moveDown(0.3)
            }

            const bulletList = (items) => {
                doc.font("Helvetica").fontSize(10).fillColor({ r: 0.2, g: 0.2, b: 0.2 })
                items.filter(Boolean).forEach((item) => {
                    doc.text(`• ${item}`, { indent: 10 })
                })
            }

            // Header
            doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(26).text(data.name)
            const contact = [data.email, data.phone, data.location, ...data.links]
                .filter(Boolean)
                .join("  |  ")
            if (contact) {
                doc.moveDown(0.2)
                doc.fillColor(GRAY).font("Helvetica").fontSize(10).text(contact)
            }
            const headerLineY = doc.y + 6
            doc.moveTo(doc.page.margins.left, headerLineY).lineTo(doc.page.width - doc.page.margins.right, headerLineY)
            doc.strokeColor(BLUE).lineWidth(2).stroke()
            doc.y = headerLineY + 10

            if (data.summary) {
                sectionHeader("Summary")
                doc.font("Helvetica").fontSize(10).fillColor({ r: 0.2, g: 0.2, b: 0.2 }).text(data.summary)
            }

            if (data.skills.length) {
                sectionHeader("Skills")
                doc.font("Helvetica").fontSize(10).fillColor({ r: 0.2, g: 0.2, b: 0.2 })
                doc.text(data.skills.join("  •  "))
            }

            if (data.experience.length) {
                sectionHeader("Experience")
                data.experience.forEach((exp) => {
                    doc.font("Helvetica-Bold").fontSize(11).fillColor({ r: 0.1, g: 0.1, b: 0.1 })
                        .text(`${exp.title} \u2014 ${exp.company}`)
                    const subtitle = [exp.location, dateRange(exp.startDate, exp.endDate)].filter(Boolean).join(" | ")
                    if (subtitle) {
                        doc.font("Helvetica-Oblique").fontSize(9).fillColor(GRAY).text(subtitle)
                    }
                    doc.moveDown(0.1)
                    bulletList(exp.bullets)
                    doc.moveDown(0.3)
                })
            }

            if (data.projects.length) {
                sectionHeader("Projects")
                data.projects.forEach((project) => {
                    doc.font("Helvetica-Bold").fontSize(11).fillColor({ r: 0.1, g: 0.1, b: 0.1 })
                        .text(project.name)
                    if (project.description) {
                        doc.font("Helvetica-Oblique").fontSize(9).fillColor(GRAY).text(project.description)
                    }
                    doc.moveDown(0.1)
                    bulletList(project.bullets)
                    doc.moveDown(0.3)
                })
            }

            if (data.education.length) {
                sectionHeader("Education")
                data.education.forEach((edu) => {
                    doc.font("Helvetica-Bold").fontSize(11).fillColor({ r: 0.1, g: 0.1, b: 0.1 })
                        .text(`${edu.degree} \u2014 ${edu.institution}`)
                    const subtitle = [edu.location, dateRange(edu.startDate, edu.endDate)].filter(Boolean).join(" | ")
                    if (subtitle) {
                        doc.font("Helvetica-Oblique").fontSize(9).fillColor(GRAY).text(subtitle)
                    }
                    doc.moveDown(0.3)
                })
            }

            if (data.certifications.length) {
                sectionHeader("Certifications")
                bulletList(data.certifications)
            }

            doc.end()
        } catch (error) {
            reject(error)
        }
    })
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

function dateRange(startDate, endDate) {
    return [startDate, endDate].filter(Boolean).join(" \u2013 ")
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

    return buildResumePdf(data)
}

module.exports = { generateInterviewReport, generateResumePdf, buildResumePdf, toStrictJsonSchema }
