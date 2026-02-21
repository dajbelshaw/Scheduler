import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';

import { generateUniqueEmojiId, isValidEmojiId, isEmojiIdTaken } from './emoji-id';
import { hashIcalUrl, verifyIcalUrl, isPlausibleIcalUrl } from './credentials';
import { generateRecoveryCodes, storeRecoveryCodes, consumeRecoveryCode, remainingRecoveryCodes } from './recovery';
import { createSession, validateSession, deleteSession } from './session';

const COOKIE_NAME = 'ca_session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week in ms
};

export function createAuthRouter(pool: Pool): Router {
  const router = Router();

  /**
   * GET /auth/suggest
   * Returns a suggested unique Emoji ID for the signup form.
   */
  router.get('/suggest', async (_req: Request, res: Response) => {
    try {
      const emojiId = await generateUniqueEmojiId(pool);
      res.json({ emojiId });
    } catch (err) {
      res.status(503).json({ error: 'Could not generate Emoji ID' });
    }
  });

  /**
   * POST /auth/signup
   * Body: { emojiId?: string, icalUrl: string }
   *
   * emojiId is optional — if omitted, one is generated.
   * Returns: { emojiId, recoveryCodes } on success.
   * Recovery codes are shown once and never retrievable again.
   */
  router.post('/signup', async (req: Request, res: Response) => {
    const { emojiId: requestedId, icalUrl } = req.body;

    // Validate iCal URL structure
    if (!icalUrl || !isPlausibleIcalUrl(icalUrl)) {
      return res.status(400).json({ error: 'Invalid iCal URL' });
    }

    // Validate the URL actually returns iCal data
    try {
      const response = await axios.get(icalUrl, { timeout: 5000 });
      const contentType = response.headers['content-type'] ?? '';
      const body = typeof response.data === 'string' ? response.data : '';
      const looksLikeICal = contentType.includes('calendar') || body.startsWith('BEGIN:VCALENDAR');
      if (!looksLikeICal) {
        return res.status(400).json({ error: 'URL does not appear to be an iCal feed' });
      }
    } catch {
      return res.status(400).json({ error: 'Could not fetch iCal URL — is it publicly accessible?' });
    }

    // Resolve Emoji ID
    let emojiId: string;
    if (requestedId) {
      if (!isValidEmojiId(requestedId)) {
        return res.status(400).json({ error: 'Invalid Emoji ID format' });
      }
      if (await isEmojiIdTaken(pool, requestedId)) {
        return res.status(409).json({ error: 'Emoji ID already taken' });
      }
      emojiId = requestedId;
    } else {
      try {
        emojiId = await generateUniqueEmojiId(pool);
      } catch {
        return res.status(503).json({ error: 'Could not generate Emoji ID' });
      }
    }

    // Hash the iCal URL
    const { hash: icalHash, salt: icalSalt } = hashIcalUrl(icalUrl);

    // Create user record
    const { rows } = await pool.query(
      `INSERT INTO users (emoji_id, ical_hash, ical_salt)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [emojiId, icalHash, icalSalt]
    );
    const userId: number = rows[0].id;

    // Generate and store recovery codes
    const codes = generateRecoveryCodes();
    await storeRecoveryCodes(pool, userId, codes);

    // Issue session
    const token = await createSession(pool, userId);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    // Return plain recovery codes — shown once only
    res.status(201).json({
      emojiId,
      recoveryCodes: codes.map(c => c.plain),
      message: 'Store these recovery codes somewhere safe. They cannot be retrieved again.',
    });
  });

  /**
   * POST /auth/signin
   * Body: { emojiId: string, icalUrl: string }
   */
  router.post('/signin', async (req: Request, res: Response) => {
    const { emojiId, icalUrl } = req.body;

    if (!emojiId || !icalUrl) {
      return res.status(400).json({ error: 'Emoji ID and iCal URL are required' });
    }

    if (!isValidEmojiId(emojiId)) {
      return res.status(400).json({ error: 'Invalid Emoji ID format' });
    }

    const { rows } = await pool.query(
      'SELECT id, ical_hash, ical_salt FROM users WHERE emoji_id = $1',
      [emojiId]
    );

    // Consistent response time whether user exists or not
    if (rows.length === 0) {
      // Perform a dummy hash to prevent timing attacks
      hashIcalUrl(icalUrl);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = verifyIcalUrl(icalUrl, { hash: user.ical_hash, salt: user.ical_salt });

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = await createSession(pool, user.id);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json({ emojiId });
  });

  /**
   * POST /auth/recover
   * Body: { emojiId: string, recoveryCode: string, newIcalUrl: string }
   *
   * Allows a user who has lost access to their iCal URL to regain
   * access using a recovery code, and optionally update their iCal URL.
   */
  router.post('/recover', async (req: Request, res: Response) => {
    const { emojiId, recoveryCode, newIcalUrl } = req.body;

    if (!emojiId || !recoveryCode) {
      return res.status(400).json({ error: 'Emoji ID and recovery code are required' });
    }

    if (!isValidEmojiId(emojiId)) {
      return res.status(400).json({ error: 'Invalid Emoji ID format' });
    }

    const { rows } = await pool.query(
      'SELECT id FROM users WHERE emoji_id = $1',
      [emojiId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userId: number = rows[0].id;
    const valid = await consumeRecoveryCode(pool, userId, recoveryCode);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid or already-used recovery code' });
    }

    // Optionally update the iCal URL (e.g. user has rotated their Proton URL)
    if (newIcalUrl) {
      if (!isPlausibleIcalUrl(newIcalUrl)) {
        return res.status(400).json({ error: 'Invalid iCal URL' });
      }
      const { hash, salt } = hashIcalUrl(newIcalUrl);
      await pool.query(
        'UPDATE users SET ical_hash = $1, ical_salt = $2 WHERE id = $3',
        [hash, salt, userId]
      );
    }

    const remaining = await remainingRecoveryCodes(pool, userId);
    const token = await createSession(pool, userId);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    res.json({
      emojiId,
      remainingRecoveryCodes: remaining,
      ...(remaining === 0 && {
        warning: 'You have used all your recovery codes. Please contact support.',
      }),
    });
  });

  /**
   * POST /auth/signout
   */
  router.post('/signout', async (req: Request, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      await deleteSession(pool, token);
    }
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });

  /**
   * GET /auth/me
   * Returns the current session's Emoji ID, or 401.
   */
  router.get('/me', async (req: Request, res: Response) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const session = await validateSession(pool, token);
    if (!session) return res.status(401).json({ error: 'Session expired' });

    res.json({ emojiId: session.emojiId });
  });

  return router;
}
