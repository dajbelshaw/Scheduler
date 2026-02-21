-- Migration: auth tables for Emoji ID-based authentication
-- No personally identifiable information is stored.

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  emoji_id    VARCHAR(32) NOT NULL UNIQUE,   -- 4 emoji, up to 8 bytes each
  ical_hash   CHAR(64)    NOT NULL,           -- PBKDF2-SHA256, hex-encoded
  ical_salt   CHAR(64)    NOT NULL,           -- random 32 bytes, hex-encoded
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_emoji_id ON users(emoji_id);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hash        CHAR(64)    NOT NULL,           -- PBKDF2-SHA256, hex-encoded
  salt        CHAR(64)    NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  CHAR(64)    NOT NULL UNIQUE,    -- SHA-256 of the plain token
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Note: no email addresses, no names, no IP addresses, no PII.
-- The only link between a user and their identity is:
--   emoji_id (public handle) + ical_hash (private credential)
