import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { ENV } from '../config/env.js';
import { db } from '../db/pgvector.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

const DEMO_USER = {
  id: 'usr-demo',
  githubId: 'demo-developer',
  login: 'developer',
  name: 'Developer Mode',
  email: 'developer@example.com',
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4'
};

/**
 * Helper to resolve session from cookie or Authorization header
 */
async function getSessionFromRequest(req: Request) {
  const cookieSessionId = req.cookies?.[ENV.SESSION_COOKIE_NAME];
  let bearerSessionId: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerSessionId = authHeader.substring(7).trim();
  }

  const sessionId = cookieSessionId || bearerSessionId || (req.headers['x-session-id'] as string);
  if (!sessionId) return null;

  return db.getSession(sessionId);
}

// -----------------------------------------------------------------------------
// GET /api/auth/github - Start OAuth 2.0 flow
// -----------------------------------------------------------------------------
router.get('/github', authRateLimiter, (req: Request, res: Response) => {
  if (!ENV.isGitHubOAuthConfigured) {
    console.warn('⚠️  [OAuth] GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
    if (ENV.NODE_ENV === 'production') {
      return res.status(503).json({
        error: 'GitHub OAuth is not configured on this server.'
      });
    }
    return res.redirect(`${ENV.FRONTEND_URL}/?error=${encodeURIComponent('GitHub OAuth credentials are not configured in backend .env')}`);
  }

  // 1. Generate cryptographically strong random state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  // 2. Store state in short-lived HTTP-only cookie
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: ENV.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/'
  });

  // 3. Build authorization redirect URL
  const params = new URLSearchParams({
    client_id: ENV.GITHUB_CLIENT_ID,
    redirect_uri: ENV.GITHUB_CALLBACK_URL,
    scope: 'read:user user:email',
    state: state
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  return res.redirect(authUrl);
});

// -----------------------------------------------------------------------------
// GET /api/auth/github/callback - OAuth 2.0 callback endpoint
// Matches EXACT URL: http://localhost:8080/api/auth/github/callback
// -----------------------------------------------------------------------------
router.get('/github/callback', authRateLimiter, async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  // 1. Handle user cancellation or GitHub errors
  if (error) {
    const errorMsg = (error_description as string) || (error as string) || 'GitHub authorization denied';
    console.warn(`⚠️  [OAuth] Authorization denied: ${errorMsg}`);
    res.clearCookie('oauth_state', { path: '/' });
    return res.redirect(`${ENV.FRONTEND_URL}/?error=${encodeURIComponent(errorMsg)}`);
  }

  // 2. Validate CSRF state against the cookie
  const savedState = req.cookies?.oauth_state;
  res.clearCookie('oauth_state', { path: '/' });

  if (!state || !savedState || state !== savedState) {
    console.warn('⚠️  [OAuth] CSRF state mismatch or expired state parameter');
    return res.redirect(
      `${ENV.FRONTEND_URL}/?error=${encodeURIComponent('Invalid or expired OAuth state. Possible CSRF attack detected.')}`
    );
  }

  // 3. Validate code presence
  if (!code || typeof code !== 'string') {
    return res.redirect(
      `${ENV.FRONTEND_URL}/?error=${encodeURIComponent('Missing authorization code from GitHub callback.')}`
    );
  }

  try {
    // 4. Exchange code for access token (backend-only exchange)
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: ENV.GITHUB_CLIENT_ID,
        client_secret: ENV.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: ENV.GITHUB_CALLBACK_URL
      },
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'CodeSense-App'
        },
        timeout: 10000
      }
    );

    const tokenData = tokenResponse.data;
    if (tokenData.error) {
      console.error('❌ [OAuth] Token exchange error:', tokenData.error_description || tokenData.error);
      return res.redirect(
        `${ENV.FRONTEND_URL}/?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      );
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.redirect(
        `${ENV.FRONTEND_URL}/?error=${encodeURIComponent('Failed to obtain access token from GitHub.')}`
      );
    }

    // 5. Retrieve GitHub user profile
    const userProfileResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'CodeSense-App',
        Accept: 'application/vnd.github.v3+json'
      },
      timeout: 10000
    });

    const ghUser = userProfileResponse.data;

    // 6. If email is not public, retrieve verified emails
    let primaryEmail = ghUser.email;
    if (!primaryEmail) {
      try {
        const emailsResponse = await axios.get('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'CodeSense-App',
            Accept: 'application/vnd.github.v3+json'
          },
          timeout: 5000
        });
        if (Array.isArray(emailsResponse.data)) {
          const primaryObj = emailsResponse.data.find((e: any) => e.primary && e.verified) || emailsResponse.data[0];
          if (primaryObj) primaryEmail = primaryObj.email;
        }
      } catch (emailErr: any) {
        console.warn('⚠️  [OAuth] Could not fetch private emails:', emailErr.message);
      }
    }

    // 7. Upsert user into database
    const userRecord = await db.upsertUser({
      id: `usr-${ghUser.id}`,
      githubId: String(ghUser.id),
      login: ghUser.login,
      name: ghUser.name || ghUser.login,
      email: primaryEmail || null,
      avatarUrl: ghUser.avatar_url,
      accessToken: accessToken
    });

    // 8. Create secure session
    const sessionId = crypto.randomBytes(32).toString('hex');
    await db.createSession(sessionId, userRecord.id, 7 * 24 * 60 * 60 * 1000);

    // 9. Set HTTP-only, SameSite=Lax session cookie
    res.cookie(ENV.SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });

    console.log(`✅ [OAuth] User authenticated successfully: @${ghUser.login} (ID: ${ghUser.id})`);

    // Auto-sync user's GitHub repositories so they are immediately available
    try {
      const reposRes = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'CodeSense-App',
          Accept: 'application/vnd.github.v3+json'
        },
        timeout: 5000
      });
      if (Array.isArray(reposRes.data)) {
        for (const r of reposRes.data) {
          await db.upsertRepository({
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
        }
        console.log(`📦 [OAuth] Automatically synced ${reposRes.data.length} repositories for @${ghUser.login}`);
      }
    } catch (syncErr: any) {
      console.warn('⚠️  [OAuth] Auto-sync repos note:', syncErr.message);
    }

    // 10. Redirect back to frontend
    return res.redirect(`${ENV.FRONTEND_URL}/?login=success`);
  } catch (err: any) {
    console.error('❌ [OAuth] Callback error:', err.response?.data || err.message);
    const msg = err.response?.data?.message || err.message || 'OAuth authentication failed';
    return res.redirect(`${ENV.FRONTEND_URL}/?error=${encodeURIComponent(msg)}`);
  }
});

// -----------------------------------------------------------------------------
// GET /api/auth/me - Current user session resolution
// -----------------------------------------------------------------------------
router.get('/me', async (req: Request, res: Response) => {
  const sessionData = await getSessionFromRequest(req);

  if (sessionData) {
    const { user } = sessionData;
    return res.json({
      authenticated: true,
      id: user.id,
      githubId: user.githubId,
      login: user.login,
      githubUsername: user.login,
      name: user.name,
      displayName: user.name || user.login,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt
    });
  }

  // Not authenticated via session
  if (ENV.NODE_ENV === 'production' || req.headers['x-enforce-auth'] === 'true') {
    return res.status(401).json({
      authenticated: false,
      error: 'Authentication required. No active session found.'
    });
  }

  // In development, return 401 unauthenticated so frontend can offer demo sign-in or GitHub login
  return res.status(401).json({
    authenticated: false,
    error: 'No active session. Please sign in with GitHub or use Demo login.'
  });
});

// -----------------------------------------------------------------------------
// POST /api/auth/demo-login - Development-only demo login
// -----------------------------------------------------------------------------
router.post('/demo-login', authRateLimiter, async (req: Request, res: Response) => {
  if (ENV.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Demo login is disabled in production environments. Please use GitHub OAuth.'
    });
  }

  // Create or persist demo user
  const user = await db.upsertUser(DEMO_USER);
  const sessionId = `demo-${crypto.randomBytes(24).toString('hex')}`;
  await db.createSession(sessionId, user.id, 7 * 24 * 60 * 60 * 1000);

  res.cookie(ENV.SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });

  return res.json({
    authenticated: true,
    id: user.id,
    githubId: user.githubId,
    login: user.login,
    githubUsername: user.login,
    name: user.name,
    displayName: user.name || user.login,
    email: user.email,
    avatarUrl: user.avatarUrl
  });
});

// -----------------------------------------------------------------------------
// GET /api/auth/login-url - Discoverable login entrypoint
// -----------------------------------------------------------------------------
router.get('/login-url', (req: Request, res: Response) => {
  if (ENV.isGitHubOAuthConfigured) {
    return res.json({
      loginUrl: '/api/auth/github',
      provider: 'github'
    });
  }

  if (ENV.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Production authentication provider is not configured. Set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET.'
    });
  }

  return res.json({
    loginUrl: '/api/auth/demo-login',
    provider: 'demo'
  });
});

// -----------------------------------------------------------------------------
// POST /api/auth/logout - Session termination
// -----------------------------------------------------------------------------
router.post('/logout', async (req: Request, res: Response) => {
  const cookieSessionId = req.cookies?.[ENV.SESSION_COOKIE_NAME];
  let bearerSessionId: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerSessionId = authHeader.substring(7).trim();
  }

  const sessionId = cookieSessionId || bearerSessionId || (req.headers['x-session-id'] as string);
  if (sessionId) {
    await db.deleteSession(sessionId);
  }

  res.clearCookie(ENV.SESSION_COOKIE_NAME, { path: '/' });
  res.clearCookie('oauth_state', { path: '/' });

  return res.json({ status: 'ok', authenticated: false });
});

export default router;
