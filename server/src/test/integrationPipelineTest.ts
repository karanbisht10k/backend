import assert from 'node:assert';
import { db } from '../db/pgvector.js';
import { inMemoryDb } from '../db/memoryVector.js';
import { githubService } from '../services/github.service.js';
import { codeChunkerService } from '../services/chunker.service.js';
import { embeddingService } from '../services/embedding.service.js';
import { geminiEmbeddingService } from '../services/geminiEmbedding.service.js';
import { voyageService } from '../services/voyage.service.js';
import { geminiService } from '../services/gemini.service.js';
import { diffAnalysisService } from '../services/diff.service.js';
import { ENV } from '../config/env.js';

async function runIntegrationAudit() {
  console.log('================================================================');
  console.log('🔍 CodeSense End-to-End Integration Audit & Live Path Test');
  console.log('================================================================\n');

  // 1. Environment & Credentials Status Check
  console.log('----------------------------------------------------------------');
  console.log('1. ENVIRONMENT CONFIGURATION STATUS (Values Redacted)');
  console.log('----------------------------------------------------------------');
  const envStatus = {
    PORT: Boolean(ENV.PORT),
    NODE_ENV: Boolean(ENV.NODE_ENV),
    DATABASE_URL: Boolean(ENV.DATABASE_URL),
    EMBEDDING_PROVIDER: Boolean(ENV.EMBEDDING_PROVIDER),
    GEMINI_API_KEY: geminiService.isConfigured(),
    VOYAGE_API_KEY: voyageService.isConfigured(),
    GITHUB_TOKEN: Boolean(ENV.GITHUB_TOKEN && ENV.GITHUB_TOKEN.trim().length > 0)
  };

  for (const [key, isSet] of Object.entries(envStatus)) {
    console.log(`   ${key.padEnd(18)} : ${isSet ? 'CONFIGURED' : 'MISSING / EMPTY'}`);
  }

  // 2. PostgreSQL & PGVector Service Verification
  console.log('\n----------------------------------------------------------------');
  console.log('2. POSTGRESQL & PGVECTOR VERIFICATION');
  console.log('----------------------------------------------------------------');
  await db.initialize();
  const pgConnected = db.isDatabaseConnected();
  console.log(`   Database Engine Status : ${pgConnected ? 'CONNECTED (PostgreSQL)' : 'OFFLINE (Falling back to In-Memory Vector Store)'}`);

  if (pgConnected) {
    console.log('   ✅ PostgreSQL connection established.');
  } else {
    console.log('   ⚠️ PostgreSQL is offline. Vector operations and storage isolation are actively tested via In-Memory Cosine Vector Cache.');
  }

  // 3. Active Embeddings & Vector Compatibility
  console.log('\n----------------------------------------------------------------');
  console.log('3. ACTIVE EMBEDDING PROVIDER & VECTOR COMPATIBILITY');
  console.log('----------------------------------------------------------------');
  const sampleCode = 'export function calculateDiscount(price: number, rate: number): number { return price * (1 - rate); }';
  const sampleQuery = 'discount calculation function';

  console.log(`   Active Provider    : ${embeddingService.getActiveProvider().toUpperCase()}`);
  console.log(`   Model Configured   : ${embeddingService.getActiveModel()}`);
  console.log(`   Target Dimension   : ${embeddingService.getActiveDimension()}`);
  console.log(`   API Key Configured : ${embeddingService.isConfigured() ? 'YES' : 'NO'}`);

  let docEmbeddings: number[][];
  let queryEmbedding: number[];

  if (embeddingService.isConfigured()) {
    console.log('   Running live embedding API call...');
    docEmbeddings = await embeddingService.embedCodeChunks([sampleCode], 'document');
    queryEmbedding = await embeddingService.embedQuery(sampleQuery);
  } else {
    console.log('   ℹ️ Live API key is unconfigured. Generating test-mode normalized 768-dim vectors for database schema and pgvector verification.');
    docEmbeddings = [geminiEmbeddingService.generateDeterministicEmbedding(sampleCode, ENV.EFFECTIVE_EMBEDDING_DIMENSION)];
    queryEmbedding = geminiEmbeddingService.generateDeterministicEmbedding(sampleQuery, ENV.EFFECTIVE_EMBEDDING_DIMENSION);
  }

  assert.strictEqual(docEmbeddings.length, 1, 'Should return 1 document embedding');
  assert.strictEqual(docEmbeddings[0].length, ENV.EFFECTIVE_EMBEDDING_DIMENSION, `Document vector dimension must be ${ENV.EFFECTIVE_EMBEDDING_DIMENSION}`);
  assert.strictEqual(queryEmbedding.length, ENV.EFFECTIVE_EMBEDDING_DIMENSION, `Query vector dimension must be ${ENV.EFFECTIVE_EMBEDDING_DIMENSION}`);

  console.log(`   Generated Doc Vector Dimension   : ${docEmbeddings[0].length} floats`);
  console.log(`   Generated Query Vector Dimension : ${queryEmbedding.length} floats`);

  // Verify vector persistence and search in database layer
  const testRepoId = 'integration-audit-repo';
  const testCommitSha = 'c0ffee112233445566778899aabbccddeeff0011';

  await db.upsertRepository({
    id: testRepoId,
    fullName: 'test/integration-audit-repo',
    name: 'integration-audit-repo',
    url: 'https://github.com/test/integration-audit-repo',
    defaultBranch: 'main',
    description: 'Integration test repo',
    isPrivate: false,
    indexStatus: 'COMPLETED',
    indexedCommitSha: testCommitSha,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const testChunk = {
    id: `${testRepoId}:src/math.ts:1-10`,
    repositoryId: testRepoId,
    commitSha: testCommitSha,
    filePath: 'src/math.ts',
    language: 'typescript',
    startLine: 1,
    endLine: 10,
    symbolName: 'calculateDiscount',
    symbolType: 'method' as const,
    content: sampleCode,
    embedding: docEmbeddings[0]
  };

  await db.saveCodeChunks(testRepoId, [testChunk], testCommitSha);
  const searchResults = await db.searchSimilarChunks(testRepoId, queryEmbedding, 5, testCommitSha);

  assert.strictEqual(searchResults.length, 1, 'Should retrieve stored chunk by similarity');
  assert.strictEqual(searchResults[0].symbolName, 'calculateDiscount');
  assert.ok(searchResults[0].similarity !== undefined && searchResults[0].similarity > 0, 'Similarity score must be positive');
  console.log(`   Vector Search Retrieval          : SUCCESS (Retrieved "${searchResults[0].symbolName}", similarity: ${searchResults[0].similarity?.toFixed(4)})`);
  console.log(`   ✅ ${embeddingService.getActiveProvider().toUpperCase()} embedding schema, dimension (${ENV.EFFECTIVE_EMBEDDING_DIMENSION}), and vector search compatibility verified.`);

  // 4. Commit-Level Data Isolation in Database
  console.log('\n----------------------------------------------------------------');
  console.log('4. COMMIT-LEVEL DATA ISOLATION VERIFICATION');
  console.log('----------------------------------------------------------------');
  const commit1 = '1111111111111111111111111111111111111111';
  const commit2 = '2222222222222222222222222222222222222222';

  const structCommit1 = {
    id: `${testRepoId}:src/service.ts:${commit1}`,
    repositoryId: testRepoId,
    commitSha: commit1,
    filePath: 'src/service.ts',
    language: 'typescript',
    classes: [{ name: 'PaymentServiceV1', kind: 'class', startLine: 1, endLine: 20 }],
    methods: []
  };

  const structCommit2 = {
    id: `${testRepoId}:src/service.ts:${commit2}`,
    repositoryId: testRepoId,
    commitSha: commit2,
    filePath: 'src/service.ts',
    language: 'typescript',
    classes: [{ name: 'PaymentServiceV2', kind: 'class', startLine: 1, endLine: 25 }],
    methods: []
  };

  await db.saveCodeStructures(testRepoId, [structCommit1], commit1);
  await db.saveCodeStructures(testRepoId, [structCommit2], commit2);

  const retrieved1 = await db.getCodeStructures(testRepoId, commit1);
  const retrieved2 = await db.getCodeStructures(testRepoId, commit2);

  assert.strictEqual(retrieved1.length, 1);
  assert.strictEqual(retrieved1[0].classes[0].name, 'PaymentServiceV1');
  assert.strictEqual(retrieved2.length, 1);
  assert.strictEqual(retrieved2[0].classes[0].name, 'PaymentServiceV2');

  console.log(`   Commit 1 (${commit1.substring(0, 7)}) Structures : [${retrieved1[0].classes[0].name}]`);
  console.log(`   Commit 2 (${commit2.substring(0, 7)}) Structures : [${retrieved2[0].classes[0].name}]`);
  console.log('   ✅ Commit-level data isolation verified: multiple revisions of the same repository coexist cleanly without collision.');

  // 5. GitHub Live Read-Only Smoke Test
  console.log('\n----------------------------------------------------------------');
  console.log('5. GITHUB LIVE PR INTEGRATION & REVISION RETRIEVAL');
  console.log('----------------------------------------------------------------');
  const pubOwner = 'expressjs';
  const pubRepo = 'express';
  const pubPrNumber = 7567;

  console.log(`   Fetching Public PR : https://github.com/${pubOwner}/${pubRepo}/pull/${pubPrNumber}`);
  const livePr = await githubService.getPullRequest(pubOwner, pubRepo, pubPrNumber);

  console.log(`   Live PR Title      : ${livePr.title}`);
  console.log(`   Live Base SHA      : ${livePr.baseSha}`);
  console.log(`   Live Head SHA      : ${livePr.headSha}`);
  console.log(`   Live Diff Size     : ${livePr.diff.length} bytes`);

  const diffFiles = diffAnalysisService.parseUnifiedDiff(livePr.diff);
  console.log(`   Parsed Changed Files : ${diffFiles.map(f => f.newPath).join(', ')}`);

  // Verify explicit revision content retrieval
  const targetFile = diffFiles[0]?.newPath || 'Readme.md';
  const revisionContent = await githubService.getFileContentAtRevisions(
    pubOwner,
    pubRepo,
    targetFile,
    livePr.baseSha,
    livePr.headSha,
    diffFiles[0]?.status
  );

  assert.ok(revisionContent.isBaseAvailable, 'Base revision content must be available');
  assert.ok(revisionContent.isHeadAvailable, 'Head revision content must be available');
  console.log(`   Base (${livePr.baseSha.substring(0, 7)}) Content Available : ${revisionContent.isBaseAvailable} (${revisionContent.baseContent?.length} bytes)`);
  console.log(`   Head (${livePr.headSha.substring(0, 7)}) Content Available : ${revisionContent.isHeadAvailable} (${revisionContent.headContent?.length} bytes)`);
  console.log('   ✅ GitHub live PR metadata and revision-specific source retrieval verified.');

  // 6. Gemini AI Review Engine Execution
  console.log('\n----------------------------------------------------------------');
  console.log('6. GEMINI PR REVIEW ENGINE & RESPONSE PARSING');
  console.log('----------------------------------------------------------------');
  console.log(`   Model Target        : ${ENV.GEMINI_MODEL}`);
  console.log(`   Mode                : ${geminiService.isConfigured() ? 'Live Gemini Model API' : 'Deterministic Heuristic Fallback'}`);

  const reviewResult = await geminiService.reviewPullRequest({
    prTitle: livePr.title,
    prNumber: livePr.prNumber,
    prUrl: livePr.prUrl,
    diff: livePr.diff,
    relevantChunks: searchResults,
    confirmedCallers: [],
    relevantTests: [],
    behaviorRisks: [],
    affectedFiles: [{
      filePath: targetFile,
      additions: diffFiles[0]?.additions || 1,
      deletions: diffFiles[0]?.deletions || 1,
      impactLevel: 'LOW'
    }],
    frameworkInfo: { language: 'markdown', testFramework: 'N/A' }
  });

  assert.ok(reviewResult.overallResult, 'Review must have an overall result');
  assert.ok(reviewResult.summaryText, 'Review must have summaryText');
  assert.ok(Array.isArray(reviewResult.findings), 'Review findings must be an array');
  assert.ok(reviewResult.impactReport, 'Review must have impactReport');

  console.log(`   Overall Result      : ${reviewResult.overallResult}`);
  console.log(`   Findings Detected   : ${reviewResult.findings.length}`);
  console.log(`   Summary Snippet     : ${reviewResult.summaryText.substring(0, 120)}...`);
  console.log('   ✅ Review engine parsed response and constructed structured output successfully.');

  // 7. Full Persistence Path Verification
  console.log('\n----------------------------------------------------------------');
  console.log('7. PERSISTENCE & RETRIEVAL OF PR ANALYSIS');
  console.log('----------------------------------------------------------------');
  const analysisId = `pr-audit-${Date.now()}`;
  const analysisRecord = {
    id: analysisId,
    repositoryId: `${pubOwner}/${pubRepo}`,
    prNumber: pubPrNumber,
    prTitle: livePr.title,
    prUrl: livePr.prUrl,
    baseSha: livePr.baseSha,
    headSha: livePr.headSha,
    status: 'COMPLETED' as const,
    overallResult: reviewResult.overallResult,
    criticalCount: reviewResult.criticalCount,
    highCount: reviewResult.highCount,
    mediumCount: reviewResult.mediumCount,
    lowCount: reviewResult.lowCount,
    infoCount: reviewResult.infoCount,
    summaryText: reviewResult.summaryText,
    limitations: reviewResult.limitations,
    structuralAnalysisAvailable: false,
    createdAt: new Date().toISOString()
  };

  await db.savePullRequestAnalysis(analysisRecord);
  const fetchedAnalysis = await inMemoryDb.getPullRequestAnalysis(analysisId);
  assert.strictEqual(fetchedAnalysis?.id, analysisId);
  assert.strictEqual(fetchedAnalysis?.prNumber, pubPrNumber);
  console.log(`   Saved and Retrieved Analysis ID : ${fetchedAnalysis?.id} (#${fetchedAnalysis?.prNumber})`);
  console.log('   ✅ Complete end-to-end PR analysis lifecycle persisted and retrieved successfully.');

  console.log('\n================================================================');
  console.log('🎉 ALL INTEGRATION AUDIT CHECKS FINISHED');
  console.log('================================================================\n');
}

runIntegrationAudit().catch((err) => {
  console.error('❌ Integration Audit Failed:', err);
  process.exit(1);
});
