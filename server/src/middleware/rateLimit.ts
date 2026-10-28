import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env.js';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory sliding window rate limiter middleware.
 * 
 * NOTE: This rate limiter uses a per-process in-memory store. In a multi-replica or
 * clustered production environment with a load balancer, distributed rate limiting
 * via an external cache (e.g., Redis or an API gateway like Cloudflare/Kong) would be
 * used. For single-instance deployments and node processes, this provides robust, zero-dependency,
 * non-blocking protection against abuse and runaway AI consumption.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const windowMs = options.windowMs || 60000;
  const max = options.max || 60;
  const message = options.message || 'Too many requests. Please try again later.';
  const statusCode = options.statusCode || 429;

  // In-memory bucket storage: clientKey -> ClientRecord
  const hits = new Map<string, ClientRecord>();

  // Periodically cleanup expired entries every 2 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, Math.max(windowMs, 120000));

  // Do not hold process alive solely for cleanup timer
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  const defaultKeyGen = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  };

  const keyGen = options.keyGenerator || defaultKeyGen;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGen(req);
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil(Math.max(0, record.resetTime - now) / 1000);

    // Standard rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(statusCode).json({
        error: message,
        retryAfter: resetSeconds
      });
    }

    next();
  };
}

/**
 * Pre-configured rate limiters based on ENV settings:
 */

// Stricter limiter for expensive Gemini AI generation and analysis routes
export const aiRateLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_AI_MAX,
  message: 'AI request rate limit exceeded. Please wait a moment before sending another message or PR analysis.'
});

// Stricter limiter for repository cloning, AST parsing, and bulk embedding
export const indexingRateLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_INDEX_MAX,
  message: 'Repository indexing limit exceeded. Please wait before importing or re-indexing additional repositories.'
});

// Limiter for authentication routes
export const authRateLimiter = createRateLimiter({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max: ENV.RATE_LIMIT_AUTH_MAX,
  message: 'Authentication rate limit exceeded. Please wait before attempting to sign in again.'
});
