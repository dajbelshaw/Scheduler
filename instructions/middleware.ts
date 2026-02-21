import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { validateSession, Session } from './session';

const COOKIE_NAME = 'ca_session';

// Extend Express Request to carry session
declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

/**
 * Middleware that requires a valid session.
 * Attaches req.session = { userId, emojiId } on success.
 */
export function requireAuth(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await validateSession(pool, token);
    if (!session) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.session = session;
    next();
  };
}
