import { db } from '../db/pgvector.js';
import { githubService } from './github.service.js';
import { codeChunkerService } from './chunker.service.js';
import { embeddingService } from './embedding.service.js';

export class IndexerService {
  private activeIndexing = new Set<string>();

  /**
   * Starts background indexing pipeline for a repository
   */
  async triggerIndexing(repositoryId: string): Promise<void> {
    // Check and recover any stale/timed-out indexing jobs first
    await db.recoverStaleIndexingJobs();

    const repo = await db.getRepositoryById(repositoryId);
    if (!repo) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    if (this.activeIndexing.has(repositoryId)) {
      console.log(`ℹ️ [Indexer] Repository ${repositoryId} is already being indexed.`);
      return;
    }

    this.activeIndexing.add(repositoryId);
    await db.updateRepositoryStatus(repositoryId, 'INDEXING');

    // Run in background
    (async () => {
      try {
        console.log(`🚀 [Indexer] Starting indexing pipeline for ${repositoryId}...`);

        // 1. Parse GitHub owner and repo name
        const { owner, repo: repoName } = githubService.parseGitHubUrl(repo.url);

        // 2. Clone or pull repository
        const { localPath, headSha } = await githubService.cloneOrUpdateRepo(owner, repoName);
        console.log(`📦 [Indexer] Cloned ${repositoryId} at commit ${headSha.substring(0, 7)}`);
        await db.touchRepositoryHeartbeat(repositoryId);

        // 3. Extract AST structural skeleton and code chunks
        console.log(`🔍 [Indexer] Parsing files and structural AST at commit ${headSha.substring(0, 7)}...`);
        const { chunks, structures } = await codeChunkerService.processRepositoryFiles(localPath, repositoryId, 600, headSha);
        console.log(`📊 [Indexer] Extracted ${structures.length} files and ${chunks.length} chunks.`);
        await db.touchRepositoryHeartbeat(repositoryId);

        // SKELETON-FIRST INDEXING: Save structural AST skeleton immediately before vector embedding
        console.log(`💾 [Indexer] [Skeleton-First] Persisting ${structures.length} AST structural records for commit ${headSha.substring(0, 7)}...`);
        await db.saveCodeStructures(repositoryId, structures, headSha);
        await db.touchRepositoryHeartbeat(repositoryId);

        // 4. Generate embeddings via configured provider (Google Gemini API by default)
        const providerName = embeddingService.getActiveProvider().toUpperCase();
        const modelName = embeddingService.getActiveModel();
        console.log(`🧠 [Indexer] Generating ${providerName} embeddings (${modelName}) for ${chunks.length} chunks...`);
        const chunkItems = chunks.map((c) => ({
          text: c.content,
          title: `${c.filePath} (${c.symbolName})`
        }));
        const embeddings = await embeddingService.embedCodeChunks(chunkItems, 'document');
        await db.touchRepositoryHeartbeat(repositoryId);

        // Attach embeddings to chunks
        chunks.forEach((chunk, idx) => {
          chunk.embedding = embeddings[idx];
        });

        // 5. Persist to PostgreSQL + PGVector
        console.log(`💾 [Indexer] Storing code chunks and vectors for commit ${headSha.substring(0, 7)} in PGVector...`);
        await db.saveCodeChunks(repositoryId, chunks, headSha);
        await db.touchRepositoryHeartbeat(repositoryId);

        // 6. Complete
        await db.updateRepositoryStatus(repositoryId, 'COMPLETED', headSha);
        console.log(`✅ [Indexer] Successfully completed indexing for ${repositoryId}!`);
      } catch (err: any) {
        console.error(`❌ [Indexer] Failed indexing ${repositoryId}:`, err.message);
        await db.updateRepositoryStatus(repositoryId, 'FAILED', undefined, err.message);
      } finally {
        this.activeIndexing.delete(repositoryId);
      }
    })();
  }
}

export const indexerService = new IndexerService();
