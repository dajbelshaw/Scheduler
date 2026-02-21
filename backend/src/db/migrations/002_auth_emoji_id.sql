-- Migration: Emoji ID authentication
-- Adds auth columns to existing users table; creates sessions and recovery_codes.

-- Relax constraints for emoji-auth users who won't have email/display_name
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN display_name DROP NOT NULL;

-- Auth identity columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS emoji_id VARCHAR(32) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ical_hash CHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ical_salt CHAR(64);

CREATE INDEX IF NOT EXISTS idx_users_emoji_id ON users(emoji_id);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id         SERIAL PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hash       CHAR(64)    NOT NULL,
  salt       CHAR(64)    NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT false,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64)    NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
