import { Router } from 'express';
import { db } from '../db/pgvector.js';
import { embeddingService } from '../services/embedding.service.js';
import { geminiService } from '../services/gemini.service.js';
import { ENV } from '../config/env.js';
import { ChatSession, ChatMessage } from '../types/index.js';
import { aiRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/chat/sessions
router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const { repositoryId, title } = req.body;
    if (!repositoryId) {
      return res.status(400).json({ error: 'repositoryId is required' });
    }

    const repo = await db.getRepositoryById(repositoryId);
    if (!repo) {
      return res.status(404).json({ error: `Repository '${repositoryId}' not found` });
    }

    const session: ChatSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      repositoryId,
      title: title || 'Architecture Analysis',
      createdAt: new Date().toISOString()
    };

    const saved = await db.createChatSession(session);
    res.json(saved);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/sessions
router.get('/sessions', async (req, res) => {
  try {
    const repositoryId = req.query.repositoryId as string;
    if (!repositoryId) {
      return res.status(400).json({ error: 'repositoryId query param is required' });
    }
    const list = await db.getChatSessions(repositoryId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chat/sessions/:id
router.get('/sessions/:id', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
    const messages = await db.getChatMessages(id);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/sessions/:id/messages (Server-Sent Events streaming)
router.post('/sessions/:id/messages', requireAuth, aiRateLimiter, async (req, res) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content is required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let isClientDisconnected = false;
  res.on('close', () => {
    // Only flag disconnect if the response stream was closed before completion (e.g. client aborted)
    if (!res.writableEnded) {
      isClientDisconnected = true;
    }
  });

  const sendEvent = (event: string, data: any) => {
    if (isClientDisconnected || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
  };

  try {
    // 1. Save and emit user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sessionId,
      role: 'USER',
      content,
      citations: [],
      createdAt: new Date().toISOString()
    };
    await db.saveChatMessage(userMessage);
    sendEvent('user_message', userMessage);

    // 2. Find repository ID for this session
    let repositoryId = (req.body && req.body.repositoryId) || '';
    if (!repositoryId) {
      const session = await db.getChatSessionById(sessionId);
      if (session) {
        repositoryId = session.repositoryId;
      }
    }
    if (!repositoryId) {
      const allRepos = await db.getRepositories();
      for (const r of allRepos) {
        const sessions = await db.getChatSessions(r.id);
        if (sessions.some((s) => s.id === sessionId)) {
          repositoryId = r.id;
          break;
        }
      }
    }

    const commitSha = (req.body && req.body.commitSha) || undefined;

    // 3. Vector Search for relevant code chunks via configured embedding provider & PGVector
    let contextChunks: any[] = [];
    if (repositoryId) {
      const queryVector = await embeddingService.embedQuery(content);
      contextChunks = await db.searchSimilarChunks(
        repositoryId,
        queryVector,
        ENV.CHAT_RETRIEVAL_LIMIT,
        commitSha
      );
    }

    // 3b. Load recent conversation history for bounded multi-turn context
    const previousMessages = await db.getChatMessages(sessionId);
    const history = previousMessages
      .filter((m) => m.id !== userMessage.id)
      .slice(-6)
      .map((m) => ({
        role: (m.role.toLowerCase() === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content
      }));

    // 4. Stream response from Gemini
    const { answer, citations } = await geminiService.streamChat({
      question: content,
      contextChunks,
      history,
      repositoryId,
      commitSha,
      isAborted: () => isClientDisconnected || res.writableEnded,
      onToken: (token) => {
        sendEvent('token', token);
      }
    });

    // 5. Save and emit completed assistant message
    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now()}-a`,
      sessionId,
      role: 'ASSISTANT',
      content: answer,
      citations,
      createdAt: new Date().toISOString()
    };
    await db.saveChatMessage(assistantMessage);
    sendEvent('assistant_message', assistantMessage);

    // 6. Complete stream
    sendEvent('done', {});
    res.end();
  } catch (err: any) {
    sendEvent('error', { error: err.message });
    res.end();
  }
});

export default router;
