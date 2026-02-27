![CalAnywhere logo](https://github.com/dajbelshaw/CalAnywhere/blob/main/calanywhere.jpg?raw=true)

## CalAnywhere

A privacy-first scheduling tool that works with any calendar. Paste your iCal URL, create a scheduling page, and share the link. Visitors see your free/busy times and can request a slot. No sign-up walls, no OAuth, no data collection.

### How it works

1. **Paste your iCal URL** — from Google Calendar, Outlook, Fastmail, Nextcloud, or any provider that offers an iCal feed
2. **Create a scheduling page** with your available times
3. **Share the link** — visitors see when you're free and can request a slot

That's it. CalAnywhere reads your calendar's public free/busy data. It never writes to your calendar or asks for write access.

### Architecture

```
backend/          # Express + TypeScript API
  src/routes/     # Scheduling pages API
  src/db/         # PostgreSQL with in-memory fallback
frontend/         # React + Vite + TypeScript UI
  src/pages/      # Scheduling page UI
  src/components/ # Shared UI components
```

### Self-hosting

#### Docker Compose

```bash
cp backend/.env.example backend/.env
# edit backend/.env with your values
docker compose up --build
```

The app will be available at `http://localhost`.

#### Manual setup

```bash
# Backend (from /backend)
npm install
npm run dev       # nodemon + ts-node, watches src/

# Frontend (from /frontend)
npm install
npm run dev       # Vite dev server on port 5173
```

The backend runs on port 4000 and falls back to an in-memory store when PostgreSQL is unavailable, so you can develop without Docker.

### Managed hosting

[Dynamic Skillset](https://dynamicskillset.com) runs a managed instance at [calanywhere.com](https://calanywhere.com) with additional features (dashboard, page management, encrypted notification emails). The managed platform source is at [dynamicskillset/calanywhere-cloud](https://github.com/dynamicskillset/calanywhere-cloud).

### Licence

[AGPL-3.0](LICENSE)

---

Created by [Doug Belshaw](https://dougbelshaw.com). Cloud platform by [Dynamic Skillset](https://dynamicskillset.com).
