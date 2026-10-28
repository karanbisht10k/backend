import pg from 'pg';
import { ENV } from '../config/env.js';
import {
  Repository,
  CodeChunk,
  CodeStructure,
  PullRequestAnalysis,
  PrFinding,
  PrImpactReport,
  ChatSession,
  ChatMessage,
  User,
  UserSession
} from '../types/index.js';
import { inMemoryDb } from './memoryVector.js';

const { Pool } = pg;

export class PgVectorDatabase {
  private pool: pg.Pool | null = null;
  private isConnected = false;
  private hasPgVector = false;

  constructor() {
    this.initPool();
  }

  private initPool() {
    try {
      this.pool = new Pool({
        connectionString: ENV.DATABASE_URL,
        ssl: ENV.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 5000
      });

      this.pool.on('error', (err) => {
        console.warn('⚠️  [PGVector] Database connection error:', err.message);
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Could not initialize Postgres pool:', err.message);
      this.pool = null;
    }
  }

  async initialize(): Promise<void> {
    if (!this.pool) return;

    try {
      const client = await this.pool.connect();
      try {
        // Try enabling pgvector extension
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
          this.hasPgVector = true;
          console.log('✅ [PGVector] PostgreSQL extension "vector" verified.');
        } catch (vecErr: any) {
          console.warn('⚠️  [PGVector] "vector" extension could not be enabled:', vecErr.message);
        }

        const dim = ENV.EFFECTIVE_EMBEDDING_DIMENSION;

        // Create tables
        await client.query(`
          CREATE TABLE IF NOT EXISTS repositories (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            url TEXT NOT NULL,
            default_branch VARCHAR(100) DEFAULT 'main',
            description TEXT,
            is_private BOOLEAN DEFAULT false,
            index_status VARCHAR(50) DEFAULT 'PENDING',
            indexed_commit_sha VARCHAR(100),
            indexing_started_at TIMESTAMP WITH TIME ZONE,
            indexing_error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          ALTER TABLE repositories ADD COLUMN IF NOT EXISTS indexing_started_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE repositories ADD COLUMN IF NOT EXISTS indexing_error TEXT;

          CREATE TABLE IF NOT EXISTS code_structures (
            id VARCHAR(255) PRIMARY KEY,
            repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            language VARCHAR(50),
            package_name TEXT,
            imports_json JSONB DEFAULT '[]'::jsonb,
            classes_json JSONB,
            methods_json JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          ALTER TABLE code_structures ADD COLUMN IF NOT EXISTS imports_json JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE code_structures ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(100);
          CREATE INDEX IF NOT EXISTS code_structures_repo_commit_idx ON code_structures(repository_id, commit_sha);

          CREATE TABLE IF NOT EXISTS pull_requests (
            id VARCHAR(255) PRIMARY KEY,
            repository_id VARCHAR(255),
            pr_number INT,
            pr_title TEXT,
            pr_url TEXT,
            base_sha VARCHAR(100),
            head_sha VARCHAR(100),
            status VARCHAR(50) DEFAULT 'PENDING',
            overall_result VARCHAR(50),
            critical_count INT DEFAULT 0,
            high_count INT DEFAULT 0,
            medium_count INT DEFAULT 0,
            low_count INT DEFAULT 0,
            info_count INT DEFAULT 0,
            summary_text TEXT,
            limitations TEXT,
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS pr_findings (
            id VARCHAR(255) PRIMARY KEY,
            analysis_id VARCHAR(255) REFERENCES pull_requests(id) ON DELETE CASCADE,
            severity VARCHAR(20),
            category VARCHAR(50),
            title TEXT,
            file_path TEXT,
            line_range VARCHAR(50),
            confidence INT,
            description TEXT,
            diff_snippet TEXT,
            suggested_fix TEXT,
            impact_explanation TEXT,
            test_recipe TEXT
          );

          CREATE TABLE IF NOT EXISTS pr_impacts (
            id VARCHAR(255) PRIMARY KEY,
            analysis_id VARCHAR(255) REFERENCES pull_requests(id) ON DELETE CASCADE,
            affected_files_json JSONB,
            caller_hierarchy_json JSONB,
            relevant_tests_json JSONB,
            behavior_risks_json JSONB
          );

          ALTER TABLE pr_impacts ADD COLUMN IF NOT EXISTS symbol_impacts_json JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE pr_impacts ADD COLUMN IF NOT EXISTS behavior_changes_json JSONB DEFAULT '[]'::jsonb;
          ALTER TABLE pr_impacts ADD COLUMN IF NOT EXISTS dependency_graph_json JSONB DEFAULT '{}'::jsonb;
          ALTER TABLE pr_impacts ADD COLUMN IF NOT EXISTS repository_id VARCHAR(255);
          ALTER TABLE pr_impacts ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(100);
          ALTER TABLE pr_impacts ADD COLUMN IF NOT EXISTS overview TEXT;
          ALTER TABLE pr_impacts ADD COLUMN IF NOT EXISTS limitations TEXT;

          CREATE TABLE IF NOT EXISTS chat_sessions (
            id VARCHAR(255) PRIMARY KEY,
            repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
            title TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS chat_messages (
            id VARCHAR(255) PRIMARY KEY,
            session_id VARCHAR(255) REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            citations_json JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            github_id VARCHAR(100) UNIQUE NOT NULL,
            login VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            email VARCHAR(255),
            avatar_url TEXT,
            access_token TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS user_sessions (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
        `);

        // If vector extension exists, create or migrate vector table
        if (this.hasPgVector) {
          // Check if code_chunks already exists with a different vector dimension
          try {
            const dimCheck = await client.query(`
              SELECT format_type(atttypid, atttypmod) as col_type
              FROM pg_attribute
              WHERE attrelid = 'code_chunks'::regclass AND attname = 'embedding';
            `);
            if (dimCheck.rows.length > 0) {
              const currentType = dimCheck.rows[0].col_type;
              const targetType = `vector(${dim})`;
              if (currentType && currentType !== targetType && currentType.startsWith('vector')) {
                console.log(`🔄 [PGVector] Migrating embedding column from ${currentType} to ${targetType}...`);
                // Clear stale embeddings from previous model to prevent dimensional mismatch
                await client.query(`DROP INDEX IF EXISTS code_chunks_embedding_hnsw_idx;`);
                await client.query(`UPDATE code_chunks SET embedding = NULL WHERE embedding IS NOT NULL;`);
                await client.query(`ALTER TABLE code_chunks ALTER COLUMN embedding TYPE vector(${dim});`);
                if (dim <= 2000) {
                  await client.query(`CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw_idx ON code_chunks USING hnsw (embedding vector_cosine_ops);`);
                }
                console.log(`✅ [PGVector] Embedding column successfully migrated to ${targetType}.`);
              }
            }
          } catch {
            // Table does not exist yet; safe to proceed with standard creation
          }

          await client.query(`
            CREATE TABLE IF NOT EXISTS code_chunks (
              id VARCHAR(255) PRIMARY KEY,
              repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
              file_path TEXT NOT NULL,
              language VARCHAR(50),
              start_line INT,
              end_line INT,
              symbol_name TEXT,
              symbol_type VARCHAR(50),
              content TEXT,
              embedding_model VARCHAR(100),
              embedding vector(${dim}),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS code_chunks_repo_idx ON code_chunks(repository_id);
          `);
          if (dim <= 2000) {
            try {
              await client.query(`CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw_idx ON code_chunks USING hnsw (embedding vector_cosine_ops);`);
            } catch (hnswErr: any) {
              console.warn('⚠️ [PGVector] HNSW index creation note:', hnswErr.message);
            }
          }
        } else {
          await client.query(`
            CREATE TABLE IF NOT EXISTS code_chunks (
              id VARCHAR(255) PRIMARY KEY,
              repository_id VARCHAR(255) REFERENCES repositories(id) ON DELETE CASCADE,
              file_path TEXT NOT NULL,
              language VARCHAR(50),
              start_line INT,
              end_line INT,
              symbol_name TEXT,
              symbol_type VARCHAR(50),
              content TEXT,
              embedding_model VARCHAR(100),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
        }
        await client.query(`
          ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS commit_sha VARCHAR(100);
          ALTER TABLE code_chunks ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100);
          CREATE INDEX IF NOT EXISTS code_chunks_repo_commit_idx ON code_chunks(repository_id, commit_sha);
        `);

        if (this.hasPgVector) {
          try {
            await client.query(`
              CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw_idx 
              ON code_chunks USING hnsw (embedding vector_cosine_ops);
            `);
          } catch {
            // Index creation can be skipped safely if vector extension doesn't support hnsw
          }
        }

        // Recover any indexing jobs that were interrupted by a server restart or crash
        try {
          const recoveryResult = await client.query(`
            UPDATE repositories
            SET index_status = 'FAILED',
                indexing_error = 'Indexing process was interrupted by server restart or process termination. Safe to retry.',
                updated_at = NOW()
            WHERE index_status = 'INDEXING'
            RETURNING id;
          `);
          if (recoveryResult.rows.length > 0) {
            console.log(`🔄 [PGVector] Recovered ${recoveryResult.rows.length} interrupted indexing job(s) on server startup:`, recoveryResult.rows.map((r: any) => r.id).join(', '));
          }
        } catch (recErr: any) {
          console.warn('⚠️  [PGVector] Interrupted jobs recovery check skipped:', recErr.message);
        }

        this.isConnected = true;
        console.log('✅ [PGVector] PostgreSQL schema initialized successfully.');
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('⚠️  [PGVector] PostgreSQL initialization skipped or failed:', err.message);
      console.warn('ℹ️  [PGVector] Running with In-Memory Vector Store fallback.');
      this.isConnected = false;
    }
  }

  isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  // REPOSITORIES
  async upsertRepository(repo: Repository): Promise<Repository> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.upsertRepository(repo);
    }
    try {
      const query = `
        INSERT INTO repositories (id, name, full_name, url, default_branch, description, is_private, index_status, indexed_commit_sha, indexing_started_at, indexing_error, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          full_name = EXCLUDED.full_name,
          url = EXCLUDED.url,
          default_branch = EXCLUDED.default_branch,
          description = EXCLUDED.description,
          is_private = EXCLUDED.is_private,
          index_status = EXCLUDED.index_status,
          indexed_commit_sha = EXCLUDED.indexed_commit_sha,
          indexing_started_at = COALESCE(EXCLUDED.indexing_started_at, repositories.indexing_started_at),
          indexing_error = EXCLUDED.indexing_error,
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `;
      const res = await this.pool.query(query, [
        repo.id,
        repo.name,
        repo.fullName,
        repo.url,
        repo.defaultBranch,
        repo.description || '',
        repo.isPrivate || false,
        repo.indexStatus,
        repo.indexedCommitSha || null,
        repo.indexingStartedAt || null,
        repo.indexingError || null,
        repo.createdAt || new Date().toISOString(),
        repo.updatedAt || new Date().toISOString()
      ]);
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        url: r.url,
        defaultBranch: r.default_branch,
        description: r.description,
        isPrivate: r.is_private,
        indexStatus: r.index_status,
        indexedCommitSha: r.indexed_commit_sha,
        indexingStartedAt: r.indexing_started_at ? new Date(r.indexing_started_at).toISOString() : undefined,
        indexingError: r.indexing_error || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    } catch {
      return inMemoryDb.upsertRepository(repo);
    }
  }

  async getRepositories(): Promise<Repository[]> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getRepositories();
    }
    try {
      const res = await this.pool.query('SELECT * FROM repositories ORDER BY created_at DESC');
      return res.rows.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        url: r.url,
        defaultBranch: r.default_branch,
        description: r.description,
        isPrivate: r.is_private,
        indexStatus: r.index_status,
        indexedCommitSha: r.indexed_commit_sha,
        indexingStartedAt: r.indexing_started_at ? new Date(r.indexing_started_at).toISOString() : undefined,
        indexingError: r.indexing_error || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch {
      return inMemoryDb.getRepositories();
    }
  }

  async getRepositoryById(id: string): Promise<Repository | null> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getRepositoryById(id);
    }
    try {
      const res = await this.pool.query('SELECT * FROM repositories WHERE id = $1', [id]);
      if (!res.rows.length) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        url: r.url,
        defaultBranch: r.default_branch,
        description: r.description,
        isPrivate: r.is_private,
        indexStatus: r.index_status,
        indexedCommitSha: r.indexed_commit_sha,
        indexingStartedAt: r.indexing_started_at ? new Date(r.indexing_started_at).toISOString() : undefined,
        indexingError: r.indexing_error || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    } catch {
      return inMemoryDb.getRepositoryById(id);
    }
  }

  async updateRepositoryStatus(
    id: string,
    status: Repository['indexStatus'],
    commitSha?: string,
    errorMessage?: string
  ): Promise<void> {
    inMemoryDb.updateRepositoryStatus(id, status, commitSha, errorMessage);
    if (!this.isConnected || !this.pool) return;
    try {
      if (status === 'INDEXING') {
        await this.pool.query(
          `UPDATE repositories 
           SET index_status = $1, 
               indexing_started_at = NOW(), 
               indexing_error = NULL, 
               indexed_commit_sha = COALESCE($2, indexed_commit_sha), 
               updated_at = NOW() 
           WHERE id = $3`,
          [status, commitSha || null, id]
        );
      } else if (status === 'FAILED') {
        await this.pool.query(
          `UPDATE repositories 
           SET index_status = $1, 
               indexing_error = $2, 
               updated_at = NOW() 
           WHERE id = $3`,
          [status, errorMessage || 'Indexing failed', id]
        );
      } else if (status === 'COMPLETED') {
        await this.pool.query(
          `UPDATE repositories 
           SET index_status = $1, 
               indexing_error = NULL, 
               indexed_commit_sha = COALESCE($2, indexed_commit_sha), 
               updated_at = NOW() 
           WHERE id = $3`,
          [status, commitSha || null, id]
        );
      } else {
        await this.pool.query(
          `UPDATE repositories 
           SET index_status = $1, 
               indexed_commit_sha = COALESCE($2, indexed_commit_sha), 
               updated_at = NOW() 
           WHERE id = $3`,
          [status, commitSha || null, id]
        );
      }
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Failed updating repository status in Postgres:', err.message);
    }
  }

  async touchRepositoryHeartbeat(repositoryId: string): Promise<void> {
    inMemoryDb.touchRepositoryHeartbeat(repositoryId);
    if (!this.isConnected || !this.pool) return;
    try {
      await this.pool.query(
        `UPDATE repositories SET updated_at = NOW() WHERE id = $1 AND index_status = 'INDEXING'`,
        [repositoryId]
      );
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Heartbeat update error:', err.message);
    }
  }

  async recoverStaleIndexingJobs(timeoutMs: number = ENV.INDEXING_TIMEOUT_MS): Promise<number> {
    const memRecovered = inMemoryDb.recoverStaleIndexingJobs(timeoutMs);
    if (!this.isConnected || !this.pool) return memRecovered;
    try {
      const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
      const timeoutInterval = `${timeoutSeconds} seconds`;
      const res = await this.pool.query(
        `UPDATE repositories
         SET index_status = 'FAILED',
             indexing_error = $1,
             updated_at = NOW()
         WHERE index_status = 'INDEXING'
           AND (NOW() - updated_at) > $2::interval
         RETURNING id;`,
        [
          `Indexing job timed out after ${Math.round(timeoutMs / 60000)} minutes of inactivity. Safe to retry.`,
          timeoutInterval
        ]
      );
      if (res.rows.length > 0) {
        console.log(`⏱️  [PGVector] Recovered ${res.rows.length} timed-out indexing job(s):`, res.rows.map((r: any) => r.id).join(', '));
      }
      return res.rows.length;
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Error running recoverStaleIndexingJobs:', err.message);
      return 0;
    }
  }

  // CODE CHUNKS & VECTOR SIMILARITY SEARCH
  async saveCodeChunks(repositoryId: string, chunks: CodeChunk[], commitSha?: string): Promise<void> {
    inMemoryDb.saveCodeChunks(repositoryId, chunks, commitSha);
    if (!this.isConnected || !this.pool || !chunks.length) return;

    const client = await this.pool.connect();
    try {
      // Ensure column dimension matches active embeddings
      if (this.hasPgVector) {
        const sampleChunk = chunks.find((c) => c.embedding && c.embedding.length > 0);
        if (sampleChunk && sampleChunk.embedding) {
          const sampleDim = sampleChunk.embedding.length;
          try {
            const dimCheck = await client.query(`
              SELECT format_type(atttypid, atttypmod) as col_type
              FROM pg_attribute
              WHERE attrelid = 'code_chunks'::regclass AND attname = 'embedding';
            `);
            if (dimCheck.rows.length > 0) {
              const currentType = dimCheck.rows[0].col_type;
              const targetType = `vector(${sampleDim})`;
              if (currentType && currentType !== targetType && currentType.startsWith('vector')) {
                console.log(`🔄 [PGVector] Dynamic schema update: changing embedding column from ${currentType} to ${targetType}...`);
                await client.query(`DROP INDEX IF EXISTS code_chunks_embedding_hnsw_idx;`);
                await client.query(`UPDATE code_chunks SET embedding = NULL;`);
                await client.query(`ALTER TABLE code_chunks ALTER COLUMN embedding TYPE vector(${sampleDim});`);
                if (sampleDim <= 2000) {
                  await client.query(`CREATE INDEX IF NOT EXISTS code_chunks_embedding_hnsw_idx ON code_chunks USING hnsw (embedding vector_cosine_ops);`);
                }
                console.log(`✅ [PGVector] Dynamic schema update complete: ${targetType}`);
              }
            }
          } catch (migErr: any) {
            console.warn('⚠️ [PGVector] Dynamic migration check note:', migErr.message);
          }
        }
      }

      await client.query('BEGIN');

      if (commitSha) {
        await client.query('DELETE FROM code_chunks WHERE repository_id = $1 AND commit_sha = $2', [repositoryId, commitSha]);
      } else {
        await client.query('DELETE FROM code_chunks WHERE repository_id = $1 AND commit_sha IS NULL', [repositoryId]);
      }

      const activeEmbeddingModel = ENV.EFFECTIVE_EMBEDDING_MODEL;
      for (const chunk of chunks) {
        const cSha = commitSha || chunk.commitSha || null;
        if (this.hasPgVector && chunk.embedding && chunk.embedding.length > 0) {
          const vectorStr = `[${chunk.embedding.join(',')}]`;
          await client.query(
            `INSERT INTO code_chunks (id, repository_id, commit_sha, file_path, language, start_line, end_line, symbol_name, symbol_type, content, embedding_model, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector)`,
            [
              chunk.id,
              chunk.repositoryId,
              cSha,
              chunk.filePath,
              chunk.language,
              chunk.startLine,
              chunk.endLine,
              chunk.symbolName,
              chunk.symbolType,
              chunk.content,
              activeEmbeddingModel,
              vectorStr
            ]
          );
        } else {
          await client.query(
            `INSERT INTO code_chunks (id, repository_id, commit_sha, file_path, language, start_line, end_line, symbol_name, symbol_type, content, embedding_model)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              chunk.id,
              chunk.repositoryId,
              cSha,
              chunk.filePath,
              chunk.language,
              chunk.startLine,
              chunk.endLine,
              chunk.symbolName,
              chunk.symbolType,
              chunk.content,
              activeEmbeddingModel
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.warn('⚠️  [PGVector] Save chunks transaction rolled back due to error:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  async searchSimilarChunks(repositoryId: string, queryEmbedding: number[], limit = 6, commitSha?: string): Promise<CodeChunk[]> {
    if (!this.isConnected || !this.pool || !this.hasPgVector || !queryEmbedding.length) {
      return inMemoryDb.searchSimilarChunks(repositoryId, queryEmbedding, limit, commitSha);
    }

    try {
      const vectorStr = `[${queryEmbedding.join(',')}]`;
      let query = `
        SELECT id, repository_id, commit_sha, file_path, language, start_line, end_line, symbol_name, symbol_type, content,
               1 - (embedding <=> $1::vector) AS similarity
        FROM code_chunks
        WHERE repository_id = $2 AND embedding IS NOT NULL
      `;
      const params: any[] = [vectorStr, repositoryId];
      if (commitSha) {
        query += ` AND (commit_sha = $4 OR commit_sha IS NULL) `;
      }
      query += ` ORDER BY embedding <=> $1::vector ASC LIMIT $3;`;
      params.splice(2, 0, limit);
      if (commitSha) {
        params.push(commitSha);
      }

      const res = await this.pool.query(query, params);
      return res.rows.map((r) => ({
        id: r.id,
        repositoryId: r.repository_id,
        commitSha: r.commit_sha,
        filePath: r.file_path,
        language: r.language,
        startLine: r.start_line,
        endLine: r.end_line,
        symbolName: r.symbol_name,
        symbolType: r.symbol_type,
        content: r.content,
        similarity: parseFloat(r.similarity)
      }));
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Similarity search error, falling back to memory store:', err.message);
      return inMemoryDb.searchSimilarChunks(repositoryId, queryEmbedding, limit, commitSha);
    }
  }

  // CODE STRUCTURES
  async saveCodeStructures(repositoryId: string, structures: CodeStructure[], commitSha?: string): Promise<void> {
    inMemoryDb.saveCodeStructures(repositoryId, structures, commitSha);
    if (!this.isConnected || !this.pool || !structures.length) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      if (commitSha) {
        await client.query('DELETE FROM code_structures WHERE repository_id = $1 AND commit_sha = $2', [repositoryId, commitSha]);
      } else {
        await client.query('DELETE FROM code_structures WHERE repository_id = $1 AND commit_sha IS NULL', [repositoryId]);
      }

      for (const s of structures) {
        const cSha = commitSha || s.commitSha || null;
        await client.query(
          `INSERT INTO code_structures (id, repository_id, commit_sha, file_path, language, package_name, imports_json, classes_json, methods_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            s.id,
            s.repositoryId,
            cSha,
            s.filePath,
            s.language,
            s.packageName || '',
            JSON.stringify(s.imports || []),
            JSON.stringify(s.classes || []),
            JSON.stringify(s.methods || [])
          ]
        );
      }

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.warn('⚠️  [PGVector] Save code structures transaction rolled back due to error:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

  async getCodeStructures(repositoryId: string, commitSha?: string): Promise<CodeStructure[]> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getCodeStructures(repositoryId, commitSha);
    }
    try {
      if (commitSha) {
        const res = await this.pool.query(
          'SELECT * FROM code_structures WHERE repository_id = $1 AND commit_sha = $2 ORDER BY file_path ASC',
          [repositoryId, commitSha]
        );
        if (res.rows.length > 0) {
          return res.rows.map((r) => ({
            id: r.id,
            repositoryId: r.repository_id,
            commitSha: r.commit_sha,
            filePath: r.file_path,
            language: r.language,
            packageName: r.package_name,
            imports: r.imports_json || [],
            classes: r.classes_json || [],
            methods: r.methods_json || []
          }));
        }
      }

      const res = await this.pool.query(
        'SELECT * FROM code_structures WHERE repository_id = $1 ORDER BY file_path ASC',
        [repositoryId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        repositoryId: r.repository_id,
        commitSha: r.commit_sha,
        filePath: r.file_path,
        language: r.language,
        packageName: r.package_name,
        imports: r.imports_json || [],
        classes: r.classes_json || [],
        methods: r.methods_json || []
      }));
    } catch {
      return inMemoryDb.getCodeStructures(repositoryId, commitSha);
    }
  }

  // PULL REQUEST ANALYSES & FINDINGS
  async savePullRequestAnalysis(analysis: PullRequestAnalysis): Promise<PullRequestAnalysis> {
    inMemoryDb.savePullRequestAnalysis(analysis);
    if (!this.isConnected || !this.pool) return analysis;

    try {
      const query = `
        INSERT INTO pull_requests (
          id, repository_id, pr_number, pr_title, pr_url, base_sha, head_sha, status,
          overall_result, critical_count, high_count, medium_count, low_count, info_count,
          summary_text, limitations, error_message, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          overall_result = EXCLUDED.overall_result,
          critical_count = EXCLUDED.critical_count,
          high_count = EXCLUDED.high_count,
          medium_count = EXCLUDED.medium_count,
          low_count = EXCLUDED.low_count,
          info_count = EXCLUDED.info_count,
          summary_text = EXCLUDED.summary_text,
          limitations = EXCLUDED.limitations,
          error_message = EXCLUDED.error_message
        RETURNING *;
      `;
      await this.pool.query(query, [
        analysis.id,
        analysis.repositoryId || null,
        analysis.prNumber,
        analysis.prTitle,
        analysis.prUrl,
        analysis.baseSha || '',
        analysis.headSha || '',
        analysis.status,
        analysis.overallResult || 'REVIEW_PENDING',
        analysis.criticalCount || 0,
        analysis.highCount || 0,
        analysis.mediumCount || 0,
        analysis.lowCount || 0,
        analysis.infoCount || 0,
        analysis.summaryText || '',
        analysis.limitations || '',
        analysis.errorMessage || null,
        analysis.createdAt || new Date().toISOString()
      ]);
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Save PR analysis error:', err.message);
    }
    return analysis;
  }

  async getPullRequestAnalysis(id: string): Promise<PullRequestAnalysis | null> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getPullRequestAnalysis(id);
    }
    try {
      const res = await this.pool.query('SELECT * FROM pull_requests WHERE id = $1', [id]);
      if (!res.rows.length) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        repositoryId: r.repository_id,
        prNumber: r.pr_number,
        prTitle: r.pr_title,
        prUrl: r.pr_url,
        baseSha: r.base_sha,
        headSha: r.head_sha,
        status: r.status,
        overallResult: r.overall_result,
        criticalCount: r.critical_count,
        highCount: r.high_count,
        mediumCount: r.medium_count,
        lowCount: r.low_count,
        infoCount: r.info_count,
        summaryText: r.summary_text,
        limitations: r.limitations,
        errorMessage: r.error_message,
        createdAt: r.created_at
      };
    } catch {
      return inMemoryDb.getPullRequestAnalysis(id);
    }
  }

  async getPullRequestsByRepo(repoId: string): Promise<PullRequestAnalysis[]> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getPullRequestsByRepo(repoId);
    }
    try {
      const query = repoId
        ? 'SELECT * FROM pull_requests WHERE repository_id = $1 ORDER BY created_at DESC'
        : 'SELECT * FROM pull_requests ORDER BY created_at DESC';
      const params = repoId ? [repoId] : [];
      const res = await this.pool.query(query, params);
      return res.rows.map((r) => ({
        id: r.id,
        repositoryId: r.repository_id,
        prNumber: r.pr_number,
        prTitle: r.pr_title,
        prUrl: r.pr_url,
        baseSha: r.base_sha,
        headSha: r.head_sha,
        status: r.status,
        overallResult: r.overall_result,
        criticalCount: r.critical_count,
        highCount: r.high_count,
        mediumCount: r.medium_count,
        lowCount: r.low_count,
        infoCount: r.info_count,
        summaryText: r.summary_text,
        limitations: r.limitations,
        errorMessage: r.error_message,
        createdAt: r.created_at
      }));
    } catch {
      return inMemoryDb.getPullRequestsByRepo(repoId);
    }
  }

  async savePrFindings(analysisId: string, findings: PrFinding[]): Promise<void> {
    inMemoryDb.savePrFindings(analysisId, findings);
    if (!this.isConnected || !this.pool || !findings.length) return;

    try {
      await this.pool.query('DELETE FROM pr_findings WHERE analysis_id = $1', [analysisId]);
      for (const f of findings) {
        await this.pool.query(
          `INSERT INTO pr_findings (
            id, analysis_id, severity, category, title, file_path, line_range, confidence,
            description, diff_snippet, suggested_fix, impact_explanation, test_recipe
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            f.id,
            f.analysisId,
            f.severity,
            f.category,
            f.title,
            f.filePath,
            f.lineRange,
            f.confidence,
            f.description,
            f.diffSnippet || '',
            f.suggestedFix || '',
            f.impactExplanation || '',
            f.testRecipe || ''
          ]
        );
      }
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Save PR findings error:', err.message);
    }
  }

  async getPrFindings(analysisId: string): Promise<PrFinding[]> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getPrFindings(analysisId);
    }
    try {
      const res = await this.pool.query('SELECT * FROM pr_findings WHERE analysis_id = $1', [analysisId]);
      return res.rows.map((r) => ({
        id: r.id,
        analysisId: r.analysis_id,
        severity: r.severity,
        category: r.category,
        title: r.title,
        filePath: r.file_path,
        lineRange: r.line_range,
        confidence: r.confidence,
        description: r.description,
        diffSnippet: r.diff_snippet,
        suggestedFix: r.suggested_fix,
        impactExplanation: r.impact_explanation,
        testRecipe: r.test_recipe
      }));
    } catch {
      return inMemoryDb.getPrFindings(analysisId);
    }
  }

  async savePrImpact(impact: PrImpactReport): Promise<void> {
    const aId = impact.analysisId || (impact as any).pullRequestId;
    const impactWithId = { ...impact, analysisId: aId, pullRequestId: aId };
    inMemoryDb.savePrImpact(impactWithId);
    if (!this.isConnected || !this.pool || !aId) return;

    try {
      await this.pool.query(
        `INSERT INTO pr_impacts (
           id, analysis_id, affected_files_json, caller_hierarchy_json, relevant_tests_json, behavior_risks_json,
           symbol_impacts_json, behavior_changes_json, dependency_graph_json, repository_id, commit_sha, overview, limitations
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           affected_files_json = EXCLUDED.affected_files_json,
           caller_hierarchy_json = EXCLUDED.caller_hierarchy_json,
           relevant_tests_json = EXCLUDED.relevant_tests_json,
           behavior_risks_json = EXCLUDED.behavior_risks_json,
           symbol_impacts_json = EXCLUDED.symbol_impacts_json,
           behavior_changes_json = EXCLUDED.behavior_changes_json,
           dependency_graph_json = EXCLUDED.dependency_graph_json,
           repository_id = EXCLUDED.repository_id,
           commit_sha = EXCLUDED.commit_sha,
           overview = EXCLUDED.overview,
           limitations = EXCLUDED.limitations`,
        [
          aId,
          aId,
          JSON.stringify(impact.affectedFiles || []),
          JSON.stringify(impact.callerHierarchy || []),
          JSON.stringify(impact.relevantTests || []),
          JSON.stringify(impact.behaviorRisks || []),
          JSON.stringify(impact.symbolImpacts || []),
          JSON.stringify(impact.behaviorChanges || []),
          JSON.stringify(impact.dependencyGraph || { nodes: [], edges: [] }),
          impact.repositoryId || null,
          impact.headSha || null,
          impact.overview || null,
          impact.limitations || null
        ]
      );
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Save PR impact error:', err.message);
    }
  }

  async getPrImpact(analysisId: string): Promise<PrImpactReport | null> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getPrImpact(analysisId);
    }
    try {
      const res = await this.pool.query('SELECT * FROM pr_impacts WHERE analysis_id = $1 OR id = $1', [analysisId]);
      if (!res.rows.length) return inMemoryDb.getPrImpact(analysisId);
      const r = res.rows[0];
      return {
        analysisId: r.analysis_id,
        pullRequestId: r.analysis_id,
        repositoryId: r.repository_id,
        headSha: r.commit_sha,
        changedFiles: r.affected_files_json || [],
        affectedFiles: r.affected_files_json || [],
        callerHierarchy: r.caller_hierarchy_json || [],
        relevantTests: r.relevant_tests_json || [],
        behaviorRisks: r.behavior_risks_json || [],
        symbolImpacts: r.symbol_impacts_json || [],
        behaviorChanges: r.behavior_changes_json || [],
        dependencyGraph: r.dependency_graph_json || { nodes: [], edges: [] },
        overview: r.overview || undefined,
        limitations: r.limitations || undefined
      };
    } catch {
      return inMemoryDb.getPrImpact(analysisId);
    }
  }

  // CHAT SESSIONS & MESSAGES
  async createChatSession(session: ChatSession): Promise<ChatSession> {
    inMemoryDb.createChatSession(session);
    if (!this.isConnected || !this.pool) return session;

    try {
      await this.pool.query(
        'INSERT INTO chat_sessions (id, repository_id, title, created_at) VALUES ($1, $2, $3, $4)',
        [session.id, session.repositoryId, session.title, session.createdAt]
      );
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Create chat session error:', err.message);
    }
    return session;
  }

  async getChatSessionById(sessionId: string): Promise<ChatSession | null> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getChatSessionById(sessionId);
    }
    try {
      const res = await this.pool.query('SELECT * FROM chat_sessions WHERE id = $1', [sessionId]);
      if (!res.rows.length) return inMemoryDb.getChatSessionById(sessionId);
      const r = res.rows[0];
      return {
        id: r.id,
        repositoryId: r.repository_id,
        title: r.title,
        createdAt: r.created_at
      };
    } catch {
      return inMemoryDb.getChatSessionById(sessionId);
    }
  }

