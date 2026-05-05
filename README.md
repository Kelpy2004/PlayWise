# PlayWise

PlayWise is a game decision-support platform that helps players decide what to buy, download, save, or join. It brings game discovery, price tracking, hardware compatibility, wishlist activity, community comments, tournament registration discovery, and alerts into one workflow.

The goal is simple: reduce the time players spend jumping between store pages, specs pages, reviews, and event sites before deciding whether a game is worth their time and money.

## What PlayWise Does

- Indexes a large game catalog with metadata, ratings, pricing signals, and event context.
- Helps users check whether a game should run on their laptop or custom hardware specs.
- Tracks pricing and historical price movement to support buy-or-wait decisions.
- Lets users save games to a wishlist, react to games, and comment on game pages.
- Finds tournament registration opportunities and links users to official registration pages.
- Sends account, price, tournament, and newsletter-style email notifications.
- Provides SEO-friendly routes, sitemap output, monitoring hooks, and production configuration.

## Core User Flows

- A visitor browses or searches games from the catalog.
- A user opens a game page and checks overview, compatibility, pricing, community feedback, and tournament opportunities.
- A signed-in user can save the game, react, comment, set alerts, and receive notifications.
- Admin-ready views expose subscriptions, notification deliveries, and operational data for future management.

## Tech Stack

- Frontend: React, TypeScript, Vite, React Router, Sentry React, responsive CSS.
- Backend: Node.js, Express, REST APIs, Zod validation, JWT auth, Google OAuth, Nodemailer.
- Database: PostgreSQL, Supabase-compatible connection strings, Prisma schema, SQL-backed persistence.
- Integrations: IGDB, RAWG/metadata-style catalog sources, ITAD/CheapShark-style pricing, start.gg tournament discovery, Gemini assistant support, Sentry monitoring.
- Deployment: Vercel for frontend assets and Render/Node hosting for the backend.

## Project Structure

```text
.
├── backend/
│   ├── prisma/              # Prisma schema and database models
│   ├── routes/              # Express route modules
│   ├── utils/               # Catalog, notification, email, SEO, auth helpers
│   └── server.js            # Backend entry point
├── public/                  # Static frontend assets
├── src/                     # React frontend source
├── package.json             # Frontend scripts
└── vite.config.ts           # Vite configuration
```

## Local Setup

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
npm --prefix backend install
```

Create backend environment config:

```bash
copy backend\.env.example backend\.env
```

Push Prisma schema to the database:

```bash
npm --prefix backend run db:push
```

Run the full app:

```bash
npm start
```

For development, run frontend and backend separately:

```bash
npm run dev:frontend
npm run dev:backend
```

## Useful Scripts

```bash
npm run build
npm run typecheck
npm --prefix backend run db:generate
npm --prefix backend run db:push
npm --prefix backend run catalog:sync
```

## Environment Notes

Use `backend/.env.example` as the safe public template. Real secrets belong only in `backend/.env` or in deployment provider environment variables.

Important optional integrations include:

- `DATABASE_URL` for PostgreSQL/Supabase.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google sign-in.
- `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` for catalog enrichment.
- `ITAD_API_KEY` and price cache settings for pricing workflows.
- `STARTGG_API_TOKEN` for tournament registration discovery.
- SMTP settings for verification emails and alerts.
- `SENTRY_DSN` for backend monitoring.

## Production Readiness

PlayWise includes:

- JWT authentication and OAuth account linking.
- Email verification and account notification flows.
- API validation and rate limiting.
- Sentry monitoring hooks.
- SEO routes for sitemap and robots output.
- Environment-based configuration for local and deployed environments.
- Background notification jobs for price and tournament workflows.

## Status

PlayWise is an active full-stack project focused on real product workflows: game discovery, decision support, user persistence, and automated alerts.
