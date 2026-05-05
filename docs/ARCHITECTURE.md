# PlayWise Architecture

This document explains how the main PlayWise systems fit together.

## High-Level Flow

```text
React UI
  -> Express REST API
  -> PostgreSQL / Prisma models
  -> External APIs and notification workers
```

The frontend is responsible for discovery, game detail pages, auth screens, wishlist interactions, compatibility inputs, pricing visuals, and assistant UI. The backend owns validation, persistence, auth, catalog sync, pricing lookup, tournament discovery, notification scheduling, and monitoring.

## Frontend Layers

- `src/pages` contains route-level screens such as home, game detail, auth, admin, tournament, and browse pages.
- `src/context` stores app-wide user session state.
- `src/lib` centralizes API access and client helpers.
- `src/components` contains reusable UI sections and product widgets.

The frontend calls the backend through REST endpoints and keeps local UI state limited to interaction state, filters, active selections, and optimistic feedback.

## Backend Layers

- `backend/server.js` boots Express, middleware, routes, static assets, database startup, seeds, catalog sync, and notification jobs.
- `backend/routes` contains feature-specific REST route modules.
- `backend/lib` contains shared environment, HTTP, logging, PostgreSQL, and Prisma helpers.
- `backend/utils` contains product services such as catalog sync, email templates, notification jobs, SEO, tournament discovery, and runtime fallback storage.
- `backend/prisma/schema.prisma` documents the SQL-backed domain model.

## Data Model Areas

The database stores:

- Users, provider accounts, and email verification tokens.
- Games, catalog metadata, pricing signals, and game views.
- Comments, game reactions, comment reactions, and favorites.
- Saved hardware profiles and compatibility-related user data.
- Price alerts, newsletter subscribers, tournament subscriptions, and notification deliveries.
- Telemetry and recommendation snapshots.

## Auth And Account System

PlayWise supports password-based auth, JWT sessions, Google OAuth, role-aware access, and email verification. Password accounts must verify their email before sign-in. OAuth users can receive sign-in notices for account security.

## Notification System

Notification workflows are split into three responsibilities:

- Subscription routes store user intent for price, tournament, and newsletter updates.
- Scheduler jobs periodically evaluate price and tournament data.
- Email helpers render and send verification, welcome, price, tournament, and newsletter-style messages.

Duplicate-notification prevention is handled by storing delivery records and last notification state.

## External Integrations

PlayWise is designed to keep external APIs behind backend services so frontend pages do not depend directly on third-party credentials.

- Game catalog and metadata enrichment: IGDB and related catalog sources.
- Pricing signals: ITAD/CheapShark-style store and discount sources.
- Tournament discovery: start.gg registration/event data.
- Assistant responses: Gemini API with fallback behavior.
- Monitoring: Sentry.
- Email delivery: SMTP-compatible providers such as Gmail SMTP.

## Runtime Fallback

When a SQL database is not available, some flows can use runtime fallback storage for development. Production should use PostgreSQL so user activity, alerts, comments, and account records persist reliably.

## Production Concerns

- Keep secrets out of Git and configure them through deployment environment variables.
- Use PostgreSQL/Supabase session pooling where needed to avoid connection exhaustion.
- Keep notification batch sizes and scheduler intervals conservative for free-tier email providers.
- Monitor backend errors and external API failures through Sentry and structured logs.
- Treat SEO routes and sitemap output as part of deployment readiness.
