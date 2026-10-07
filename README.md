# Interview Master

Interview Master (repository: `resume-generator`) is an AI-powered interview preparation and resume tailoring platform. A candidate uploads their resume, pastes a target job description, and receives a structured interview report — match score, technical and behavioral questions with interviewer intent and model answers, skill-gap analysis, and a day-by-day preparation plan — plus a tailored, ATS-friendly resume PDF generated on demand.

All AI generation runs on **Groq** with guaranteed schema-compliant structured outputs, and every report is persisted to MongoDB for later reference.

---

## ✨ Features

### AI Interview Report Generation
- Upload a resume PDF + self-description + target job description
- Groq LLM analysis producing:
  - **Match Score** (0–100) against the job description
  - **Technical questions** with interviewer intention and model answers
  - **Behavioral questions** with intention and answering strategy
  - **Skill gaps** rated by severity (`low` / `medium` / `high`)
  - **Day-by-day preparation plan** with focus areas and tasks
- Guaranteed JSON schema compliance via Groq strict structured outputs
- Zod schema validation on every response before it touches the database

### Tailored Resume PDF
- Second AI call generates ATS-friendly, human-sounding resume HTML tailored to the job description
- Headless Chrome (Puppeteer) renders the HTML to an A4 PDF with print margins
- One-click download from the report dashboard (`resume_<reportId>.pdf`)

### Resume Upload Confirmation
- Instant inline confirmation when a file is picked: ✅ check icon, file name, size, and a remove button
- Client-side validation for file type (PDF/DOCX) and size before submission
- Inline error messages for missing inputs or failed generation

### Report Dashboard
- Match-score dial with high/mid/low color coding
- Collapsible question lists, skill-gap badges, and preparation-plan timeline
- Recent reports list on the home page with one-click navigation
- Reports are scoped to the authenticated user only

### Authentication & Authorization
- Register / Login / Logout / Get-me endpoints
- Passwords hashed with bcrypt
- JWT issued as an **httpOnly cookie** (no token exposure to JS)
- Revoked tokens are added to a blacklist on logout
- Every interview route is protected by `authUser` middleware

### Data Persistence
- MongoDB Atlas via Mongoose
- Full report document (questions, gaps, plan, resume text) stored per user
- List queries exclude heavy fields for fast dashboard loads

---

## 🏗️ Architecture Overview

Interview Master consists of two applications in a monorepo:

### 1. Backend Application (Node.js)
**Location:** `Backend/`

**Purpose:**
- Express 5 REST API (port `3000`)
- JWT auth with httpOnly cookies + token blacklist
- Resume PDF text extraction (`pdf-parse`)
- Groq structured-output AI calls (report + resume HTML)
- Puppeteer HTML → A4 PDF rendering
- MongoDB persistence via Mongoose

**Technology:**
- Node.js + Express 5 (CommonJS)
- `groq-sdk` (`openai/gpt-oss-120b`, strict JSON-schema mode)
- Zod 4 (schema definition + `toJSONSchema` + response validation)
- MongoDB Atlas + Mongoose 9
- JWT (`jsonwebtoken`) + bcrypt
- Multer (memory storage, 3MB limit) + `pdf-parse`
- Puppeteer 25 (headless Chrome)
- `nodemon` for development

### 2. Frontend Application (React)
**Location:** `Frontend/`

**Purpose:**
- Auth pages (Login / Register)
- Report generation form with resume upload confirmation
- Interview report dashboard
- Tailored resume PDF download

**Technology:**
- React 19 + Vite 8
- React Router 8 (`createBrowserRouter`)
- Axios (cookie-based sessions, `withCredentials: true`)
- Context API (`AuthContext`, `InterviewContext`) + custom hooks
- SCSS modules per feature
- Oxlint

---

## 🔭 High-Level Architecture

```
Browser (React SPA :5173)
        |
        |  axios (httpOnly JWT cookie, withCredentials)
        v
Express Backend (:3000)
        |
        +---> Auth Middleware (JWT verify + blacklist check)
        |
        +---> Multer (resume PDF -> memory buffer, 3MB max)
        |
        +---> pdf-parse (PDF -> plain text)
        |
        +---> Groq AI Service
        |         |
        |         +---> generateInterviewReport  (strict json_schema)
        |         |         -> matchScore, questions, skillGaps, plan
        |         |
        |         +---> generateResumePdf        (strict json_schema)
        |                   -> HTML -> Puppeteer -> A4 PDF buffer
        |
        +---> MongoDB Atlas (users, reports, blacklisted tokens)
        |
        v
JSON / PDF responses
```

### Report Generation Flow

```
Home Form (JD + self-description + resume PDF)
       |
       v
POST /api/interview/  (multipart)
       |
       v
pdf-parse -> resume text
       |
       v
Groq (openai/gpt-oss-120b, strict structured output)
       |
       +---> Zod schema.parse() validation
       |
       v
MongoDB InterviewReport.create()
       |
       v
Navigate -> /interview/:interviewId  (dashboard)
```

### Resume PDF Flow

```
Interview Dashboard  ->  "Download Resume"
        |
        v
POST /api/interview/resume/pdf/:interviewReportId
        |
        v
Load stored report -> Groq generates tailored HTML
        |
        v
Puppeteer (setContent -> page.pdf A4)
        |
        v
application/pdf attachment -> browser download
```

---

## 🔐 Authentication & Session Management

