![CalAnywhere logo](https://github.com/dynamicskillset/CalAnywhere/blob/main/calanywhere.jpg?raw=true)

## CalAnywhere Cloud

The managed hosting platform for [CalAnywhere](https://github.com/dajbelshaw/Scheduler), the privacy-first scheduling tool for any calendar.

### Architecture

This repository extends the open-source CalAnywhere core with cloud features:

```
backend/          # AGPL-3.0 core (synced from upstream)
frontend/         # AGPL-3.0 core (synced from upstream)
cloud/            # BSL-1.1 cloud additions
  auth/           # Authentication (magic links, sessions)
  dashboard/      # User dashboard & saved calendars
  billing/        # Stripe integration & subscription tiers
  oauth/          # Google Calendar OAuth integration
```

### Relationship to the open-source core

The core scheduling engine lives at [dajbelshaw/Scheduler](https://github.com/dajbelshaw/Scheduler) under AGPL-3.0. Anyone can self-host it for free.

This repository is a fork that adds:

- **User accounts** — magic link auth, persistent sessions
- **Saved calendars** — encrypted storage of calendar URLs
- **Persistent scheduling pages** — pages that don't expire
- **Google Calendar integration** — OAuth-based calendar access
- **Managed hosting** — the service at calanywhere.com
- **Billing** — Stripe subscriptions for premium features

### Deploy to Render (free tier)

You can deploy a fully working instance in a few minutes using [Render](https://render.com):

1. Fork this repo (or use it directly)
2. Go to **Render** → **New** → **Blueprint**
3. Select the repository — Render reads the included `render.yaml` and creates three services: **PostgreSQL**, **backend** (Node), and **frontend** (static site)
4. Fill in the environment variables when prompted:

   | Variable | Value |
   |---|---|
   | `MAILGUN_API_KEY` | Your Mailgun key (or `fake-key-123` to skip email) |
   | `MAILGUN_DOMAIN` | Your Mailgun domain (or `example.com`) |
   | `MAILGUN_FROM_EMAIL` | e.g. `CalAnywhere <no-reply@example.com>` |
   | `BASE_PUBLIC_URL` | Your frontend URL, e.g. `https://calanywhere-frontend.onrender.com` |

5. Click **Apply** — Render provisions the database, builds both services, and gives you a live URL

> **Note:** If Render names your backend something other than `calanywhere-backend`, update the `/api/*` rewrite URL in the frontend service's **Redirects/Rewrites** settings to match.

> **Note:** Free tier services sleep after 15 minutes of inactivity. The first request after idle takes ~30 seconds to wake up.

### Docker Compose (local)

```bash
cp backend/.env.example backend/.env
# edit backend/.env with your values
docker compose up --build
```

The app will be available at `http://localhost`.

### Syncing with upstream

```bash
git fetch upstream
git merge upstream/main
```

### License

- **`backend/` and `frontend/`** — [AGPL-3.0](https://github.com/dajbelshaw/Scheduler/blob/main/LICENSE) (inherited from upstream)
- **`cloud/` and all additions** — [BSL-1.1](LICENSE) (converts to AGPL-3.0 three years after each release)

See [LICENSE](LICENSE) for full terms.

---

Built by [Dynamic Skillset](https://dynamicskillset.com).
