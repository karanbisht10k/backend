import { Router } from 'express';
import { db } from '../db/pgvector.js';
import { reviewService } from '../services/review.service.js';
import { aiRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/pull-requests/analyze
router.post('/analyze', requireAuth, aiRateLimiter, async (req, res) => {
  try {
    const { pullRequestUrl, repositoryId } = req.body;
    if (!pullRequestUrl || typeof pullRequestUrl !== 'string') {
      return res.status(400).json({ error: 'pullRequestUrl is required and must be a valid GitHub PR URL' });
    }

    if (!pullRequestUrl.includes('github.com') || !pullRequestUrl.includes('/pull/')) {
      return res.status(400).json({ error: 'Invalid GitHub PR URL format. Expected: https://github.com/:owner/:repo/pull/:number' });
    }

    const initialAnalysis = await reviewService.startAnalysis(pullRequestUrl, repositoryId);
    res.json(initialAnalysis);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/pull-requests/analyses/:id
router.get('/analyses/:id', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
    const analysis = await db.getPullRequestAnalysis(id);
    if (!analysis) {
      return res.status(404).json({ error: 'PR analysis not found' });
    }
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pull-requests/analyses/:id/impact
router.get('/analyses/:id/impact', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
    const impact = await db.getPrImpact(id);
    if (!impact) {
      return res.json({
        analysisId: id,
        affectedFiles: [],
        callerHierarchy: [],
        relevantTests: [],
        behaviorRisks: []
      });
    }
    res.json(impact);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pull-requests/analyses/:id/findings
router.get('/analyses/:id/findings', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
    const findings = await db.getPrFindings(id);
    res.json(findings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pull-requests/repository/:repoId(*)
router.get('/repository/:repoId(*)', async (req, res) => {
  try {
    const repoId = (req.params as any).repoId || (req.params as any)[0];
    const list = await db.getPullRequestsByRepo(repoId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
