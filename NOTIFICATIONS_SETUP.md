# PlayWise Notifications Setup

This document covers the subscription + notification system for:

- Price alerts
- Newsletter subscriptions
- Tournament notifications (starting soon / live now)

## 1. Environment Variables

Set these in `backend/.env`:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=PlayWise <no-reply@yourdomain.com>
EMAIL_REPLY_TO=support@yourdomain.com
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password

PRICE_ALERT_JOB_INTERVAL_MS=300000
TOURNAMENT_JOB_INTERVAL_MS=60000
TOURNAMENT_SOON_WINDOW_MINUTES=30
NOTIFICATION_BATCH_LIMIT=200
STARTGG_API_TOKEN=
STARTGG_TOURNAMENT_LIMIT=30
```

Required DB var:

```env
DATABASE_URL=postgresql://...
```

## 2. Install + Generate

From project root:

```bash
npm --prefix backend install
npm --prefix backend run db:generate
```

## 3. Apply Schema Changes

From project root:

```bash
npm --prefix backend run db:push
```

This creates/updates:

- `PriceAlert`
- `NewsletterSubscriber`
- `Tournament`
- `TournamentSubscription`
- `NotificationDelivery`

## 4. Runtime Behavior

- Notification jobs start automatically when backend starts:
  - Price alert worker
  - Tournament notification worker
- Third-party tournament feed:
  - Provider: start.gg
  - If `STARTGG_API_TOKEN` is set, PlayWise fetches upcoming registration tournaments from start.gg.
  - If start.gg is unavailable or key is missing, PlayWise falls back to local tournament records.
- Duplicate sends are prevented by:
  - `PriceAlert.lastNotifiedPrice`
  - `TournamentSubscription.lastSoonNotifiedAt`
  - `TournamentSubscription.lastLiveNotifiedAt`
- All sends are logged in `NotificationDelivery`.

## 5. Verification Checklist

1. Start app:

```bash
npm start
```

2. Check health:

```bash
GET /api/health
```

3. Validate routes:

- `GET /api/tournaments`
- `POST /api/newsletter/subscribe`
- `POST /api/newsletter/unsubscribe`
- Auth routes:
  - `GET /api/users/me/price-alerts`
  - `POST /api/users/me/price-alerts`
  - `GET /api/users/me/tournament-subscriptions`
  - `POST /api/users/me/tournament-subscriptions`

4. Admin visibility:

- `GET /api/admin/notifications/overview`
- `GET /api/admin/notifications/price-alerts`
- `GET /api/admin/notifications/newsletter-subscribers`
- `GET /api/admin/notifications/tournament-subscribers`
- `GET /api/admin/notifications/deliveries`

## 6. UI Surfaces Added

- Game page:
  - Price alert create/remove block
  - Tournament notification block
  - Center popup for tournament alerts with close (`X`)
- Home page:
  - Newsletter subscribe section
- Admin page:
  - Notification overview counters
  - Recent price alerts
  - Newsletter subscribers
  - Tournament subscribers
  - Recent delivery logs
