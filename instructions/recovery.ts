import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';
import { Pool } from 'pg';

const CODE_COUNT = 5;
const CODE_BYTES = 16;             // 128-bit entropy per code
const HASH_ITERATIONS = 100_000;
const HASH_ALGORITHM = 'sha256';

export interface RecoveryCode {
  plain: string;    // shown to user once, never stored
  hash: string;     // stored in DB
  salt: string;     // stored in DB
}

export interface StoredRecoveryCode {
  id: number;
  hash: string;
  salt: string;
  used: boolean;
}

/**
 * Generates CODE_COUNT recovery codes.
 * Returns plain text codes for one-time display to the user,
 * and hashed versions for storage.
 */
export function generateRecoveryCodes(): RecoveryCode[] {
  return Array.from({ length: CODE_COUNT }, () => {
    const plain = randomBytes(CODE_BYTES).toString('hex');
    const salt = randomBytes(32).toString('hex');
    const hash = hashCode(plain, salt);
    return { plain, hash, salt };
  });
}

/**
 * Stores hashed recovery codes in the database.
 * Called once at signup — plain codes are never passed here.
 */
export async function storeRecoveryCodes(
  pool: Pool,
  userId: number,
  codes: Pick<RecoveryCode, 'hash' | 'salt'>[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const code of codes) {
      await client.query(
        `INSERT INTO recovery_codes (user_id, hash, salt, used)
         VALUES ($1, $2, $3, false)`,
        [userId, code.hash, code.salt]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Attempts to use a recovery code for a given user.
 * Returns true and marks the code used if valid.
 * Returns false if no matching unused code is found.
 *
 * Uses timing-safe comparison to prevent enumeration attacks.
 */
export async function consumeRecoveryCode(
  pool: Pool,
  userId: number,
  candidateCode: string
): Promise<boolean> {
  const { rows } = await pool.query<StoredRecoveryCode>(
    `SELECT id, hash, salt, used
     FROM recovery_codes
     WHERE user_id = $1 AND used = false`,
    [userId]
  );

  for (const row of rows) {
    const candidateHash = hashCode(candidateCode, row.salt);
    let match = false;
    try {
      match = timingSafeEqual(
        Buffer.from(candidateHash, 'hex'),
        Buffer.from(row.hash, 'hex')
      );
    } catch {
      continue;
    }

    if (match) {
      await pool.query(
        'UPDATE recovery_codes SET used = true WHERE id = $1',
        [row.id]
      );
      return true;
    }
  }

  return false;
}

/**
 * Returns the number of unused recovery codes remaining for a user.
 */
export async function remainingRecoveryCodes(
  pool: Pool,
  userId: number
): Promise<number> {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM recovery_codes WHERE user_id = $1 AND used = false',
    [userId]
  );
  return parseInt(rows[0].count, 10);
}

function hashCode(plain: string, salt: string): string {
  return pbkdf2Sync(plain, salt, HASH_ITERATIONS, 32, HASH_ALGORITHM).toString('hex');
}
