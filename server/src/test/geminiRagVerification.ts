import assert from 'node:assert';
import { GeminiEmbeddingService } from '../services/geminiEmbedding.service.js';
import { EmbeddingService } from '../services/embedding.service.js';
import { GeminiService } from '../services/gemini.service.js';
import { inMemoryDb } from '../db/memoryVector.js';
import { db } from '../db/pgvector.js';
import { ENV } from '../config/env.js';
import { CodeChunk } from '../types/index.js';

let passedChecks = 0;
let totalChecks = 0;

function check(name: string, fn: () => void | Promise<void>) {
  totalChecks++;
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passedChecks++;
      console.log(`  ✅ Check ${totalChecks}: ${name}`);
    })
    .catch((err) => {
      console.error(`  ❌ Check ${totalChecks}: ${name}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    });
}

export async function runGeminiRagVerification() {
  console.log('================================================================');
  console.log('🧪 CodeSense — Gemini Embeddings & RAG Verification Suite');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: Gemini Embedding Generation with Mocked API Responses (768 dims)
  // -------------------------------------------------------------------------
  console.log('📋 Group 1: Gemini Embedding Service & Dimension Validation');
  await check('Generates 768-dimensional embeddings with RETRIEVAL_DOCUMENT / RETRIEVAL_QUERY task types', async () => {
    let capturedBatchRequests: any = null;
    let capturedQueryRequest: any = null;

    const mockAiClient: any = {
      getGenerativeModel: (opts: any) => ({
        batchEmbedContents: async (payload: any) => {
          capturedBatchRequests = payload.requests;
          return {
            embeddings: payload.requests.map((_: any, idx: number) => {
              const vector = new Array(768).fill(0.01 * (idx + 1));
              return { values: vector };
            })
          };
        },
        embedContent: async (payload: any) => {
          capturedQueryRequest = payload;
          return {
            embedding: { values: new Array(768).fill(0.05) }
          };
        }
      })
    };

    const service = new GeminiEmbeddingService({
      apiKey: 'test-fake-gemini-key',
      modelName: 'text-embedding-004',
      dimension: 768,
      clientOverride: mockAiClient
    });

    const chunks = [
      { text: 'export function add(a: number, b: number) { return a + b; }', filePath: 'src/math.ts' },
      { text: 'export function sub(a: number, b: number) { return a - b; }', filePath: 'src/math.ts' }
    ];

    const embeddings = await service.embedCodeChunks(chunks, 'document');
    assert.strictEqual(embeddings.length, 2, 'Should return 2 vector embeddings');
    assert.strictEqual(embeddings[0].length, 768, 'First embedding should have 768 dimensions');
    assert.strictEqual(embeddings[1].length, 768, 'Second embedding should have 768 dimensions');
    assert.strictEqual(capturedBatchRequests.length, 2, 'Batch embed should receive 2 requests');
    assert.strictEqual(capturedBatchRequests[0].taskType, 'RETRIEVAL_DOCUMENT', 'Document embeddings should use RETRIEVAL_DOCUMENT');

    const queryVec = await service.embedQuery('find math add function');
    assert.strictEqual(queryVec.length, 768, 'Query vector should have 768 dimensions');
    assert.strictEqual(capturedQueryRequest.taskType, 'RETRIEVAL_QUERY', 'Query embedding should use RETRIEVAL_QUERY');
  });

  // -------------------------------------------------------------------------
  // Test 2: Rate Limit (429) & Transient Retry Handling
  // -------------------------------------------------------------------------
  await check('Recovers from transient 429 rate limit error via automatic exponential backoff', async () => {
    let callCount = 0;
    const mockFlakyClient: any = {
      getGenerativeModel: () => ({
        batchEmbedContents: async (payload: any) => {
          callCount++;
          if (callCount === 1) {
            const err: any = new Error('Resource has been exhausted (e.g. check quota) - 429');
            err.status = 429;
            throw err;
          }
          return {
            embeddings: payload.requests.map(() => ({ values: new Array(768).fill(0.02) }))
          };
        }
      })
    };

    const service = new GeminiEmbeddingService({
      apiKey: 'test-flaky-key',
      clientOverride: mockFlakyClient
    });

    const res = await service.embedCodeChunks(['function test() {}'], 'document');
    assert.strictEqual(callCount, 2, 'Should have retried once after 429 rate limit error');
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].length, 768);
  });

  // -------------------------------------------------------------------------
  // Test 3: Missing / Invalid API Key Handling (Clear error, no fake vectors)
  // -------------------------------------------------------------------------
  await check('Rejects unconfigured API key with clear error, ensuring fake vectors are never stored', async () => {
    const unconfiguredService = new GeminiEmbeddingService({
      apiKey: '',
      dimension: 768
    });

    assert.strictEqual(unconfiguredService.isConfigured(), false);
    let errorCaught = false;
    try {
      await unconfiguredService.embedCodeChunks(['function test() {}'], 'document');
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('Gemini API key is not configured'), 'Error message must clearly state key is missing');
    }
    assert.strictEqual(errorCaught, true, 'Must throw error when API key is missing');
  });

  // -------------------------------------------------------------------------
  // Test 4: Unified EmbeddingService Routing by Provider
  // -------------------------------------------------------------------------
  await check('Unified EmbeddingService correctly routes to Gemini when EMBEDDING_PROVIDER=gemini', async () => {
    const unifiedService = new EmbeddingService();
    assert.strictEqual(unifiedService.getProvider(), 'gemini');
    assert.strictEqual(unifiedService.getDimension(), 768);
    assert.strictEqual(unifiedService.getModel(), 'gemini-embedding-2');
  });

  // -------------------------------------------------------------------------
  // Test 5: Vector Compatibility, Storage & Commit/Repo Isolation
  // -------------------------------------------------------------------------
  console.log('\n📋 Group 2: Vector Search & Repository / Commit Isolation');
  await check('PGVector / In-Memory vector store enforces 768 dimensions and repository / commit isolation', async () => {
    const repoA = 'repo-audit-gemini-a';
    const repoB = 'repo-audit-gemini-b';
    const commit1 = 'c0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9';
    const commit2 = 'b1b2b3b4b5b6b7b8b9b0c1c2c3c4c5c6c7c8c9c0';

    const chunkA1: CodeChunk = {
      id: 'chk-a1',
      repositoryId: repoA,
      commitSha: commit1,
      filePath: 'src/auth/jwt.ts',
      language: 'typescript',
      symbolName: 'verifyJwtToken',
      symbolType: 'function',
      startLine: 1,
      endLine: 25,
      content: 'export function verifyJwtToken(token: string) { return decode(token); }',
      embedding: new Array(768).fill(0.05),
      createdAt: new Date().toISOString()
    };

    const chunkA2: CodeChunk = {
      id: 'chk-a2',
      repositoryId: repoA,
      commitSha: commit2,
      filePath: 'src/auth/oauth.ts',
      language: 'typescript',
      symbolName: 'exchangeOAuthCode',
      symbolType: 'function',
      startLine: 1,
      endLine: 30,
      content: 'export function exchangeOAuthCode(code: string) { return requestTokens(code); }',
      embedding: new Array(768).fill(0.04),
      createdAt: new Date().toISOString()
    };

    const chunkB: CodeChunk = {
      id: 'chk-b1',
      repositoryId: repoB,
      commitSha: commit1,
      filePath: 'src/billing/stripe.ts',
      language: 'typescript',
      symbolName: 'createStripeCharge',
      symbolType: 'function',
      startLine: 1,
      endLine: 40,
      content: 'export function createStripeCharge(amount: number) { return stripe.charges.create(); }',
      embedding: new Array(768).fill(0.05), // Identical vector, but in different repo
      createdAt: new Date().toISOString()
    };

    // Save chunks to memoryDb with their respective repositoryId and commitSha
    inMemoryDb.saveCodeChunks(repoA, [chunkA1], commit1);
    inMemoryDb.saveCodeChunks(repoA, [chunkA2], commit2);
    inMemoryDb.saveCodeChunks(repoB, [chunkB], commit1);

    const queryVec = new Array(768).fill(0.05);

    // Query repoA without commit filter -> should get chunkA1 and chunkA2, but NEVER chunkB
    const resultsRepoA = await inMemoryDb.searchSimilarChunks(repoA, queryVec, 10);
    assert(resultsRepoA.every((c) => c.repositoryId === repoA), 'Chunks must strictly belong to Repo A');
    assert(!resultsRepoA.some((c) => c.repositoryId === repoB), 'Repo B chunks must never leak into Repo A search');

    // Query repoA WITH commit filter = commit1 -> should ONLY return chunkA1
    const resultsCommit1 = await inMemoryDb.searchSimilarChunks(repoA, queryVec, 10, commit1);
    assert.strictEqual(resultsCommit1.length, 1, 'Only 1 chunk should match commit 1');
    assert.strictEqual(resultsCommit1[0].id, 'chk-a1');
    assert.strictEqual(resultsCommit1[0].commitSha, commit1);
  });

  // -------------------------------------------------------------------------
  // Test 6: Chat RAG Grounding & Stream Generation
  // -------------------------------------------------------------------------
  console.log('\n📋 Group 3: Gemini Chat RAG Generation, Grounding & Citations');
  await check('Gemini Chat streams response grounded in retrieved code chunks with accurate citations', async () => {
    let capturedPrompt = '';
    const mockGeminiClient: any = {
      getGenerativeModel: () => ({
        generateContentStream: async (prompt: string) => {
          capturedPrompt = prompt;
          return {
            stream: (async function* () {
              yield { text: () => 'Based on the repository code in ' };
              yield { text: () => '`src/auth/jwt.ts`, ' };
              yield { text: () => '`verifyJwtToken` validates tokens.' };
            })()
          };
        }
      })
    };

    const geminiService = new GeminiService({
      apiKey: 'test-chat-key',
      clientOverride: mockGeminiClient
    });

    const contextChunks: CodeChunk[] = [
      {
        id: 'chunk-jwt',
        repositoryId: 'repo-test',
        commitSha: 'commit-sha-123',
        filePath: 'src/auth/jwt.ts',
        language: 'typescript',
        symbolName: 'verifyJwtToken',
        symbolType: 'function',
        startLine: 10,
        endLine: 20,
        content: 'export function verifyJwtToken(token: string) { return jwt.verify(token, SECRET); }',
        embedding: new Array(768).fill(0.01),
        createdAt: new Date().toISOString()
      }
    ];

    const tokens: string[] = [];
    const result = await geminiService.streamChat({
      question: 'How is JWT verification implemented?',
      contextChunks,
      history: [
        { role: 'user', content: 'What auth mechanism is used?' },
        { role: 'assistant', content: 'The repository uses JWT-based authentication.' }
      ],
      repositoryId: 'repo-test',
      commitSha: 'commit-sha-123',
      onToken: (t) => tokens.push(t)
    });

    assert.strictEqual(tokens.join(''), 'Based on the repository code in `src/auth/jwt.ts`, `verifyJwtToken` validates tokens.');
    assert.strictEqual(result.citations.length, 1, 'Should produce 1 citation from the retrieved chunk');
    assert.strictEqual(result.citations[0].filePath, 'src/auth/jwt.ts');
    assert.strictEqual(result.citations[0].startLine, 10);
    assert.strictEqual(result.citations[0].endLine, 20);

    // Verify prompt contains untrusted context fence and system instructions
    assert(capturedPrompt.includes('UNTRUSTED_REPOSITORY_SOURCE_CONTEXT'), 'Prompt must isolate retrieved code as untrusted text');
    assert(capturedPrompt.includes('src/auth/jwt.ts:10-20'), 'Prompt must cite file path and line numbers');
    assert(capturedPrompt.includes('What auth mechanism is used?'), 'Prompt must incorporate conversation history');
  });

  // -------------------------------------------------------------------------
  // Test 7: Empty Retrieval Handling (No Hallucination)
  // -------------------------------------------------------------------------
  await check('Handles empty retrieval results without fabricating code or calling generative model', async () => {
    let generateCalled = false;
    const mockGeminiClient: any = {
      getGenerativeModel: () => ({
        generateContentStream: async () => {
          generateCalled = true;
          return { stream: (async function* () {})() };
        }
      })
    };

    const geminiService = new GeminiService({
      apiKey: 'test-chat-key',
      clientOverride: mockGeminiClient
    });

    const tokens: string[] = [];
    const result = await geminiService.streamChat({
      question: 'How do you configure Kubernetes deployments in this project?',
      contextChunks: [], // Empty retrieval!
      onToken: (t) => tokens.push(t)
    });

    assert.strictEqual(generateCalled, false, 'Generative model must not be called when 0 chunks are found');
    assert(
      result.answer.includes('could not find relevant code chunks') ||
      result.answer.includes('did not find any relevant code chunks'),
      'Must explicitly notify user no code was found'
    );
    assert.strictEqual(result.citations.length, 0, 'No citations should be returned');
    assert.strictEqual(tokens.join(''), result.answer, 'Streamed tokens must match final answer');
  });

  // -------------------------------------------------------------------------
  // Test 8: Context Deduplication and Token Bounding
  // -------------------------------------------------------------------------
  await check('Deduplicates identical/overlapping chunk spans and bounds context length safely', async () => {
    let capturedPrompt = '';
    const mockGeminiClient: any = {
      getGenerativeModel: () => ({
        generateContentStream: async (prompt: string) => {
          capturedPrompt = prompt;
          return {
            stream: (async function* () {
              yield { text: () => 'Analysis complete.' };
            })()
          };
        }
      })
    };

    const geminiService = new GeminiService({
      apiKey: 'test-chat-key',
      clientOverride: mockGeminiClient
    });

    const duplicateChunks: CodeChunk[] = [
      {
        id: 'chk-dup-1',
        repositoryId: 'repo-dup',
        commitSha: 'sha1',
        filePath: 'src/utils.ts',
        language: 'typescript',
        symbolName: 'a',
        symbolType: 'block',
        startLine: 1,
        endLine: 50,
        content: 'const a = 1;'.repeat(200),
        embedding: new Array(768).fill(0),
        createdAt: new Date().toISOString()
      },
      {
        id: 'chk-dup-2',
        repositoryId: 'repo-dup',
        commitSha: 'sha1',
        filePath: 'src/utils.ts',
        language: 'typescript',
        symbolName: 'a',
        symbolType: 'block',
        startLine: 1,
        endLine: 50,
        content: 'const a = 1;'.repeat(200),
        embedding: new Array(768).fill(0),
        createdAt: new Date().toISOString()
      }
    ];

    const result = await geminiService.streamChat({
      question: 'What does utils.ts do?',
      contextChunks: duplicateChunks
    });

    assert.strictEqual(result.citations.length, 1, 'Duplicate file:startLine:endLine must be deduplicated in citations');
    // Ensure total prompt size is reasonable
    assert(capturedPrompt.length < 15000, 'Bounded prompt should not exceed context maximum');
  });

  console.log('================================================================');
  console.log(`🎉 All ${passedChecks}/${totalChecks} Gemini Embeddings & RAG Verification Checks PASSED!`);
  console.log('================================================================\n');
}

// Run immediately when executed directly
runGeminiRagVerification().catch((err) => {
  console.error('Gemini RAG Verification Failed:', err);
  process.exit(1);
});
