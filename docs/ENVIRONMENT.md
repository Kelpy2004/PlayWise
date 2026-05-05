# Environment And Deployment Guide

PlayWise uses environment variables for all credentials, provider settings, scheduler timing, and deployment-specific values. Keep real values in `backend/.env` locally and in the hosting provider's environment variable dashboard for production.

Do not commit real `.env` files.

## Required Local Values

```text
PORT=4000
APP_ORIGIN=http://localhost:4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES=7d
```

## Database Settings

```text
DB_CONNECTION_LIMIT=5
PG_POOL_MAX=3
PG_IDLE_TIMEOUT_MS=10000
PG_CONNECTION_TIMEOUT_MS=30000
```

Use conservative connection settings on free-tier PostgreSQL or Supabase projects to avoid connection pool exhaustion.

## Auth Providers

Google sign-in:

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Optional providers are present in the template but can remain empty until configured:

```text
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
```

## Catalog And Pricing Integrations

```text
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
IGDB_CACHE_MS=21600000
IGDB_TOP_GAMES_LIMIT=500

ITAD_API_KEY=
ITAD_COUNTRY=IN
PRICE_CACHE_MS=21600000
```

## Tournament Discovery

```text
STARTGG_API_TOKEN=
STARTGG_TOURNAMENT_LIMIT=80
```

## Assistant

```text
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

If no key is configured or the provider fails, the assistant route should fall back to built-in responses instead of breaking the site.

## Email Delivery

```text
EMAIL_PROVIDER=smtp
EMAIL_FROM=
EMAIL_REPLY_TO=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_VERIFICATION_HOURS=24
```

For Gmail SMTP, use an app password instead of the normal account password. Free email providers can have daily send limits, so keep notification batch sizes conservative.

## Notification Jobs

```text
PRICE_ALERT_JOB_INTERVAL_MS=300000
TOURNAMENT_JOB_INTERVAL_MS=60000
TOURNAMENT_SOON_WINDOW_MINUTES=30
NOTIFICATION_BATCH_LIMIT=200
```

## Monitoring And Rate Limits

```text
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.15
API_RATE_LIMIT_MAX=180
```

## Deployment Checklist

- Set `APP_ORIGIN` to the public site/backend origin used by OAuth callbacks.
- Add the same OAuth callback URLs in Google Cloud Console.
- Set PostgreSQL connection strings in the backend host.
- Run Prisma schema setup with `npm --prefix backend run db:push` or the production migration command.
- Configure SMTP credentials before enabling live email notifications.
- Configure Sentry DSNs separately for frontend and backend if both are monitored.
- Verify `/api/health`, `/api/health/integrations`, `/sitemap.xml`, and `/robots.txt` after deployment.
