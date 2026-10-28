# CodeSense — AI Codebase Comprehension & PR Review Copilot

> **Full TypeScript System for GitHub Repo Ingestion, Voyage AI Code Embeddings, PGVector Vector Storage, and Grounded Gemini PR Reviews**

CodeSense allows engineering teams to paste **any GitHub URL** (repository or pull request) to automatically clone the codebase, parse an AST structural skeleton, generate vector embeddings using **Voyage AI** (`voyage-code-3`), store and query vectors with **PostgreSQL + PGVector**, and execute deep, evidence-backed PR reviews and architectural Q&A powered by **Google Gemini**.

---

## 🌟 Tech Stack & Key Features

1. **TypeScript Backend** (`/server`):
   - Built on Node.js, Express, and TypeScript.
   - Fast AST parsing across TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, etc.
   - Sliding window & AST symbol code chunking.
   - Real-time Server-Sent Events (SSE) streaming for conversational Q&A.

2. **Voyage AI Embeddings (`voyage-code-3`)**:
   - Specialized 1536-dimensional code embeddings with `voyageService`.
   - Automatic batching and query embedding support (`input_type: "document"` and `"query"`).
   - High-entropy deterministic fallback when keys are in setup mode.

3. **PostgreSQL + PGVector Vector Storage**:
   - Automated extension verification: `CREATE EXTENSION IF NOT EXISTS vector`.
   - Tables: `repositories`, `code_chunks`, `code_structures`, `pull_requests`, `pr_findings`, `pr_impacts`, `chat_sessions`, `chat_messages`.
   - Cosine similarity search using `<=>` operator.
   - Docker Compose file included for instant 1-click database launch.
   - In-memory vector cache fallback so the app runs smoothly even before Postgres is started.

4. **Google Gemini PR Review & Architecture Copilot**:
   - Grounded PR reviews using unified diffs + PGVector retrieved context.
   - Multi-dimensional findings: Logic Errors, Security Vulnerabilities, Architectural Breaking Changes, and Missing Test Gaps.
   - Line-specific code diffs, suggested fixes, and test recipes.
   - Change-impact report with downstream caller hierarchy and behavior alerts.
   - Token-by-token streaming architecture chat with clickable citations (`[src/file.ts:L10-L25]`).

5. **Modern Developer UI** (`/frontend`):
   - React 19, Vite, and Lucide icons.
   - Dark mode glassmorphism theme.
   - Repo Dashboard, AST Skeleton Explorer, Architecture Chat, and PR Analysis View.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js** v20+ and **npm**
- **Git**
- *(Optional)* **Docker** for running PostgreSQL + PGVector locally

### 2. Configure Environment Variables
Copy `server/.env.example` to `server/.env`:

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your API keys:

```env
PORT=8080
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/codesense_db

# Voyage AI Embeddings
VOYAGE_API_KEY=your_voyage_api_key_here
VOYAGE_MODEL=voyage-code-3
VOYAGE_DIMENSION=1536

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Optional: increases GitHub API rate limit from 60/hr to 5,000/hr
GITHUB_TOKEN=
```

### 3. (Optional) Start PGVector via Docker
```bash
# In project root
docker compose up -d
```
*Note: If PostgreSQL is not started, CodeSense automatically falls back to an in-memory vector store with exact cosine similarity, so you can test right away!*

### 4. Install & Run Development Mode
In the project root:

```bash
# Install server dependencies
cd server
npm install
npm run build
cd ..

# Start both Backend and Frontend concurrently
npm run dev
```

The application will be accessible at:
- **Frontend Dashboard**: [http://localhost:5173](http://localhost:5173)
- **TypeScript API Server**: [http://localhost:8080](http://localhost:8080)
- **API Health Endpoint**: [http://localhost:8080/api/health](http://localhost:8080/api/health)

---

## 🔌 API Endpoints Reference

### Repositories
- `GET /api/repos` — List all imported repositories.
- `POST /api/repos/import` — Ingest any GitHub repository URL (`{ repositoryUrl }`).
- `GET /api/repos/:id` — Retrieve repository metadata.
- `POST /api/repos/:id/index` — Trigger AST parsing, Voyage AI vectorization & PGVector storage.
- `GET /api/repos/:id/status` — Poll repository indexing status (`INDEXING` | `COMPLETED` | `FAILED`).
- `GET /api/repos/:id/structure` — Retrieve extracted AST classes, methods, and line ranges.

### Pull Requests
- `POST /api/pull-requests/analyze` — Submit GitHub PR URL (`{ pullRequestUrl, repositoryId }`).
- `GET /api/pull-requests/analyses/:id` — Get analysis status, summary, and severity counts.
- `GET /api/pull-requests/analyses/:id/findings` — Retrieve categorized findings with diffs and fixes.
- `GET /api/pull-requests/analyses/:id/impact` — Retrieve affected files, downstream callers, and test gaps.
- `GET /api/pull-requests/repository/:repoId` — List all past reviews for a repository.

### Architecture Q&A Chat
- `POST /api/chat/sessions` — Create a new architecture chat session.
- `GET /api/chat/sessions?repositoryId=:id` — List sessions for a repository.
- `GET /api/chat/sessions/:id` — Retrieve message history.
- `POST /api/chat/sessions/:id/messages` — SSE stream response with token events and citations.
