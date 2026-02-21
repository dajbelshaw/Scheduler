import { randomBytes, createHash } from 'crypto';
import { Pool } from 'pg';

const TOKEN_BYTES = 32;
const SESSION_TTL_HOURS = 24 * 7; // 1 week

export interface Session {
  userId: string;
  emojiId: string;
}

/**
 * Creates a new session for a user.
 * Returns the plain token (sent to client as a cookie/header).
 * Stores only the SHA-256 hash in the database.
 */
export async function createSession(
  pool: Pool,
  userId: string
): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return token;
}

/**
 * Validates a session token.
 * Returns the session (userId + emojiId) if valid, null otherwise.
 */
export async function validateSession(
  pool: Pool,
  token: string
): Promise<Session | null> {
  const tokenHash = hashToken(token);

  const { rows } = await pool.query(
    `SELECT s.user_id, u.emoji_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (rows.length === 0) return null;
  return { userId: rows[0].user_id, emojiId: rows[0].emoji_id };
}

/**
 * Deletes a session (sign out).
 */
export async function deleteSession(
  pool: Pool,
  token: string
): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

/**
 * Cleans up expired sessions. Call periodically (e.g. nightly cron).
 */
export async function purgeExpiredSessions(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
