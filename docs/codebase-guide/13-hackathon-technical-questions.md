# Module 13: Hackathon Technical Defense & Comprehensive Q&A

This guide equips you to defend every architectural and implementation decision in CodeSense before senior software engineers, hackathon judges, and technical evaluators.

---

## Category 1: Architecture & Dual-Engine Design

### Q1: "Why did you build both an AST parser and a vector database? Wouldn't vector RAG alone be sufficient?"
> **Authoritative Answer**:
> "Vector similarity only measures *semantic closeness*, not *execution truth*. For example, if a developer changes a function signature from `calculateTax(order)` to `calculateTax(order, taxRegion)`, vector search might find files that discuss taxation or accounting. However, it cannot tell you which 12 controllers or microservices invoke that function and will break at runtime.
> 
> CodeSense implements a **hybrid dual-engine architecture**:
> 1. Our **deterministic AST engine** (`server/src/services/chunker.service.ts` & `diff.service.ts`) parses the concrete syntax tree, builds cross-file call graphs, and mathematically proves downstream caller impact (Depth 1 Direct and Depth 2 Transitive) with 100% certainty.
> 2. Our **semantic vector engine** (`server/src/services/geminiEmbedding.service.ts` & `db/pgvector.ts`) provides conceptual domain context to the LLM.
> Vectors provide background understanding; ASTs provide verifiable execution impact."

### Q2: "Why is the active backend written in TypeScript rather than Java/Spring Boot?"
> **Authoritative Answer**:
> "The repository contains a historical Spring Boot 3 prototype (`src/main/java/devPilot`). We migrated to a modern Node.js/TypeScript architecture (`server/`) for three critical reasons:
> 1. **Native TypeScript Compiler AST Integration**: Using the official `typescript` compiler API (`ts.createSourceFile`) allows us to parse TypeScript and JavaScript ASTs with zero native C++ compilation bindings, making installation instantaneous and cross-platform.
> 2. **Official Google Gemini SDK**: Direct, first-class integration with `@google/generative-ai` for batch embedding and streaming responses via Server-Sent Events.
> 3. **Developer Experience & Lightweight Footprint**: Sub-second cold startup times and unified end-to-end TypeScript types across the backend and React 19 frontend."

---

## Category 2: Embeddings, PGVector & Vector Math

### Q3: "Which embedding model and vector dimension does CodeSense use, and why?"
> **Authoritative Answer**:
> "We use Google's **`gemini-embedding-2`** producing **768-dimensional vectors** via `server/src/services/geminiEmbedding.service.ts`.
> We specifically utilize Gemini's asymmetric task types:
> - `TaskType.RETRIEVAL_DOCUMENT` when indexing repository code chunks.
> - `TaskType.RETRIEVAL_QUERY` when embedding user search queries or PR diff snippets.
> 
> This creates an optimized asymmetric embedding space where search queries retrieve the most semantically relevant code implementations."

### Q4: "How does vector similarity search work in PostgreSQL, and how is it optimized for scale?"
> **Authoritative Answer**:
> "We store 768-dimensional embeddings in PostgreSQL using the `vector(768)` type from the `pgvector` extension (`server/src/db/pgvector.ts`).
> 1. **Cosine Similarity**: We calculate cosine distance using the `<=>` operator: `1 - (embedding <=> $1::vector) AS similarity`.
> 2. **HNSW Indexing**: To avoid slow sequential table scans on large codebases, we apply an HNSW (Hierarchical Navigable Small World) index:
>    `CREATE INDEX ON code_chunks USING hnsw (embedding vector_cosine_ops);`
>    This enables approximate nearest-neighbor retrieval in $O(\log N)$ logarithmic time."

---

## Category 3: AST Parsing & Change Impact Analysis

### Q5: "How does CodeSense distinguish a confirmed caller from an inferred caller?"
> **Authoritative Answer**:
> "In `server/src/services/diff.service.ts` (`traceStructuralCallers`), we enforce a strict two-tier classification:
> - **`[CONFIRMED]`**: The caller file contains a verified `import` statement pointing to the modified module **AND** invokes the modified symbol within its AST.
> - **`[INFERRED]`**: The caller file invokes a same-named symbol but lacks an explicit resolved import, or imports the module without a verified method invocation.
> 
> Furthermore, we propagate confirmed callers downstream to **`[TRANSITIVE]`** callers (Depth 2), identifying secondary functions that call the direct caller."

### Q6: "What happens if a developer submits a PR for a repository that has not been indexed yet?"
> **Authoritative Answer**:
> "In `server/src/services/review.service.ts`, the engine detects if AST structures are absent. It dynamically fetches the changed files at the PR head commit via the GitHub contents API and extracts **ad-hoc AST structures** on the fly.
> Additionally, it sets `structuralAnalysisAvailable: false`, flags a risk warning in the report limitations, and notes that full repo-wide caller propagation could not be computed. It never silently fails."

---

## Category 4: Failure Handling & Resiliency

### Q7: "What happens if PostgreSQL or Docker is not running when the user tests CodeSense?"
> **Authoritative Answer**:
> "CodeSense implements an automatic **in-memory fallback cache** in `server/src/db/memoryVector.ts`. If PostgreSQL is unreachable upon startup, `db.initialize()` logs a warning and transparently delegates all repository, chunk, and AST operations to in-memory maps. It computes exact cosine similarity mathematically in JavaScript. This allows evaluators to run and test the complete application offline without provisioning Docker."

### Q8: "How does CodeSense handle server restarts in the middle of indexing a massive repository?"
> **Authoritative Answer**:
> "In `server/src/db/pgvector.ts`, during `db.initialize()`, the server executes an automatic recovery query:
> ```sql
> UPDATE repositories
> SET index_status = 'FAILED',
>     indexing_error = 'Indexing process was interrupted by server restart or process termination. Safe to retry.',
>     updated_at = NOW()
> WHERE index_status = 'INDEXING';
> ```
> This prevents repositories from being trapped indefinitely in a frozen loading state."

---

## Category 5: Security & Threat Modeling

### Q9: "How does CodeSense prevent remote code execution or command injection when cloning repositories?"
> **Authoritative Answer**:
> "In `server/src/services/github.service.ts`, we avoid `child_process.exec`, which invokes an OS command shell. Instead, we use `child_process.execFile('git', args)`, passing all arguments as discrete array elements. Shell control operators (`;`, `&&`, `|`) are treated as literal strings and cannot execute. Furthermore, repository target paths are validated to ensure they never escape `REPOS_STORAGE_DIR` via directory traversal."

### Q10: "How do you prevent malicious repositories from using prompt injection against Gemini?"
> **Authoritative Answer**:
> "All untrusted code content is isolated inside explicit `<source_context>` XML delimiter tags with clear boundary declarations in `server/src/services/gemini.service.ts`. The system prompt explicitly instructs Gemini 2.5 Flash to treat everything inside those tags purely as passive data and never execute instructions found within source files."
