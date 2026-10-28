import { Router } from 'express';
import axios from 'axios';
import { db } from '../db/pgvector.js';
import { githubService } from '../services/github.service.js';
import { indexerService } from '../services/indexer.service.js';
import { indexingRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth, resolveSession } from '../middleware/auth.js';

const router = Router();

// GET /api/repos
router.get('/', async (req, res) => {
  try {
    const list = await db.getRepositories();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repos/sync - Auto-sync repositories for linked GitHub user or demo
router.post('/sync', async (req, res) => {
  try {
    const sessionData = await resolveSession(req);
    const user = sessionData?.user;
    const syncedRepos: any[] = [];

    if (user && user.accessToken) {
      try {
        const ghRes = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator', {
          headers: {
            Authorization: `Bearer ${user.accessToken}`,
            'User-Agent': 'CodeSense-Copilot-App',
            Accept: 'application/vnd.github.v3+json'
          },
          timeout: 10000
        });

        if (Array.isArray(ghRes.data)) {
          for (const r of ghRes.data) {
            const saved = await db.upsertRepository({
              id: r.full_name,
              name: r.name,
              fullName: r.full_name,
              url: r.html_url,
              defaultBranch: r.default_branch || 'main',
              description: r.description || '',
              isPrivate: r.private || false,
              indexStatus: 'PENDING',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            syncedRepos.push(saved);
          }
        }
      } catch (ghErr: any) {
        console.warn('⚠️ [GitHub Sync] Error fetching user repos with token:', ghErr.message);
      }
    }

    // If still empty (e.g. demo mode or no token), ensure sample presets are present
    const existing = await db.getRepositories();
    if (existing.length === 0) {
      const presets = [
        { owner: 'spring-projects', repo: 'spring-petclinic', desc: 'Sample Spring Boot pet clinic application with JPA and REST' },
        { owner: 'octocat', repo: 'Hello-World', desc: 'My first repository on GitHub!' }
      ];
      for (const p of presets) {
        const saved = await db.upsertRepository({
          id: `${p.owner}/${p.repo}`,
          name: p.repo,
          fullName: `${p.owner}/${p.repo}`,
          url: `https://github.com/${p.owner}/${p.repo}`,
          defaultBranch: 'main',
          description: p.desc,
          isPrivate: false,
          indexStatus: 'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        syncedRepos.push(saved);
      }
    }

    const finalList = await db.getRepositories();
    res.json({
      message: 'Repositories synchronized successfully',
      syncedCount: syncedRepos.length,
      repos: finalList
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repos/import
router.post('/import', requireAuth, indexingRateLimiter, async (req, res) => {
  try {
    const { repositoryUrl } = req.body;
    if (!repositoryUrl || typeof repositoryUrl !== 'string') {
      return res.status(400).json({ error: 'repositoryUrl string is required' });
    }

    const parsed = githubService.parseGitHubUrl(repositoryUrl);
    const details = await githubService.getRepoDetails(parsed.owner, parsed.repo);

    const repo = await db.upsertRepository({
      id: details.fullName,
      name: details.name,
      fullName: details.fullName,
      url: details.url,
      defaultBranch: details.defaultBranch,
      description: details.description,
      isPrivate: details.isPrivate,
      indexStatus: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.json(repo);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/repos/:id
router.get('/:id(*)', async (req, res, next) => {
  // express wildcards for owner/repo
  const repoId = (req.params as any).id || (req.params as any)[0];
  if (repoId.endsWith('/status') || repoId.endsWith('/structure') || repoId.endsWith('/index') || repoId.endsWith('/file')) {
    return next();
  }
  try {
    const repo = await db.getRepositoryById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    res.json(repo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/file?path=...
router.get('/:id(*)/file', async (req, res) => {
  try {
    const rawId = (req.params as any).id || (req.params as any)[0];
    const repoId = String(rawId).replace(/\/file$/, '');
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: 'path query parameter is required' });
    }
    const repo = await db.getRepositoryById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    const parts = repo.fullName.split('/');
    if (parts.length < 2) {
      return res.status(400).json({ error: 'Invalid repository name format' });
    }
    const owner = parts[0];
    const name = parts[1];
    const headSha = repo.indexedCommitSha || repo.defaultBranch || 'main';
    const contentRes = await githubService.getFileContentAtCommit(owner, name, filePath, headSha);
    res.json(contentRes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repos/:id/index
router.post('/:id(*)/index', requireAuth, indexingRateLimiter, async (req, res) => {
  try {
    const repoId = (req.params as any).id || (req.params as any)[0];
    await indexerService.triggerIndexing(repoId);
    res.json({ message: 'Indexing started successfully', repositoryId: repoId, status: 'INDEXING' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/repos/:id/status
router.get('/:id(*)/status', async (req, res) => {
  try {
    const repoId = (req.params as any).id || (req.params as any)[0];
    // Check and recover any stale jobs before returning status
    await db.recoverStaleIndexingJobs();

    const repo = await db.getRepositoryById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }
    res.json({
      repositoryId: repo.id,
      indexStatus: repo.indexStatus,
      indexedCommitSha: repo.indexedCommitSha,
      indexingStartedAt: repo.indexingStartedAt,
      indexingError: repo.indexingError
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repos/:id/structure
router.get('/:id(*)/structure', async (req, res) => {
  try {
    const repoId = (req.params as any).id || (req.params as any)[0];
    const structures = await db.getCodeStructures(repoId);
    res.json(structures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