- **Registration/Login** → bcrypt-hashed password stored in MongoDB
- **JWT** signed with `JWT_SECRET`, returned as an `httpOnly` cookie (inaccessible to JavaScript)
- **Protected routes** (`/api/interview/*`) verify the cookie via `authMiddleware.authUser`
- **Logout** adds the token to a blacklist collection; middleware rejects blacklisted tokens
- **CORS** is locked to `http://localhost:5173` with `credentials: true` — only the Vite dev origin can send cookies
- **Ownership checks** — report queries always filter by `user: req.user.id`, so users can only read their own reports and generate PDFs from them

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- A MongoDB Atlas connection string
- A Groq API key ([console.groq.com/keys](https://console.groq.com/keys))

### Install Dependencies

Backend:

```bash
cd Backend
npm install
```

Frontend:

```bash
cd Frontend
npm install
```

### Configure Environment

Create `Backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>
JWT_SECRET=<random-hex-string>
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-120b   # optional, this is the default
```

### Start Development Environment

Backend (Terminal 1):

```bash
cd Backend
npm run dev
# Runs nodemon on http://localhost:3000
```

Frontend (Terminal 2):

```bash
cd Frontend
npm run dev
# Runs Vite on http://localhost:5173
```

Open **http://localhost:5173**, register an account, then generate your first report.

---

## 📦 Build & Lint

Frontend production build:

```bash
cd Frontend
npm run build
```

Lint:

```bash
cd Frontend
npm run lint
```

> The backend has no bundler step — it runs directly on Node.

---

## 🔌 API Reference

All `/api/interview/*` routes require an authenticated session cookie.

### Auth (`/api/auth`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/register` | Public | Create a new account |
| POST | `/api/auth/login` | Public | Sign in, sets JWT httpOnly cookie |
| GET | `/api/auth/logout` | Public | Clear cookie + blacklist token |
| GET | `/api/auth/get-me` | Private | Current user profile |

### Interview (`/api/interview`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/interview/` | Private | Generate report (multipart: `resume`, `jobDescription`, `selfDescription`) → `201` |
| GET | `/api/interview/report/:interviewId` | Private | Fetch one report (owner only) |
| GET | `/api/interview/` | Private | List own reports (lightweight fields only) |
| POST | `/api/interview/resume/pdf/:interviewReportId` | Private | Generate + download tailored resume PDF |

### Report Object

```json
{
  "_id": "...",
  "title": "Senior Frontend Engineer",
  "matchScore": 78,
  "technicalQuestions": [
    { "question": "...", "intention": "...", "answer": "..." }
  ],
  "behavioralQuestions": [
    { "question": "...", "intention": "...", "answer": "..." }
  ],
  "skillGaps": [
    { "skill": "System Design", "severity": "high" }
  ],
  "preparationPlan": [
    { "day": 1, "focus": "Data Structures", "tasks": ["...", "..."] }
  ],
  "createdAt": "..."
}
```

---

## 🔐 Environment Variables

### Backend (`Backend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret used to sign auth cookies |
| `GROQ_API_KEY` | Yes | Groq API key (server fails fast with a clear error if missing) |
| `GROQ_MODEL` | No | Groq model id (default: `openai/gpt-oss-120b`) |

> `.env` is gitignored — never commit it. The frontend reads no environment variables; the API base URL (`http://localhost:3000`) is set in `Frontend/src/features/*/services/*.api.js`.

---

## 🧰 Tech Stack

### Backend
- Node.js + Express 5 (CommonJS)
- `groq-sdk` — `openai/gpt-oss-120b` with **strict structured outputs** (`response_format: json_schema`)
- Zod 4 — schema source of truth (drives both the JSON schema sent to Groq and runtime validation)
- MongoDB Atlas + Mongoose 9
- JSON Web Tokens + bcrypt
- Multer + `pdf-parse`
- Puppeteer (HTML → PDF)
- `nodemon`

### Frontend
- React 19
- Vite 8
- React Router 8
- Axios
- SCSS
- Oxlint

---

## 🌟 Project Highlights

- Single AI service layer (`Backend/src/services/ai.service.js`) — swapping providers means changing one file
- Groq **strict mode** guarantees the model output matches the Zod schema (no malformed JSON reaching Mongo)
- Lazy Groq client — the server still boots without a key and errors only when generating
- Zod `schema.parse()` on every AI response as a second safety net
- Puppeteer-rendered A4 resume PDF with print-accurate margins
- httpOnly-cookie JWT auth with logout blacklist and per-user ownership filters
- Inline resume-upload confirmation with type/size validation before submission
- Lightweight report-list queries (heavy AI fields excluded) for a fast dashboard

---

## 🗺️ Future Improvements

- DOCX text extraction (UI accepts `.docx`, backend currently parses PDF only)
- Progress/loading indicator per generation step
- Multiple resume versions per report
- Question bookmarking and practice-mode self-rating
- Preparation-plan progress tracking
- Shareable report links
- Rate limiting and request quotas
- Email delivery of generated reports
- Streaming AI responses for faster first paint
- Automated test suite (backend + frontend)

---

## 🎯 Project Goal

Interview Master aims to turn a raw resume and a job description into an actionable interview-preparation plan in under a minute, combining:

- **Structured AI Analysis** — schema-guaranteed reports, never free-form text
- **Honest Gap Detection** — skill gaps ranked by real impact on the application
- **Actionable Coaching** — questions with intent + answers, and a day-wise study plan
- **Resume Tailoring** — an ATS-friendly PDF rewritten for the exact target role
- **Ownership & Privacy** — every report private to the account that created it

...into a single, practical tool for job seekers.
