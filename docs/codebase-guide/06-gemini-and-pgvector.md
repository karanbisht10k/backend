# Module 06: Google Gemini Embeddings & PostgreSQL PGVector

## 1. What Are Vector Embeddings?

In modern search and AI systems, computers cannot directly compare the semantic meaning of text strings. For example, the query `"how is user authentication handled?"` and the source code snippet `verifyJwtToken(token)` share almost no common words, yet they are conceptually identical.

A **vector embedding** is a mathematical representation of text as a high-dimensional array of floating-point numbers (a vector). Models are trained so that code snippets with similar behavior or concepts produce vectors that point in nearly the same geometric direction in multi-dimensional space.

---

## 2. Gemini Embedding Configuration & API Integration

CodeSense uses Google's latest embedding model via the `@google/generative-ai` SDK:

| Parameter | Project Value | Implementation Source |
| :--- | :--- | :--- |
| **Active Provider** | `gemini` (default) | `server/src/config/env.ts` (`EMBEDDING_PROVIDER`) |
| **Model Name** | `gemini-embedding-2` | `server/src/config/env.ts` (`GEMINI_EMBEDDING_MODEL`) |
| **Vector Dimension** | `768` floats | `server/src/config/env.ts` (`GEMINI_EMBEDDING_DIMENSION`) |
| **Document Task** | `TaskType.RETRIEVAL_DOCUMENT` | `server/src/services/geminiEmbedding.service.ts` |
| **Query Task** | `TaskType.RETRIEVAL_QUERY` | `server/src/services/geminiEmbedding.service.ts` |
| **Batch Size** | `64` chunks per request | `server/src/services/geminiEmbedding.service.ts` |

### Why Asymmetric Task Types Matter:
Gemini's embedding API uses **asymmetric embedding spaces**:
- When embedding source code files, `TaskType.RETRIEVAL_DOCUMENT` instructs the model to create an indexable representation optimized for retrieval.
- When embedding developer questions, `TaskType.RETRIEVAL_QUERY` instructs the model to create a search query representation.
- This asymmetry guarantees higher retrieval accuracy than standard symmetric embeddings.

---

## 3. Batching, Retries & Dimension Validation

In `server/src/services/geminiEmbedding.service.ts`:

```typescript
// Truncation & Batching Logic
const sanitizedRequests = batch.map((item) => {
  const safeText = item.text.length > 8000 ? item.text.substring(0, 8000) : item.text;
  return {
    content: {
      role: 'user',
      parts: [{ text: safeText || '// empty code chunk' }]
    },
    taskType,
    title: item.title ? item.title.substring(0, 100) : undefined,
    outputDimensionality: this.dimension // 768
  };
});
```

### Safety & Resilience Safeguards:
1. **Oversized Chunk Truncation**: Text is safely capped at 8,000 characters before sending, preventing Gemini payload limit errors.
2. **Safe Batch Size (64)**: Well below Google's 100-item batch ceiling to avoid payload timeouts on slow connections.
3. **Exponential Backoff**: `embedBatchWithRetry` catches transient 429 (rate-limit) and 503 (network) errors, retrying up to 3 times with exponential backoff delay (`1000ms`, `2000ms`, `4000ms`).
4. **Dimension Slicing & Zero-Padding**:
   If the Gemini API returns a vector with an unexpected length, CodeSense validates and normalizes the dimension:
   - If length > 768: `values.slice(0, 768)`.
   - If length < 768: pads with trailing zeros to guarantee 768 dimensions.

---

## 4. The Mathematics of Vector Similarity

To compare how close a query vector $\vec{Q}$ is to a stored code chunk vector $\vec{D}$, CodeSense computes **Cosine Similarity**:

$$\text{Cosine Similarity}(\vec{Q}, \vec{D}) = \frac{\vec{Q} \cdot \vec{D}}{\|\vec{Q}\| \|\vec{D}\|} = \frac{\sum_{i=1}^{n} Q_i D_i}{\sqrt{\sum_{i=1}^{n} Q_i^2} \sqrt{\sum_{i=1}^{n} D_i^2}}$$

