import axios from "axios";

interface AppointmentEmailPayload {
  ownerName: string;
  ownerEmail: string;
  requesterName: string;
  requesterEmail: string;
  reason: string;
  notes?: string;
  startIso: string;
  endIso: string;
  timezone?: string;
}

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL;
const MAILGUN_API_BASE = process.env.MAILGUN_API_BASE || "https://api.eu.mailgun.net";
const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || "http://localhost:5173";

if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !MAILGUN_FROM_EMAIL) {
  // eslint-disable-next-line no-console
  console.warn(
    "Mailgun environment variables are not fully configured. Email sending will fail."
  );
}

export async function sendAppointmentRequestEmail(
  payload: AppointmentEmailPayload
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("[Email] sendAppointmentRequestEmail called");
  // eslint-disable-next-line no-console
  console.log("[Email] MAILGUN_API_KEY set:", !!MAILGUN_API_KEY);
  // eslint-disable-next-line no-console
  console.log("[Email] MAILGUN_DOMAIN:", MAILGUN_DOMAIN);
  // eslint-disable-next-line no-console
  console.log("[Email] MAILGUN_API_BASE:", MAILGUN_API_BASE);

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN || !MAILGUN_FROM_EMAIL) {
    // eslint-disable-next-line no-console
    console.error("[Email] Mailgun not configured!");
    throw new Error("Mailgun not configured");
  }

  const { ownerName, ownerEmail } = payload;

  const start = new Date(payload.startIso);
  const end = new Date(payload.endIso);

  const tzLabel = payload.timezone ? ` (${payload.timezone})` : "";

  const subject = `Appointment Request: ${payload.requesterName} - ${start.toISOString()}${tzLabel}`;

  const bodyLines = [
    `You have received a new appointment request via Scheduler.\n`,
    `CALENDAR OWNER`,
    `- Name: ${ownerName}`,
    `- Email: ${ownerEmail}\n`,
    `REQUESTER`,
    `- Name: ${payload.requesterName}`,
    `- Email: ${payload.requesterEmail}\n`,
    `REQUESTED TIME`,
    `- From: ${start.toISOString()}${tzLabel}`,
    `- To:   ${end.toISOString()}${tzLabel}\n`,
    `REASON FOR MEETING`,
    payload.reason,
    "",
    payload.notes ? `ADDITIONAL NOTES\n${payload.notes}\n` : "",
    `NEXT STEPS`,
    `- Confirm the time is still available in your calendar.`,
    `- Create an event in your calendar for the agreed slot.`,
    `- Reply directly to the requester at ${payload.requesterEmail} to confirm or propose alternatives.\n`,
    `ABOUT THIS EMAIL`,
    `This request was sent via Scheduler. No event has been created automatically; you remain in full control of your calendar.\n`,
    `If you no longer wish to receive requests via this link, simply stop sharing it or generate a new link.`
  ];

  const text = bodyLines.join("\n");

  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

  const form = new URLSearchParams();
  form.append("from", MAILGUN_FROM_EMAIL);
  form.append("to", ownerEmail);
  form.append("subject", subject);
  form.append("text", text);

  const url = `${MAILGUN_API_BASE}/v3/${MAILGUN_DOMAIN}/messages`;
  // eslint-disable-next-line no-console
  console.log("[Email] Sending to URL:", url);
  // eslint-disable-next-line no-console
  console.log("[Email] To:", ownerEmail);

  try {
    const response = await axios.post(url, form, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      timeout: 10000
    });
    // eslint-disable-next-line no-console
    console.log("[Email] Success:", response.data);
  } catch (err: any) {
    const message = err.response?.data?.message || err.message;
    // eslint-disable-next-line no-console
    console.error(`[Email] Mailgun API error: ${message}`);
    // eslint-disable-next-line no-console
    console.error(`[Email] Full error:`, err.response?.data || err.message);
    throw new Error(`Email send failed: ${message}`);
  }
}

