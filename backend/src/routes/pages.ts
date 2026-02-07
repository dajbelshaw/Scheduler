import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import { sendAppointmentRequestEmail, sendVerificationEmail } from "../services/email";
import { pendingRequestsStore } from "../store/pendingRequestsStore";
import { validateMultipleCalendarUrls, fetchAndParseMultipleCalendars } from "../services/calendar";
import { pagesStore } from "../store/pagesStore";

export const pagesRouter = Router();

// Types
interface CreatePageBody {
  calendarUrl?: string;
  calendarUrls?: string[];
  ownerName: string;
  ownerEmail: string;
  bio?: string;
  defaultDurationMinutes?: number;
  bufferMinutes?: number;
  dateRangeDays?: number;
  minNoticeHours?: number;
  includeWeekends?: boolean;
  expiryHours?: number;
}

const ALLOWED_EXPIRY_HOURS = [1, 4, 12, 24, 72, 168, 336, 720];

// Rate limiting: protect page creation and request endpoints
const createPageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50 // max 50 page creations per IP per hour
});

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20 // max 20 requests per IP per hour
});

const confirmLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10 // max 10 confirmations per IP per hour
});

// Basic email format validation (no external dependency)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Basic calendar URL validation to mitigate SSRF
function isValidCalendarUrl(rawUrl: string): boolean {
  if (!rawUrl || rawUrl.length > 4096) return false;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const allowedProtocols = ["http:", "https:"];
  if (!allowedProtocols.includes(url.protocol)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  // Block obvious local/loopback hosts
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return false;
  }

  // Block common private IPv4 ranges by prefix
  if (
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("172.16.") ||
    hostname.startsWith("172.17.") ||
    hostname.startsWith("172.18.") ||
    hostname.startsWith("172.19.") ||
    hostname.startsWith("172.20.") ||
    hostname.startsWith("172.21.") ||
    hostname.startsWith("172.22.") ||
    hostname.startsWith("172.23.") ||
    hostname.startsWith("172.24.") ||
    hostname.startsWith("172.25.") ||
    hostname.startsWith("172.26.") ||
    hostname.startsWith("172.27.") ||
    hostname.startsWith("172.28.") ||
    hostname.startsWith("172.29.") ||
    hostname.startsWith("172.30.") ||
    hostname.startsWith("172.31.")
  ) {
    return false;
  }

  return true;
}

// Helper to generate cryptographically strong slug
function generateSlug(): string {
  // uuid without dashes is 32 chars; we can truncate to 22 for a compact, unguessable slug
  return uuidv4().replace(/-/g, "").slice(0, 22);
}

