## CalAnywhere Cloud

![CalAnywhere logo](https://github.com/dynamicskillset/CalAnywhere/blob/main/calanywhere.jpg?raw=true)

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
