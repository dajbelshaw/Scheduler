import { EMOJI_ALPHABET, ID_LENGTH } from './emoji-alphabet';
import { Pool } from 'pg';

/**
 * Generates a random Emoji ID (4 emoji from the curated alphabet).
 * Does not guarantee uniqueness — call generateUniqueEmojiId for that.
 */
export function generateEmojiId(): string {
  const result: string[] = [];
  for (let i = 0; i < ID_LENGTH; i++) {
    const index = Math.floor(Math.random() * EMOJI_ALPHABET.length);
    result.push(EMOJI_ALPHABET[index]);
  }
  return result.join('');
}

/**
 * Validates that a string is a well-formed Emoji ID:
 * - Exactly ID_LENGTH emoji
 * - Each emoji is in the curated alphabet
 */
export function isValidEmojiId(id: string): boolean {
  // Segment into individual emoji using Intl.Segmenter
  const segmenter = new Intl.Segmenter();
  const segments = Array.from(segmenter.segment(id)).map(s => s.segment);

  if (segments.length !== ID_LENGTH) return false;
  return segments.every(emoji => EMOJI_ALPHABET.includes(emoji));
}

/**
 * Generates a unique Emoji ID not already in the database.
 * Retries up to maxAttempts times before throwing.
 */
export async function generateUniqueEmojiId(
  pool: Pool,
  maxAttempts = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = generateEmojiId();
    const { rows } = await pool.query(
      'SELECT 1 FROM users WHERE emoji_id = $1',
      [id]
    );
    if (rows.length === 0) return id;
  }
  throw new Error('Failed to generate unique Emoji ID after maximum attempts');
}

/**
 * Checks whether a given Emoji ID is already taken.
 */
export async function isEmojiIdTaken(pool: Pool, id: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM users WHERE emoji_id = $1',
    [id]
  );
  return rows.length > 0;
}
