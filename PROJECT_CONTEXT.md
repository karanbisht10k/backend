# CodeSense (devPilot) — Project Context & Implementation Guide

> **Target Audience:** LLMs (such as ChatGPT, Claude, Gemini) and Engineers needing complete, comprehensive architectural and implementation context of this codebase.

---

## 1. Executive Summary & Purpose

**CodeSense** (formerly and internally referenced as **devPilot**) is an AI-powered Codebase Comprehension and Pull Request Review Copilot. 

### Core Capabilities:
1. **GitHub Repository Ingestion & AST Parsing**: Paste any GitHub repository URL. The system clones or fetches the codebase, performs AST (Abstract Syntax Tree) parsing across 15+ languages (TypeScript, JavaScript, Python, Java, Go, Rust, C/C++, C#, etc.), and extracts classes, methods, and interface skeletons.
2. **Specialized Code Embeddings via Voyage AI (`voyage-code-3`)**: Chunks code using AST symbol boundaries and sliding windows, vectorizes them into 1536-dimensional embeddings using Voyage AI's code-specialized model, with automatic batching and query embedding.
3. **PGVector Vector Storage with In-Memory Fallback**: Stores embeddings, repo metadata, PR reviews, and chat sessions in PostgreSQL with the `pgvector` extension (`vector(1536)`). If PostgreSQL is unavailable, it automatically degrades gracefully to an in-memory vector store with exact mathematical cosine similarity.
4. **Grounded PR Review Engine via Google Gemini (`gemini-2.5-flash`)**: Ingests GitHub Pull Request URLs, pulls unified diffs, performs vector similarity search to find downstream callers and affected files, and prompts Gemini to produce structured, multi-dimensional reviews:
   - Logic & Boundary Errors
   - Security Vulnerabilities (CWE/OWASP)
   - Architectural Breaking Changes & API contracts
   - Missing Test Gaps with concrete test recipes
   - Blast Radius / Change-Impact hierarchy
5. **Interactive Architecture Chat**: Token-by-token Server-Sent Events (SSE) streaming chat grounded in retrieved codebase chunks with exact clickable file/line citations (e.g. `[src/file.ts:L10-L25]`).
6. **Modern Dark-Mode UI**: Built with React 19 and Vite featuring a glassmorphism design system, interactive AST tree explorer, PR findings triage dashboard, and live streaming chat.

---

## 2. Directory Structure & Architecture

```text
backend/
├── docker-compose.yml           # PostgreSQL 16 + PGVector container definition
├── package.json                 # Monorepo/Root scripts (runs both server & frontend)
├── README.md                    # Quickstart and feature overview
├── PROJECT_CONTEXT.md           # This comprehensive context file
│
├── server/                      # PRIMARY ACTIVE BACKEND (TypeScript / Express)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # Server entrypoint, middleware, health check
│       ├── config/
│       │   └── env.ts           # Zod/typed env configurations
│       ├── db/
│       │   ├── pgvector.ts      # PostgreSQL + PGVector client, schemas, cosine search
│       │   └── memoryVector.ts  # Fallback in-memory vector store & cosine math
│       ├── services/
│       │   ├── chunker.service.ts   # AST symbol extraction, language rules, chunking
│       │   ├── diff.service.ts      # Unified diff parsing, line-to-symbol mapping, caller tracing
│       │   ├── voyage.service.ts    # Voyage AI voyage-code-3 vector client & batcher
│       │   ├── gemini.service.ts    # Google Gemini prompt engineering & SSE streaming
│       │   ├── github.service.ts    # GitHub URL parsing, repo cloner, diff fetcher
│       │   ├── indexer.service.ts   # Indexing workflow coordinator
│       │   └── review.service.ts    # PR Review workflow coordinator
│       ├── routes/
│       │   ├── auth.routes.ts         # User auth & demo-login endpoints
│       │   ├── repos.routes.ts        # Repo CRUD, trigger indexing, AST structure
│       │   ├── pullRequests.routes.ts # PR analysis submission & findings retrieval
│       │   └── chat.routes.ts         # Chat sessions & SSE message streaming
│       └── types/
│           └── index.ts         # Shared TypeScript interfaces & models
│
├── frontend/                    # DEVELOPER DASHBOARD (React 19 / Vite)
│   ├── package.json
│   ├── vite.config.js           # Vite dev server + proxy configuration to port 8080
│   └── src/
│       ├── main.jsx             # React DOM root
│       ├── App.jsx              # Tab navigation, auth state, repo selection
│       ├── App.css / index.css  # Dark-mode glassmorphic design system
│       ├── api.js               # Centralized REST & SSE client
│       └── components/
│           ├── Navbar.jsx             # Header, repo switcher, status pill, auth buttons
│           ├── RepoDashboard.jsx      # Repo list, GitHub URL import modal, indexing status
│           ├── RepoComprehension.jsx  # AST Skeleton Explorer + Streaming Arch Chat
│           └── PrAnalysisView.jsx     # PR review submission, findings cards, blast radius
│
└── src/main/java/devPilot/      # HISTORICAL / LEGACY BACKEND (Spring Boot 3 / Java 21)
    └── backend/                 # Original Java implementation with JPA entities & controllers
```

---

## 3. Technology Stack Breakdown

| Layer | Technology | Details |
|---|---|---|
| **Frontend** | React 19, Vite | Vanilla CSS / Glassmorphism, Lucide React icons, SSE streaming consumer |
| **Backend** | Node.js v20+, Express, TypeScript | ES Modules (`"type": "module"`), strict typing |
| **Embeddings** | Voyage AI (`voyage-code-3`) | 1536 dimensions, code-specialized, batch input |
| **Vector DB** | PostgreSQL + PGVector | `CREATE EXTENSION IF NOT EXISTS vector;`, `<=>` cosine distance |
| **Fallback DB** | In-Memory Cosine Store | Full in-memory mock with exact cosine math for zero-setup execution |
| **LLM Reasoning** | Google Gemini (`gemini-2.5-flash`) | Structured JSON responses for reviews, streaming chunks for chat |
| **Git & AST** | Native regex / lexical AST parsers | Multi-language symbol detection without heavyweight native binaries |

---

## 4. Key Workflows & Implementation Details

### Workflow A: Repository Ingestion & Indexing Pipeline
1. **User Action**: User pastes a GitHub repository URL into `RepoDashboard.jsx`.
2. **API Call**: `POST /api/repos/import` -> `repos.routes.ts`.
3. **Cloning / Metadata**: `github.service.ts` parses owner/repo, queries GitHub REST API for branches, stars, descriptions, and optionally clones the repository shallowly (`--depth 1`).
4. **Trigger Indexing**: `POST /api/repos/:id/index` -> `indexer.service.ts`:
   - Scans directory tree, ignoring `.git`, `node_modules`, `dist`, `target`, etc.
   - `chunker.service.ts` analyzes file contents. For recognized code files (`.ts`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.cpp`, etc.), it extracts:
     - Classes and structs (start line, end line, docstrings).
     - Methods and functions (signature, line ranges).
     - Generates overlapping code chunks (approx. 40-80 lines) anchored to AST boundaries.
   - `voyage.service.ts` receives chunks in batches of 20-50, generating 1536-dim vector embeddings.
   - Chunks and AST metadata are persisted to PGVector (`code_chunks` and `code_structures`).
   - Repository status updates: `PENDING` -> `INDEXING` -> `COMPLETED`.

### Workflow B: Grounded Pull Request Review Pipeline
1. **User Action**: User pastes a GitHub PR URL (e.g., `https://github.com/owner/repo/pull/42`) into `PrAnalysisView.jsx`.
2. **API Call**: `POST /api/pull-requests/analyze` -> `review.service.ts`.
3. **Diff Fetching**: `github.service.ts` calls GitHub API to fetch PR title, description, commits, and unified patch (`Accept: application/vnd.github.v3.diff`).
4. **Vector Retrieval (Context Grounding)**:
   - Diff snippet is embedded via `voyageService.embedQuery(diffSnippet)`.
   - Cosine similarity search against `code_chunks` in PGVector identifies the top 8 related files, callers, and test files in the existing codebase.
5. **Gemini Multi-Dimensional Analysis**:
   - `gemini.service.ts` sends a system-engineered prompt to `gemini-2.5-flash` containing the unified diff + retrieved repository context.
   - Temperature is set to `0.1` and `responseMimeType: "application/json"`.
   - The model returns a structured payload:
     - `summaryText` & `overallResult` (`APPROVE`, `REQUEST_CHANGES`, `COMMENT`).
     - `findings`: Array with `category` (`LOGIC`, `SECURITY`, `BREAKING_CHANGE`, `TEST_GAP`), `severity` (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`), `filePath`, `lineRange`, `title`, `description`, `suggestedFixCode`, and `suggestedFixDiff`.
     - `impactReport`: Affected files, downstream caller hierarchy, relevant tests, and behavioral risks.
6. **Storage & UI Update**: Results are stored in `pull_requests`, `pr_findings`, and `pr_impacts`. Frontend polls until status is `COMPLETED`, rendering interactive finding cards and impact graphs.

### Workflow C: Architecture Q&A Chat with Token-by-Token SSE
1. **User Action**: User types an architectural question (e.g. *"How does the auth token validation flow work?"*) in `RepoComprehension.jsx`.
2. **API Call**: `POST /api/chat/sessions/:id/messages` -> `chat.routes.ts`.
3. **Retrieval**: Voyage AI embeds the user's question, fetches top-k matching code chunks from PGVector.
4. **Streaming Execution**:
   - `gemini.service.ts` uses `generateContentStream()` on `gemini-2.5-flash`.
   - Responses stream via Server-Sent Events:
     - `event: token`: Emits text fragments as Gemini generates them.
     - `event: assistantMessage`: Emits the final combined message with citations.
     - `event: done`: Closes the stream.
   - Frontend appends tokens in real time and renders clickable markdown citations formatted as `[filename:L10-L30]`.

---

## 5. Database Schema & Vector Storage

```sql
-- PostgreSQL with PGVector Schema

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS repositories (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  default_branch VARCHAR(100) DEFAULT 'main',
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  indexed_commit_sha VARCHAR(100),
  index_status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_chunks (
  id VARCHAR(255) PRIMARY KEY,
  repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  symbol_name VARCHAR(255),
  symbol_type VARCHAR(100),
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS code_structures (
  id VARCHAR(255) PRIMARY KEY,
  repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  language VARCHAR(50) NOT NULL,
  classes JSONB DEFAULT '[]'::jsonb,
  methods JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id VARCHAR(255) PRIMARY KEY,
  repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
  pr_number INTEGER NOT NULL,
  pr_title TEXT NOT NULL,
  pr_url TEXT NOT NULL,
  base_sha VARCHAR(100),
  head_sha VARCHAR(100),
  status VARCHAR(50) DEFAULT 'PENDING',
  summary_text TEXT,
  overall_result VARCHAR(50),
  limitations TEXT,
  critical_count INTEGER DEFAULT 0,
  high_count INTEGER DEFAULT 0,
  medium_count INTEGER DEFAULT 0,
  low_count INTEGER DEFAULT 0,
  info_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pr_findings (
  id VARCHAR(255) PRIMARY KEY,
  analysis_id VARCHAR(255) REFERENCES pull_requests(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_fix_code TEXT,
  suggested_fix_diff TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pr_impacts (
  analysis_id VARCHAR(255) PRIMARY KEY REFERENCES pull_requests(id) ON DELETE CASCADE,
  affected_files JSONB DEFAULT '[]'::jsonb,
  caller_hierarchy JSONB DEFAULT '[]'::jsonb,
  relevant_tests JSONB DEFAULT '[]'::jsonb,
  behavior_risks JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id VARCHAR(255) PRIMARY KEY,
  repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(255) PRIMARY KEY,
  session_id VARCHAR(255) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Vector Search Query
Cosine similarity in PGVector is executed using the `<=>` distance operator:
```sql
SELECT id, repository_id, file_path, chunk_index, start_line, end_line,
       symbol_name, symbol_type, content,
       (1 - (embedding <=> $1::vector)) AS similarity
FROM code_chunks
WHERE repository_id = $2
ORDER BY embedding <=> $1::vector
LIMIT $3;
```

---

## 6. Complete API Route Reference

### Repositories (`/api/repos`)
- `GET /api/repos` — Returns all stored repositories. Optional `?refresh=true`.
- `POST /api/repos/import` — Ingests a new repo URL. Body: `{ "repositoryUrl": "https://github.com/owner/repo" }`.
- `GET /api/repos/:id` — Returns single repository metadata.
- `POST /api/repos/:id/index` — Triggers AST parsing, chunking, and vector embedding.
- `GET /api/repos/:id/status` — Returns current indexing status (`PENDING` | `INDEXING` | `COMPLETED` | `FAILED`).
- `GET /api/repos/:id/structure` — Returns AST symbols, file tree, classes, and methods for the explorer.

### Pull Requests (`/api/pull-requests`)
- `POST /api/pull-requests/analyze` — Initiates a PR review. Body: `{ "pullRequestUrl": "https://github.com/owner/repo/pull/1", "repositoryId": "owner/repo" }`.
- `GET /api/pull-requests/analyses/:id` — Gets review status, summary counts, and overall recommendation.
- `GET /api/pull-requests/analyses/:id/findings` — Gets list of categorized findings (Logic, Security, Breaking Changes, Tests).
- `GET /api/pull-requests/analyses/:id/impact` — Gets blast-radius impact report (affected files, caller tree, test gaps).
- `GET /api/pull-requests/repository/:repoId` — Lists all historical PR reviews for a repository.

### Architecture Q&A Chat (`/api/chat`)
- `POST /api/chat/sessions` — Creates a new chat thread for a repository. Body: `{ "repositoryId": "owner/repo", "title": "Auth Architecture" }`.
- `GET /api/chat/sessions?repositoryId=:id` — Lists all chat sessions for a repository.
- `GET /api/chat/sessions/:id` — Retrieves message history for a session.
- `POST /api/chat/sessions/:id/messages` — Streams assistant answers via SSE. Body: `{ "content": "Explain how caching is implemented" }`.

### Authentication & Health (`/api/auth`, `/api/health`)
- `GET /api/auth/me` — Gets currently logged in user (or null).
- `POST /api/auth/demo-login` — Instant mock authentication for hackathon evaluation/local testing.
- `POST /api/auth/logout` — Destroys current session.
- `GET /api/health` — Returns status of Postgres connection, Voyage AI configuration, Gemini configuration.

---

## 7. Environment Variables (`server/.env`)

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

# Optional: GitHub Personal Access Token (prevents rate limits)
GITHUB_TOKEN=ghp_your_token_here
```

---

## 8. Graceful Degradation & Zero-Config Mode

A key design feature of CodeSense is **resilience during local development and testing**:
1. **No PostgreSQL?** The app automatically switches to `memoryVector.ts`. It stores all chunks, repositories, reviews, and embeddings in memory and computes vector cosine similarities directly using JavaScript linear algebra.
2. **No Voyage AI API key?** `voyageService` automatically generates high-entropy deterministic pseudo-vectors (1536 dimensions) keyed by code hashes, ensuring the entire ingestion and similarity search pipeline still functions.
3. **No Gemini API key?** `geminiService` falls back to an intelligent heuristic review generator that parses the git diff for common code smells, missing test assertions, and security anti-patterns.

---

## 9. How to Run the Project

```bash
# 1. (Optional) Run PGVector with Docker
docker compose up -d

# 2. Build the TypeScript backend
cd server
npm install
npm run build
cd ..

# 3. Start Frontend & Backend concurrently
npm run dev
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8080`
- **API Health**: `http://localhost:8080/api/health`
