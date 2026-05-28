# PlayWise — Project Context

## What is PlayWise
PlayWise is a gaming aggregator platform that brings real-time game deals, prices, tournaments, and game intel from multiple gaming platforms under one roof. Instead of checking Steam, Epic, Xbox, Ubisoft individually, PlayWise aggregates everything into one dashboard.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite 6 + Tailwind CSS
- **Backend**: Express.js + Prisma ORM + PostgreSQL
- **Hosting**: Frontend on Vercel (`playwise-ui.vercel.app`), Backend on Render (`playwise-cda1.onrender.com`)
- **Repo**: `github.com/Kelpy2004/PlayWise` (branch: master)
- **Project directory**: `C:\Users\aryan\Desktop\PlayWise`

## Vercel Configuration
- Project: `kelpy2004s-projects/playwise-ui`
- `.vercel/project.json` exists in project root
- `vercel.json` has API proxy rewrite: `/api/*` to `https://playwise-cda1.onrender.com/api/$1` plus SPA fallback
- Framework: Vite, build command: `vite build`, output: `dist/`
- Dev server runs on port 3456 via `.claude/launch.json` (`playwise-dev`)

## Frontend Architecture
- SPA with React Router
- Pages: Home, Games Browse, Game Details, Deals, Tournaments, Auth, Admin, Open Source
- `src/lib/api.ts` — central API client. On Vercel, API base is `/api` (proxied to Render). On localhost:4000 uses `/api`. On other localhost ports calls Render directly.
- `src/components/TrendingSection.tsx` — "Hot This Week" on homepage. Top 8 deals (4 free + 4 discounts with images). Auto-refreshes every 5 min. 260px wide cards, 16:10 aspect ratio. Does NOT use `useScrollReveal` (removed to fix visibility bug).
- `src/pages/DealsPage.tsx` — Full deals page. Store colors: Epic (#0078f2), Steam (#1b2838), Ubisoft (#0070ff), Xbox (#107c10), NVIDIA (#76b900).
- `src/hooks/useScrollReveal.ts` — IntersectionObserver scroll reveal, used by TournamentsSection, SignalModules, FeaturesSection, CTASection. NOT used by TrendingSection.
- Games catalog uses localStorage caching (10 min TTL).

## Backend — Deals Pipeline
File: `backend/utils/dealsAggregator.js`

### 4 direct store providers (no third-party aggregators):
1. **Steam** — Specials, daily deal, new releases, top sellers from `featuredcategories` API (no key needed)
2. **Epic Games** — Free games promotions from static backend endpoint (no key needed)
3. **Xbox** — Game Pass sigls + Display Catalog two-step hydration (no key needed)
4. **Ubisoft** — Direct HTML scrape of `store.ubisoft.com/us/deals` (Demandware/SFCC, no key needed)

### Pipeline:
All 4 providers run via Promise.allSettled (parallel, resilient) -> Normalize to Deal schema -> Cross-source dedup by externalId AND normalized title+store -> Quality scoring (free +50, discount %) -> Upsert to PostgreSQL via Prisma -> Cache 30 min -> Serve via GET /api/deals

### API Routes (`backend/routes/deals.js`):
- `GET /api/deals` — all active deals (filter: type, store, freeOnly)
- `GET /api/deals/free` — free games only
- `GET /api/deals/news?appIds=730,570` — Steam news per game
- `GET/POST/DELETE /api/deals/subscribe` — deal alert subscriptions

### Platform API status:
- Steam: Official public APIs (featuredcategories, appdetails, ISteamNews) — no auth needed
- Epic Games: Static promotions endpoint — no auth needed
- Xbox: Game Pass sigls + Display Catalog — no auth needed
- Ubisoft: Official API dead (410 Gone) — using direct HTML scrape of store.ubisoft.com/us/deals
- NVIDIA: No deals API
- EA: All endpoints dead

## Key Files
- `backend/utils/dealsAggregator.js` — all deal providers + aggregation pipeline
- `backend/routes/deals.js` — deals API endpoints
- `backend/server.js` — Express server setup
- `backend/prisma/schema.prisma` — DB schema (Deal, DealSubscription models)
- `backend/lib/env.js` — environment config
- `backend/utils/runtimeStore.js` — in-memory fallback when DB unavailable
- `src/lib/api.ts` — frontend API client
- `src/components/TrendingSection.tsx` — homepage deals section
- `src/pages/DealsPage.tsx` — full deals page
- `src/pages/HomePage.tsx` — main landing page
- `src/components/AppShell.tsx` — nav layout (Deals link at line ~348)
- `vercel.json` — Vercel config with API proxy rewrite
- `backend/.env` — real environment variables (gitignored)

## Known Issues
- Games count may show stale data due to localStorage cache
- Render free tier has cold starts (~30s on first request after idle)

## User Preferences
- NO Claude references in git commits — never include Co-Authored-By lines
- Verify on localhost FIRST before any git push
- Direct store APIs only — no third-party aggregators (CheapShark, ITAD, GamerPower removed)
- Target stores: Steam, Epic Games, Ubisoft, Xbox
- Single project directory: `C:\Users\aryan\Desktop\PlayWise`

## Planned Next Steps
1. Admin Panel (`/admin/deals`) — manual deal management (add, edit, delete, feature)
2. Community deal submissions (users submit, admin approves)
3. More tournament integrations
