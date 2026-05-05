# API Overview

PlayWise exposes REST endpoints from the Express backend. The API is grouped by product area so each route module owns one workflow.

## Public And Operational Routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Checks backend health and database readiness. |
| `GET /api/health/integrations` | Returns configured integration status without exposing secrets. |
| `GET /sitemap.xml` | Generates an SEO sitemap for public pages and game detail routes. |
| `GET /robots.txt` | Generates crawler rules for public deployment. |

## Route Groups

| Prefix | Module | Responsibility |
| --- | --- | --- |
| `/api/auth` | `backend/routes/auth.js` | Registration, login, OAuth, sessions, email verification. |
| `/api/games` | `backend/routes/games.js` | Game catalog, game detail, price data, reactions, favorites. |
| `/api/comments` | `backend/routes/comments.js` | Game comments and comment reactions. |
| `/api/contact` | `backend/routes/contact.js` | Contact form handling. |
| `/api/hardware` | `backend/routes/hardware.js` | Laptop presets, manual specs, compatibility checks. |
| `/api/telemetry` | `backend/routes/telemetry.js` | Client event and reliability telemetry. |
| `/api/users` | `backend/routes/users.js` | User-owned profile data and saved resources. |
| `/api/recommendations` | `backend/routes/recommendations.js` | Game recommendation and decision-support snapshots. |
| `/api/assistant` | `backend/routes/assistant.js` | PlayWise assistant responses and fallback behavior. |
| `/api/tournaments` | `backend/routes/tournaments.js` | Tournament discovery, event listing, and subscriptions. |
| `/api/newsletter` | `backend/routes/newsletter.js` | Newsletter subscription and unsubscribe workflows. |
| `/api/admin/notifications` | `backend/routes/adminNotifications.js` | Admin visibility for alerts, subscriptions, and deliveries. |

## Auth Model

- Password accounts use hashed passwords and email verification before login.
- OAuth accounts can link provider identities and receive sign-in notices.
- JWTs are issued after successful login or OAuth callback.
- Protected routes use auth middleware to verify user identity and role.

## Validation And Safety

- Request bodies are validated with Zod schemas where applicable.
- Public routes are rate-limited through backend configuration.
- Secrets are loaded from environment variables and never returned through API responses.
- Runtime fallback storage exists for development, but production workflows should use PostgreSQL.

## Notification Workflows

Notification routes and jobs coordinate across:

- Price alert subscriptions.
- Tournament subscriptions.
- Newsletter subscriptions.
- Account verification and welcome emails.
- Notification delivery logs for duplicate-send prevention and admin visibility.

## Local API Testing

Start the backend:

```bash
npm run start:backend
```

Check health:

```bash
curl http://localhost:4000/api/health
```

Check integrations:

```bash
curl http://localhost:4000/api/health/integrations
```

Use Postman or another REST client for authenticated flows. Add the returned JWT as a bearer token for protected routes.