// POST /api/pages - create a new scheduling page
pagesRouter.post("/", createPageLimiter, async (req, res) => {
  const body = req.body as CreatePageBody;

  // Normalize calendarUrl / calendarUrls to a string[]
  let calendarUrls: string[];
  if (body.calendarUrls && Array.isArray(body.calendarUrls) && body.calendarUrls.length > 0) {
    calendarUrls = body.calendarUrls.filter((u) => typeof u === "string" && u.trim().length > 0);
  } else if (body.calendarUrl && typeof body.calendarUrl === "string" && body.calendarUrl.trim().length > 0) {
    calendarUrls = [body.calendarUrl];
  } else {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (calendarUrls.length === 0 || calendarUrls.length > 5) {
    return res.status(400).json({ error: "Provide between 1 and 5 calendar URLs." });
  }

  if (!body.ownerEmail || !body.ownerName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // SSRF check for each URL
  for (const url of calendarUrls) {
    if (!isValidCalendarUrl(url)) {
      return res.status(400).json({
        error:
          "One or more calendar URLs are not allowed. Please provide standard HTTPS iCalendar subscription links."
      });
    }
  }

  // Basic server-side validation for other fields
  if (body.ownerName.length < 2 || body.ownerName.length > 100) {
    return res.status(400).json({
      error: "Name must be between 2 and 100 characters."
    });
  }

  if (body.bio && body.bio.length > 200) {
    return res.status(400).json({
      error: "Bio must not exceed 200 characters."
    });
  }

  const dateRangeDays =
    body.dateRangeDays && body.dateRangeDays > 0
      ? Math.min(body.dateRangeDays, 180)
      : 60;

  // Configurable expiry
  const ttlHours = body.expiryHours && ALLOWED_EXPIRY_HOURS.includes(body.expiryHours)
    ? body.expiryHours
    : 24;

  try {
    // Validate all calendar URLs and count events
    const validation = await validateMultipleCalendarUrls(calendarUrls);

    if (!validation.isValid) {
      return res.status(400).json({
        error:
          "Could not load or parse your calendar(s). Please check the ICS URL(s) and try again."
      });
    }

    const slug = generateSlug();
    const now = Date.now();
    const expiresAt = now + ttlHours * 60 * 60 * 1000;

    const page = pagesStore.create({
      slug,
      calendarUrls,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      bio: body.bio,
      defaultDurationMinutes: body.defaultDurationMinutes ?? 30,
      bufferMinutes: body.bufferMinutes ?? 0,
      dateRangeDays,
      minNoticeHours: body.minNoticeHours ?? 8,
      includeWeekends: body.includeWeekends ?? false,
      createdAt: now,
      expiresAt
    });

    return res.status(201).json({
      slug,
      expiresAt,
      eventCount: validation.eventCount
    });
  } catch (err: any) {
    // Hide technical details from client
    return res.status(400).json({
      error:
        "Could not load or parse your calendar(s). Please check the ICS URL(s) and try again."
    });
  }
});

// GET /api/pages/:slug - fetch page metadata and current availability skeleton
pagesRouter.get("/:slug", async (req, res) => {
  const slug = req.params.slug;
  const page = pagesStore.get(slug);

  if (!page) {
    return res.status(404).json({
      error: "This scheduling link has expired or does not exist."
    });
  }

  // Fetch and parse calendar to generate free/busy data
  try {
    const now = new Date();
    const endDate = new Date(
      now.getTime() + (page.dateRangeDays ?? 60) * 24 * 60 * 60 * 1000
    );

    const busySlots = await fetchAndParseMultipleCalendars(
      page.calendarUrls,
      now,
      endDate
    );

    return res.json({
      slug: page.slug,
      ownerName: page.ownerName,
      ownerEmail: page.ownerEmail,
      bio: page.bio,
      defaultDurationMinutes: page.defaultDurationMinutes,
      bufferMinutes: page.bufferMinutes,
      dateRangeDays: page.dateRangeDays,
      minNoticeHours: page.minNoticeHours,
      includeWeekends: page.includeWeekends,
      expiresAt: page.expiresAt,
      busySlots
    });
  } catch (_err) {
    return res.status(502).json({
      error:
        "We could not fetch the calendar feed right now. Please try again later or regenerate a new link."
    });
  }
});

// POST /api/pages/:slug/requests - submit an appointment request (sends verification email)
pagesRouter.post("/:slug/requests", requestLimiter, async (req, res) => {
  const slug = req.params.slug;
  const page = pagesStore.get(slug);

  if (!page) {
    return res.status(404).json({
      error: "This scheduling link has expired or does not exist."
    });
  }

  const {
    requesterName,
    requesterEmail,
    reason,
    notes,
    startIso,
    endIso,
    timezone,
    honeypot
  } = req.body as {
    requesterName: string;
    requesterEmail: string;
    reason: string;
    notes?: string;
    startIso: string;
    endIso: string;
    timezone?: string;
    honeypot?: string;
  };

  // Honeypot check — bots fill this in, humans don't
  if (honeypot) {
    return res.status(202).json({ status: "verification_sent" });
  }

  if (
    !requesterName ||
    !requesterEmail ||
    !reason ||
    !startIso ||
    !endIso
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Server-side email format validation
  if (!EMAIL_RE.test(requesterEmail)) {
    return res.status(400).json({ error: "Please provide a valid email address." });
  }

  // Server-side length validation
  if (requesterName.length < 2 || requesterName.length > 100) {
    return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
  }
  if (reason.length < 10 || reason.length > 500) {
    return res.status(400).json({ error: "Reason must be between 10 and 500 characters." });
  }
  if (notes && notes.length > 500) {
    return res.status(400).json({ error: "Notes must not exceed 500 characters." });
  }

  try {
    // Store as pending and send verification email
    const pending = pendingRequestsStore.create({
      slug,
      requesterName,
      requesterEmail,
      reason,
      notes,
      startIso,
      endIso,
      timezone
    });

    const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const confirmUrl = `${protocol}://${req.hostname}/api/pages/${slug}/requests/${pending.token}/confirm`;

    await sendVerificationEmail({
      requesterEmail,
      requesterName,
      ownerName: page.ownerName,
      startIso,
      endIso,
      confirmUrl,
      timezone
    });

    return res.status(202).json({ status: "verification_sent" });
  } catch (_err) {
    return res.status(502).json({
      error:
        "We could not send the verification email right now. Please try again later."
    });
  }
});

// GET /api/pages/:slug/requests/:token/confirm - confirm an appointment request
pagesRouter.get("/:slug/requests/:token/confirm", confirmLimiter, async (req, res) => {
  const { slug, token } = req.params;

  const pending = pendingRequestsStore.get(token);

  if (!pending || pending.slug !== slug) {
    return res.status(200).contentType("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link Expired - Scheduler</title>
<style>body{font-family:system-ui,sans-serif;background:#5E81AC;color:#ECEFF4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem}
.card{max-width:28rem;text-align:center;background:#3B4252;border:1px solid #4C566A;border-radius:1rem;padding:2rem;box-shadow:0 4px 6px rgba(0,0,0,.3)}
h1{font-size:1.25rem;margin:0 0 .75rem}p{color:#D8DEE9;font-size:.875rem;margin:0}</style></head>
<body><div class="card"><h1>This link has expired or has already been used.</h1><p>Confirmation links are valid for 1 hour and can only be used once.</p></div></body></html>`);
  }

  const page = pagesStore.get(slug);

  if (!page) {
    pendingRequestsStore.delete(token);
    return res.status(200).contentType("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page Expired - Scheduler</title>
<style>body{font-family:system-ui,sans-serif;background:#5E81AC;color:#ECEFF4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem}
.card{max-width:28rem;text-align:center;background:#3B4252;border:1px solid #4C566A;border-radius:1rem;padding:2rem;box-shadow:0 4px 6px rgba(0,0,0,.3)}
h1{font-size:1.25rem;margin:0 0 .75rem}p{color:#D8DEE9;font-size:.875rem;margin:0}</style></head>
<body><div class="card"><h1>The scheduling page has expired.</h1><p>The calendar owner&rsquo;s scheduling link is no longer active.</p></div></body></html>`);
  }

  try {
    await sendAppointmentRequestEmail({
      ownerName: page.ownerName,
      ownerEmail: page.ownerEmail,
      requesterName: pending.requesterName,
      requesterEmail: pending.requesterEmail,
      reason: pending.reason,
      notes: pending.notes,
      startIso: pending.startIso,
      endIso: pending.endIso,
      timezone: pending.timezone
    });

    pendingRequestsStore.delete(token);

    const ownerFirst = page.ownerName.split(" ")[0];

    return res.status(200).contentType("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Request Confirmed - Scheduler</title>
<style>body{font-family:system-ui,sans-serif;background:#5E81AC;color:#ECEFF4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem}
.card{max-width:28rem;text-align:center;background:#3B4252;border:1px solid #4C566A;border-radius:1rem;padding:2rem;box-shadow:0 4px 6px rgba(0,0,0,.3)}
h1{font-size:1.25rem;margin:0 0 .75rem;color:#A3BE8C}p{color:#D8DEE9;font-size:.875rem;margin:0}</style></head>
<body><div class="card"><h1>Your appointment request has been sent!</h1><p>${ownerFirst} will receive your request and respond to you by email.</p></div></body></html>`);
  } catch (_err) {
    return res.status(502).contentType("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Error - Scheduler</title>
<style>body{font-family:system-ui,sans-serif;background:#5E81AC;color:#ECEFF4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem}
.card{max-width:28rem;text-align:center;background:#3B4252;border:1px solid #4C566A;border-radius:1rem;padding:2rem;box-shadow:0 4px 6px rgba(0,0,0,.3)}
h1{font-size:1.25rem;margin:0 0 .75rem;color:#DBA8AD}p{color:#D8DEE9;font-size:.875rem;margin:0}</style></head>
<body><div class="card"><h1>Something went wrong.</h1><p>We could not send the appointment request right now. Please try again later.</p></div></body></html>`);
  }
});