- When two vectors point in the identical direction, the cosine is **1.0** (maximum similarity).
- When they are orthogonal (unrelated), the cosine is **0.0**.

### Cosine Distance in PGVector:
In PostgreSQL with `pgvector`, the `<=>` operator computes **Cosine Distance**:

$$\text{Cosine Distance} = 1 - \text{Cosine Similarity}$$

- Identical vectors have a distance of **0.0**.
- Unrelated vectors have a distance approaching **1.0**.

---

## 5. PostgreSQL PGVector Schema & HNSW Indexing

In `server/src/db/pgvector.ts`:

### The `code_chunks` Table:
```sql
CREATE TABLE IF NOT EXISTS code_chunks (
  id VARCHAR(255) PRIMARY KEY,
  repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha VARCHAR(100),
  file_path TEXT NOT NULL,
  language VARCHAR(50),
  start_line INT,
  end_line INT,
  symbol_name TEXT,
  symbol_type VARCHAR(50),
  content TEXT,
  embedding_model VARCHAR(100),
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### HNSW (Hierarchical Navigable Small World) Index:
For massive codebases with tens of thousands of chunks, standard sequential vector scans are too slow. CodeSense creates an **HNSW vector index**:

```sql
CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw_idx 
ON code_chunks USING hnsw (embedding vector_cosine_ops);
```

- **HNSW** builds a multi-layer graph of vectors, allowing nearest-neighbor search in logarithmic $O(\log N)$ time rather than linear $O(N)$ time.
- Uses `vector_cosine_ops` to accelerate cosine distance calculations.

### Similarity Query Execution:
```typescript
// server/src/db/pgvector.ts: lines 586-597
let query = `
  SELECT id, repository_id, commit_sha, file_path, language, start_line, end_line, symbol_name, symbol_type, content,
         1 - (embedding <=> $1::vector) AS similarity
  FROM code_chunks
  WHERE repository_id = $2 AND embedding IS NOT NULL
`;
if (commitSha) {
  query += ` AND (commit_sha = $4 OR commit_sha IS NULL) `;
}
query += ` ORDER BY embedding <=> $1::vector ASC LIMIT $3;`;
```

---

## 6. The In-Memory Vector Fallback (`memoryVector.ts`)

CodeSense is designed with zero-dependency resiliency:
- If a developer runs the project locally without starting Docker or PostgreSQL, `db.isDatabaseConnected()` returns `false`.
- Instead of throwing errors, the database client transparently routes all calls to `inMemoryDb` (`server/src/db/memoryVector.ts`).

### How the In-Memory Store Works:
1. **Partitioned Storage**: Chunks and ASTs are organized in-memory by a composite key `${repoId}:::${commitSha || 'latest'}`.
2. **Pure Cosine Calculation**:
   ```typescript
   function cosineSimilarity(a: number[], b: number[]): number {
     let dot = 0;
     let normA = 0;
     let normB = 0;
     for (let i = 0; i < a.length; i++) {
       dot += a[i] * b[i];
       normA += a[i] * a[i];
       normB += b[i] * b[i];
     }
     return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
   }
   ```
3. **Automatic Downgrade**: If PostgreSQL fails mid-operation, queries automatically fall back to memory so users never experience an unhandled exception.

---

## 7. Five Short Questions to Test Your Understanding

1. What is the active default embedding model in CodeSense and what is its vector dimension?
2. Why does CodeSense specify `TaskType.RETRIEVAL_DOCUMENT` for code and `TaskType.RETRIEVAL_QUERY` for questions?
3. How is Cosine Similarity mathematically converted from PGVector's `<=>` operator?
4. What index type does CodeSense apply to the `embedding` column, and why is it preferred over sequential scans?
5. What component handles vector similarity search when PostgreSQL is not running?
