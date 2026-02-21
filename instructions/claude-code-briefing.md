# Claude Code Briefing: Emoji ID Auth Integration

## What this is

This session implements a new authentication system for CalAnywhere cloud, replacing the existing magic link auth in `cloud/auth/` with an Emoji ID-based system that requires no email addresses.

The new auth module was designed in a previous session. The files below are the starting point. Your job is to integrate them cleanly into the existing codebase.

---

## The stack

- **Runtime**: Node.js (check version in Dockerfile — needs 16+ for `Intl.Segmenter`)
- **Framework**: Express
- **Database**: PostgreSQL via `pg` (no ORM, raw queries)
- **Language**: TypeScript
- **Auth approach**: Emoji ID + iCal URL as possession factor + session cookies

---

## First steps

Before writing any code:

1. Read the existing `cloud/auth/` directory in full
2. Read `src/index.ts` (or wherever the Express app is initialised) to understand middleware and routing
3. Check whether a database migration system exists and how existing schema is managed
4. Check whether `cookie-parser` is already installed and registered as middleware
5. Read the existing `cloud/billing/` and `cloud/dashboard/` to understand how they reference user identity — the switch from email to Emoji ID will affect these

---

## What to replace

The existing `cloud/auth/` uses magic link authentication, which requires storing email addresses. This entire directory should be replaced with the new module. Do not extend or adapt the magic link system; remove it.

---

## New files to integrate

The following files form the new auth module. Integrate them as `cloud/auth/`:

### `emoji-alphabet.ts`
A curated set of 128 emoji for ID generation. Excludes flags, skin-tone variants, ZWJ sequences, and visually ambiguous emoji. Provides `EMOJI_ALPHABET` and `ALPHABET_SIZE` exports.

### `emoji-id.ts`
Generates and validates Emoji IDs (four emoji from the curated alphabet, giving 268,435,456 permutations). Key functions:
- `generateEmojiId()` — random generation, no uniqueness check
- `isValidEmojiId(id)` — validates format and alphabet membership using `Intl.Segmenter`
- `generateUniqueEmojiId(pool)` — checks against DB, retries up to 10 times
- `isEmojiIdTaken(pool, id)` — single uniqueness check

### `credentials.ts`
Hashes and verifies iCal URLs using PBKDF2-SHA256 with a per-user random salt. The iCal URL is the possession factor that replaces the email address in the auth flow. Key functions:
- `hashIcalUrl(url)` — returns `{ hash, salt }`
- `verifyIcalUrl(candidateUrl, stored)` — timing-safe comparison
- `isPlausibleIcalUrl(url)` — structural validation before fetching

**Note**: `pbkdf2Sync` is used intentionally. If this becomes a performance concern under load, suggest switching to the async version but do not change it without flagging.

### `recovery.ts`
Generates, stores, and consumes one-time recovery codes (5 per user, 128-bit entropy each, stored as PBKDF2-SHA256 hashes). Key functions:
- `generateRecoveryCodes()` — returns plain + hashed versions; plain shown to user once only
- `storeRecoveryCodes(pool, userId, codes)` — transactional insert
- `consumeRecoveryCode(pool, userId, candidateCode)` — timing-safe, marks code used
- `remainingRecoveryCodes(pool, userId)` — count of unused codes

### `session.ts`
Issues and validates session tokens. Plain token sent to client as httpOnly cookie; only SHA-256 hash stored in DB. Key functions:
- `createSession(pool, userId)` — returns plain token
- `validateSession(pool, token)` — returns `{ userId, emojiId }` or null
- `deleteSession(pool, token)` — sign out
- `purgeExpiredSessions(pool)` — call on a nightly cron

### `routes.ts`
Five Express endpoints:
- `GET /auth/suggest` — returns a suggested unique Emoji ID for the signup form
- `POST /auth/signup` — body: `{ emojiId?, icalUrl }`. Validates the iCal URL by fetching it, creates user, stores hashed credential, generates recovery codes, issues session. Returns `{ emojiId, recoveryCodes }` — codes shown once only.
- `POST /auth/signin` — body: `{ emojiId, icalUrl }`. Verifies credential, issues session.
- `POST /auth/recover` — body: `{ emojiId, recoveryCode, newIcalUrl? }`. Consumes one recovery code, optionally updates stored iCal URL, issues session.
- `POST /auth/signout` — clears session cookie and DB record.
- `GET /auth/me` — returns `{ emojiId }` for the current session, or 401.

The router is created by `createAuthRouter(pool)` and should be mounted at `/auth` in the main Express app.

### `middleware.ts`
`requireAuth(pool)` middleware that validates the session cookie and attaches `req.session = { userId, emojiId }` to the request. Use this to protect any route in `cloud/dashboard/` or `cloud/billing/` that requires authentication.

### `index.ts`
Barrel export. Import from here rather than individual files elsewhere in the codebase.

### `migration.sql`
Three tables: `users`, `recovery_codes`, `sessions`. No PII is stored in any of them. See the file for full schema and comments.

---

## Integration checklist

Work through these in order:

- [ ] `cookie-parser` installed and registered in Express app before auth routes
- [ ] `axios` available (used in `routes.ts` to validate iCal URLs by fetching them)
- [ ] Migration SQL reconciled with any existing schema — do not run destructively if other tables exist
- [ ] `createAuthRouter(pool)` mounted at `/auth` in the main Express app
- [ ] Existing references to email-based user identity in `cloud/dashboard/` and `cloud/billing/` updated to use Emoji ID or `userId`
- [ ] `purgeExpiredSessions(pool)` wired to a cron job or scheduled task
- [ ] Node.js version confirmed as 16+ in Dockerfile (required for `Intl.Segmenter`)
- [ ] Rate limiting confirmed on auth endpoints — `express-rate-limit` is already in `package.json`, check it is applied to `/auth/signin` and `/auth/recover` specifically
- [ ] Environment variable for `NODE_ENV` confirmed in Docker setup (affects cookie `secure` flag)

---

## Things to flag, not fix unilaterally

- If `pbkdf2Sync` needs to become async for performance reasons, flag it and wait for confirmation
- If the existing schema has a `users` table that conflicts with the migration, describe the conflict and propose options rather than resolving it silently
- If `Intl.Segmenter` is unavailable in the current Node version, flag the version and suggest the upgrade path
- If any existing dashboard or billing code stores or queries by email address, list every affected file before changing anything

---

## What success looks like

A user can:
1. Visit the signup page, receive a suggested Emoji ID, optionally choose their own
2. Provide a free/busy iCal URL
3. Receive five recovery codes to store offline
4. Sign back in using their Emoji ID and iCal URL
5. Recover access using a recovery code if their iCal URL changes

At no point is an email address collected, stored, or transmitted by CalAnywhere.
