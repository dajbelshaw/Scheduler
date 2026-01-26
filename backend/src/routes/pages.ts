import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import { sendAppointmentRequestEmail } from "../services/email";
import { validateCalendarUrl, fetchAndParseCalendar } from "../services/calendar";
import { pagesStore } from "../store/pagesStore";

export const pagesRouter = Router();

// Types
interface CreatePageBody {
  calendarUrl: string;
  ownerName: string;
  ownerEmail: string;
  bio?: string;
  defaultDurationMinutes?: number;
  bufferMinutes?: number;
  dateRangeDays?: number;
  minNoticeHours?: number;
  includeWeekends?: boolean;
}

// Rate limiting: protect page creation and request endpoints
const createPageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50 // max 50 page creations per IP per hour
});

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20 // max 20 requests per IP per hour
});

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

  if (!body.calendarUrl || !body.ownerEmail || !body.ownerName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!isValidCalendarUrl(body.calendarUrl)) {
    return res.status(400).json({
      error:
        "The calendar URL is not allowed. Please provide a standard HTTPS iCalendar subscription link."
    });
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

  try {
    // Validate calendar URL and count events
    const validation = await validateCalendarUrl(body.calendarUrl);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error:
          "Could not load or parse your calendar. Please check the ICS URL and try again."
      });
    }

    const slug = generateSlug();
    const now = Date.now();
    const ttlHours = 24;
    const expiresAt = now + ttlHours * 60 * 60 * 1000;

    const page = pagesStore.create({
      slug,
      calendarUrl: body.calendarUrl,
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
        "Could not load or parse your calendar. Please check the ICS URL and try again."
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

    const busySlots = await fetchAndParseCalendar(
      page.calendarUrl,
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

// POST /api/pages/:slug/requests - submit an appointment request
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
    timezone
  } = req.body as {
    requesterName: string;
    requesterEmail: string;
    reason: string;
    notes?: string;
    startIso: string;
    endIso: string;
    timezone?: string;
  };

  if (
    !requesterName ||
    !requesterEmail ||
    !reason ||
    !startIso ||
    !endIso
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await sendAppointmentRequestEmail({
      ownerName: page.ownerName,
      ownerEmail: page.ownerEmail,
      requesterName,
      requesterEmail,
      reason,
      notes,
      startIso,
      endIso,
      timezone
    });

    return res.status(202).json({ status: "sent" });
  } catch (_err) {
    return res.status(502).json({
      error:
        "We could not send the email right now. Please try again later or email the calendar owner directly."
    });
  }
});

