import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { db } from './db/pgvector.js';
import authRouter from './routes/auth.routes.js';
import reposRouter from './routes/repos.routes.js';
import pullRequestsRouter from './routes/pullRequests.routes.js';
import chatRouter from './routes/chat.routes.js';
import { nvidiaService } from './services/nvidia.service.js';

const app = express();

// Middlewares
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // In development or when no origin header is sent (curl, tests, server-to-server)
    if (!origin || ENV.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // In production, enforce configured frontend origins
    if (ENV.ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: Origin ${origin} is not allowed in production`));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(ENV.SESSION_SECRET));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.endsWith('/status')) {
      console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/repos', reposRouter);
app.use('/api/pull-requests', pullRequestsRouter);
app.use('/api/chat', chatRouter);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    postgresConnected: db.isDatabaseConnected(),
    embeddingProvider: ENV.EMBEDDING_PROVIDER,
    embeddingModel: ENV.EFFECTIVE_EMBEDDING_MODEL,
    embeddingDimension: ENV.EFFECTIVE_EMBEDDING_DIMENSION,
    geminiEmbeddingModel: ENV.GEMINI_EMBEDDING_MODEL,
    geminiEmbeddingDimension: ENV.GEMINI_EMBEDDING_DIMENSION,
    aiProvider: ENV.AI_PROVIDER,
    nvidiaConfigured: nvidiaService.isConfigured(),
    nvidiaModel: ENV.NVIDIA_MODEL,
    geminiModel: ENV.GEMINI_MODEL,
    geminiConfigured: Boolean(ENV.GEMINI_API_KEY && ENV.GEMINI_API_KEY.trim().length > 0),
    voyageConfigured: Boolean(ENV.VOYAGE_API_KEY && ENV.VOYAGE_API_KEY.trim().length > 0)
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({
      error: err.message
    });
  }
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Server Initialization
async function startServer() {
  console.log('---------------------------------------------------------');
  console.log('🚀 Starting CodeSense Copilot TypeScript Backend...');
  console.log('---------------------------------------------------------');

  // Validate production configuration
  if (ENV.NODE_ENV === 'production') {
    console.log('🔒 Production mode active: enforcing strict security & CORS policies');
    if (!ENV.GEMINI_API_KEY) {
      console.warn('⚠️  [SECURITY WARNING] GEMINI_API_KEY is not set in production. AI features will fail.');
    }
    console.log(`🌐 Allowed CORS Origins: ${ENV.ALLOWED_ORIGINS.join(', ')}`);
  }

  // Initialize DB and PGVector tables (also recovers interrupted indexing jobs)
  await db.initialize();

  app.listen(ENV.PORT, () => {
    console.log(`\n=========================================================`);
    console.log(`📡 CodeSense TS Backend is LIVE on http://localhost:${ENV.PORT}`);
    console.log(`=========================================================`);
    const embedStatus = ENV.EMBEDDING_PROVIDER === 'nvidia' && nvidiaService.isConfigured()
      ? 'NVIDIA Key Configured'
      : (ENV.EMBEDDING_PROVIDER === 'gemini' && ENV.GEMINI_API_KEY ? 'Gemini Key Configured' : 'Setup / Fallback Mode');
    console.log(`🧠 Embeddings      : ${ENV.EMBEDDING_PROVIDER.toUpperCase()} (${ENV.EFFECTIVE_EMBEDDING_MODEL}, ${ENV.EFFECTIVE_EMBEDDING_DIMENSION} dim) [${embedStatus}]`);
    const aiProviderLog = ENV.AI_PROVIDER === 'nvidia' && nvidiaService.isConfigured()
      ? `NVIDIA NIM (${ENV.NVIDIA_MODEL}) [Configured]`
      : `Google Gemini (${ENV.GEMINI_MODEL}) [${ENV.GEMINI_API_KEY ? 'Configured' : 'Setup Mode'}]`;
    console.log(`🤖 AI Chat / Review : ${aiProviderLog}`);
    console.log(`🐙 GitHub Client   : Deep AST & Git Fetcher [${ENV.GITHUB_TOKEN ? 'Token Active' : 'Public Rate Limit'}]`);
    console.log(`=========================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