  async getChatSessions(repositoryId: string): Promise<ChatSession[]> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getChatSessions(repositoryId);
    }
    try {
      const res = await this.pool.query(
        'SELECT * FROM chat_sessions WHERE repository_id = $1 ORDER BY created_at DESC',
        [repositoryId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        repositoryId: r.repository_id,
        title: r.title,
        createdAt: r.created_at
      }));
    } catch {
      return inMemoryDb.getChatSessions(repositoryId);
    }
  }

  async saveChatMessage(message: ChatMessage): Promise<ChatMessage> {
    inMemoryDb.saveChatMessage(message);
    if (!this.isConnected || !this.pool) return message;

    try {
      await this.pool.query(
        'INSERT INTO chat_messages (id, session_id, role, content, citations_json, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [message.id, message.sessionId, message.role, message.content, JSON.stringify(message.citations || []), message.createdAt]
      );
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Save chat message error:', err.message);
    }
    return message;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    if (!this.isConnected || !this.pool) {
      return inMemoryDb.getChatMessages(sessionId);
    }
    try {
      const res = await this.pool.query(
        'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
        [sessionId]
      );
      return res.rows.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        role: r.role,
        content: r.content,
        citations: r.citations_json || [],
        createdAt: r.created_at
      }));
    } catch {
      return inMemoryDb.getChatMessages(sessionId);
    }
  }

  async upsertUser(user: User): Promise<User> {
    inMemoryDb.upsertUser(user);
    if (!this.isConnected || !this.pool) return user;

    try {
      const res = await this.pool.query(
        `INSERT INTO users (id, github_id, login, name, email, avatar_url, access_token, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (github_id) DO UPDATE SET
           login = EXCLUDED.login,
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           avatar_url = EXCLUDED.avatar_url,
           access_token = EXCLUDED.access_token,
           updated_at = NOW()
         RETURNING *;`,
        [user.id, user.githubId, user.login, user.name || null, user.email || null, user.avatarUrl || null, user.accessToken || null]
      );
      const row = res.rows[0];
      const savedUser: User = {
        id: row.id,
        githubId: row.github_id,
        login: row.login,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        accessToken: row.access_token,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      };
      inMemoryDb.upsertUser(savedUser);
      return savedUser;
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Upsert user error:', err.message);
      return user;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    if (!this.isConnected || !this.pool) return inMemoryDb.getUserById(id);
    try {
      const res = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (res.rows.length === 0) return inMemoryDb.getUserById(id);
      const row = res.rows[0];
      return {
        id: row.id,
        githubId: row.github_id,
        login: row.login,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        accessToken: row.access_token,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      };
    } catch {
      return inMemoryDb.getUserById(id);
    }
  }

  async getUserByGithubId(githubId: string): Promise<User | null> {
    if (!this.isConnected || !this.pool) return inMemoryDb.getUserByGithubId(githubId);
    try {
      const res = await this.pool.query('SELECT * FROM users WHERE github_id = $1', [githubId]);
      if (res.rows.length === 0) return inMemoryDb.getUserByGithubId(githubId);
      const row = res.rows[0];
      return {
        id: row.id,
        githubId: row.github_id,
        login: row.login,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        accessToken: row.access_token,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      };
    } catch {
      return inMemoryDb.getUserByGithubId(githubId);
    }
  }

  async createSession(sessionId: string, userId: string, ttlMs: number = 7 * 24 * 60 * 60 * 1000): Promise<UserSession> {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const session: UserSession = {
      id: sessionId,
      userId,
      expiresAt,
      createdAt: new Date().toISOString()
    };
    inMemoryDb.createSession(sessionId, userId, ttlMs);
    if (!this.isConnected || !this.pool) return session;

    try {
      await this.pool.query(
        `INSERT INTO user_sessions (id, user_id, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at`,
        [sessionId, userId, expiresAt]
      );
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Create session error:', err.message);
    }
    return session;
  }

  async getSession(sessionId: string): Promise<{ session: UserSession; user: User } | null> {
    if (!this.isConnected || !this.pool) return inMemoryDb.getSession(sessionId);
    try {
      const res = await this.pool.query(
        `SELECT s.id as session_id, s.user_id, s.expires_at, s.created_at as session_created_at,
                u.id, u.github_id, u.login, u.name, u.email, u.avatar_url, u.access_token, u.created_at as user_created_at, u.updated_at
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.id = $1 AND s.expires_at > NOW()`,
        [sessionId]
      );
      if (res.rows.length === 0) {
        return inMemoryDb.getSession(sessionId);
      }
      const row = res.rows[0];
      const session: UserSession = {
        id: row.session_id,
        userId: row.user_id,
        expiresAt: new Date(row.expires_at).toISOString(),
        createdAt: row.session_created_at ? new Date(row.session_created_at).toISOString() : undefined
      };
      const user: User = {
        id: row.id,
        githubId: row.github_id,
        login: row.login,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        accessToken: row.access_token,
        createdAt: row.user_created_at ? new Date(row.user_created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      };
      return { session, user };
    } catch {
      return inMemoryDb.getSession(sessionId);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    inMemoryDb.deleteSession(sessionId);
    if (!this.isConnected || !this.pool) return;
    try {
      await this.pool.query('DELETE FROM user_sessions WHERE id = $1', [sessionId]);
    } catch (err: any) {
      console.warn('⚠️  [PGVector] Delete session error:', err.message);
    }
  }
}

export const db = new PgVectorDatabase();
