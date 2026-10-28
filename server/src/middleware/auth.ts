import { Request, Response, NextFunction } from 'express';
import { db } from '../db/pgvector.js';
import { ENV } from '../config/env.js';
import { User, UserSession } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: UserSession;
}

export async function resolveSession(req: Request): Promise<{ session: UserSession; user: User } | null> {
  const cookieSessionId = req.cookies?.[ENV.SESSION_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  let bearerSessionId: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerSessionId = authHeader.substring(7).trim();
  }

  const sessionId = cookieSessionId || bearerSessionId || (req.headers['x-session-id'] as string);
  if (!sessionId) return null;

  return db.getSession(sessionId);
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const sessionData = await resolveSession(req);
    if (sessionData) {
      req.user = sessionData.user;
      req.session = sessionData.session;
      return next();
    }

    // In production, unconditionally reject with 401
    if (ENV.NODE_ENV === 'production') {
      return res.status(401).json({
        error: 'Authentication required. Please log in with GitHub.',
        authenticated: false
      });
    }

    // In development mode, check if strict enforcement is requested
    if (req.headers['x-enforce-auth'] === 'true') {
      return res.status(401).json({
        error: 'Authentication required. Please log in with GitHub.',
        authenticated: false
      });
    }

    // In standard dev mode, allow dev fallback user
    req.user = {
      id: 'usr-demo',
      githubId: 'demo-user',
      login: 'developer',
      name: 'Developer Mode',
      email: 'developer@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4'
    };
    return next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to verify session' });
  }
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const sessionData = await resolveSession(req);
    if (sessionData) {
      req.user = sessionData.user;
      req.session = sessionData.session;
    }
  } catch {
    // ignore
  }
  next();
}
