## Scheduler

Privacy-respecting appointment scheduling for Proton Calendar and any iCalendar-compatible provider.

![Screenshot](https://github.com/dajbelshaw/Scheduler/blob/main/scheduler-screenshot.png?raw=true)

### Stack (chosen for MVP)

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express (TypeScript)
- **Storage**: In-memory store for active 24-hour URLs (pluggable, can later swap to Redis)
- **Email**: Mailgun transactional email via HTTP API

### High-level architecture

- **Backend API**
  - `POST /api/pages` – create a new scheduling page from an iCalendar URL and owner details; returns a unique 24h URL slug and expiration.
  - `GET /api/pages/:slug` – fetch scheduling page metadata and derived free/busy availability.
  - `POST /api/pages/:slug/requests` – submit an appointment request; sends email via Mailgun to the calendar owner.
- **Frontend SPA**
  - Home flow: paste ICS URL → validate and preview → enter owner info + options → generate shareable URL.
  - Scheduling page: show owner info + free/busy calendar → requester selects slot → submits request form.

### Local development

1. **Backend**
   - `cd backend`
   - (After dependencies are installed) `npm run dev`
2. **Frontend**
   - `cd frontend`
   - (After dependencies are installed) `npm run dev`

You will need to create a `.env` file for the backend with (at minimum):

```bash
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain
MAILGUN_FROM_EMAIL="Scheduler <no-reply@your-domain>"
BASE_PUBLIC_URL=http://localhost:5173
```


