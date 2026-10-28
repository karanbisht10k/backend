import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root and server directories
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

export const ENV = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/codesense_db',
  
  // Embedding Provider Configuration ('nvidia' | 'gemini' | 'voyage')
  EMBEDDING_PROVIDER: (process.env.EMBEDDING_PROVIDER || (process.env.NVIDIA_API_KEY ? 'nvidia' : 'gemini')).toLowerCase(),
  
  // AI Chat & PR Review Provider ('nvidia' | 'gemini')
  AI_PROVIDER: (process.env.AI_PROVIDER || (process.env.NVIDIA_API_KEY ? 'nvidia' : 'gemini')).toLowerCase(),

  // NVIDIA NIM Configuration (Minimax chat & Nemotron embeddings)
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY || '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',
  NVIDIA_MODEL: process.env.NVIDIA_MODEL || 'minimaxai/minimax-m3.1-flash',
  NVIDIA_BASE_URL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  NVIDIA_EMBEDDING_MODEL: process.env.NVIDIA_EMBEDDING_MODEL || 'nvidia/nemotron-3.5-embed-1b',
  NVIDIA_EMBEDDING_DIMENSION: parseInt(process.env.NVIDIA_EMBEDDING_DIMENSION || '2048', 10),

  // Google Gemini Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
  GEMINI_EMBEDDING_DIMENSION: parseInt(process.env.GEMINI_EMBEDDING_DIMENSION || '768', 10),
  
  // Chat RAG Configuration
  CHAT_RETRIEVAL_LIMIT: parseInt(process.env.CHAT_RETRIEVAL_LIMIT || '6', 10),
  CHAT_MAX_CONTEXT_CHARS: parseInt(process.env.CHAT_MAX_CONTEXT_CHARS || '12000', 10),

  // Rate Limiting Configuration (Per-process in-memory limits)
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute window
  RATE_LIMIT_AI_MAX: parseInt(process.env.RATE_LIMIT_AI_MAX || '20', 10), // 20 requests/min for chat & PR analyze
  RATE_LIMIT_INDEX_MAX: parseInt(process.env.RATE_LIMIT_INDEX_MAX || '5', 10), // 5 requests/min for repo import & index
  RATE_LIMIT_AUTH_MAX: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '30', 10), // 30 requests/min for auth routes

  // CORS Configuration
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],

  // Indexing Job Recovery Configuration
  INDEXING_TIMEOUT_MS: parseInt(process.env.INDEXING_TIMEOUT_MS || '900000', 10), // 15 minutes max before stale recovery

  // Voyage AI Configuration (Legacy / Alternative Provider)
  VOYAGE_API_KEY: process.env.VOYAGE_API_KEY || '',
  VOYAGE_MODEL: process.env.VOYAGE_MODEL || 'voyage-code-3',
  VOYAGE_DIMENSION: parseInt(process.env.VOYAGE_DIMENSION || '1536', 10),
  
  // GitHub Configuration & OAuth 2.0
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  GITHUB_CALLBACK_URL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:8080/api/auth/github/callback',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SESSION_SECRET: process.env.SESSION_SECRET || 'codesense-secure-session-secret-change-in-prod',
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || 'codesense_session',
  
  // Storage Directory for temporary clones
  REPOS_STORAGE_DIR: process.env.REPOS_STORAGE_DIR || path.resolve(process.cwd(), '.repos_cache'),

  get isGitHubOAuthConfigured(): boolean {
    return Boolean(this.GITHUB_CLIENT_ID && this.GITHUB_CLIENT_SECRET);
  },

  // Effective dimension based on the active provider
  get EFFECTIVE_EMBEDDING_DIMENSION(): number {
    if (this.EMBEDDING_PROVIDER === 'nvidia') {
      return this.NVIDIA_EMBEDDING_DIMENSION;
    }
    return this.EMBEDDING_PROVIDER === 'gemini'
      ? this.GEMINI_EMBEDDING_DIMENSION
      : this.VOYAGE_DIMENSION;
  },

  get EFFECTIVE_EMBEDDING_MODEL(): string {
    if (this.EMBEDDING_PROVIDER === 'nvidia') {
      return this.NVIDIA_EMBEDDING_MODEL;
    }
    return this.EMBEDDING_PROVIDER === 'gemini'
      ? this.GEMINI_EMBEDDING_MODEL
      : this.VOYAGE_MODEL;
  }
};
