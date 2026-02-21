import { createHash, timingSafeEqual } from 'crypto';

/**
 * Hashes an iCal URL for storage.
 *
 * We use SHA-256 with a per-user salt stored alongside the hash.
 * The iCal URL is treated with the same care as a password:
 * - Never logged
 * - Never stored in plain text
 * - Compared using timing-safe equality
 *
 * We use SHA-256 rather than bcrypt because iCal URLs are already
 * high-entropy random strings (Proton/Fastmail generate them).
 * bcrypt's cost factor is designed for low-entropy secrets like passwords.
 */

const HASH_ITERATIONS = 100_000;
const HASH_ALGORITHM = 'sha256';
const SALT_BYTES = 32;

export interface HashedCredential {
  hash: string;   // hex-encoded
  salt: string;   // hex-encoded
}

/**
 * Hashes an iCal URL with a fresh random salt.
 */
export function hashIcalUrl(url: string): HashedCredential {
  const salt = require('crypto').randomBytes(SALT_BYTES).toString('hex');
  const hash = deriveHash(url, salt);
  return { hash, salt };
}

/**
 * Verifies a candidate iCal URL against a stored hash+salt.
 */
export function verifyIcalUrl(
  candidateUrl: string,
  stored: HashedCredential
): boolean {
  const candidateHash = deriveHash(candidateUrl, stored.salt);
  try {
    return timingSafeEqual(
      Buffer.from(candidateHash, 'hex'),
      Buffer.from(stored.hash, 'hex')
    );
  } catch {
    return false;
  }
}

function deriveHash(url: string, salt: string): string {
  // PBKDF2-style stretching via iterative SHA-256
  const { pbkdf2Sync } = require('crypto');
  return pbkdf2Sync(url, salt, HASH_ITERATIONS, 32, HASH_ALGORITHM).toString('hex');
}

/**
 * Basic structural validation that a URL looks like an iCal feed.
 * Does NOT fetch the URL — that happens separately in the route handler.
 */
export function isPlausibleIcalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'webcal:') &&
      parsed.hostname.length > 0
    );
  } catch {
    return false;
  }
}
