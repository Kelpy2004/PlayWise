const { Router } = require('express')
const { hasPostgresUrl, query } = require('../lib/postgres')
const { asyncHandler } = require('../lib/http')

const router = Router()

function requireDatabase(_req, res, next) {
  if (!hasPostgresUrl()) {
    return res.status(503).json({
      ok: false,
      error: 'Analytics require a PostgreSQL connection.'
    })
  }
  next()
}

router.use(requireDatabase)

router.get(
  '/trending',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)

    const result = await query(
      `
      with daily_views as (
        select
          "gameSlug",
          date_trunc('day', "createdAt") as day,
          count(*)::int as views
        from "GameView"
        where "createdAt" >= now() - make_interval(days => $1)
        group by "gameSlug", date_trunc('day', "createdAt")
      ),
      ranked as (
        select
          "gameSlug",
          sum(views)::int as total_views,
          round(avg(views), 1) as avg_daily,
          max(views)::int as peak_day,
          rank() over (order by sum(views) desc) as position
        from daily_views
        group by "gameSlug"
      )
      select
        r."gameSlug"       as "gameSlug",
        g.title            as title,
        r.total_views      as "totalViews",
        r.avg_daily        as "avgDaily",
        r.peak_day         as "peakDay",
        r.position::int    as position
      from ranked r
      left join "Game" g on g.slug = r."gameSlug"
      where r.position <= $2
      order by r.position
      `,
      [days, limit]
    )

    res.json({ ok: true, days, games: result.rows })
  })
)

router.get(
  '/price-movement',
  asyncHandler(async (req, res) => {
    const slug = req.query.slug
    if (!slug) {
      return res.status(400).json({ ok: false, error: 'slug query param required' })
    }

    const result = await query(
      `
      select
        "recordedAt",
        amount,
        currency,
        store,
        lag(amount)  over w as "prevAmount",
        lead(amount) over w as "nextAmount",
        amount - lag(amount)  over w as "changeFromPrev",
        round(
          ((amount - lag(amount) over w) / nullif(lag(amount) over w, 0)) * 100,
          1
        ) as "pctChange",
        min(amount)  over () as "allTimeLow",
        max(amount)  over () as "allTimeHigh",
        round(avg(amount) over (
          order by "recordedAt"
          rows between 6 preceding and current row
        ), 2) as "movingAvg7"
      from "PriceHistoryEntry"
      where "gameSlug" = $1
      window w as (order by "recordedAt")
      order by "recordedAt" desc
      limit 100
      `,
      [slug]
    )

    res.json({ ok: true, slug, entries: result.rows })
  })
)

router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365)

    const result = await query(
      `
      with daily as (
        select
          date_trunc('day', "createdAt")::date as day,
          count(distinct "userId") filter (where "userId" is not null)::int as users,
          count(*)::int as views
        from "GameView"
        where "createdAt" >= now() - make_interval(days => $1)
        group by date_trunc('day', "createdAt")
        order by day
      )
      select
        day,
        users,
        views,
        sum(views) over (order by day)::int as "cumulativeViews",
        sum(users) over (order by day)::int as "cumulativeUsers",
        round(avg(views) over (
          order by day
          rows between 6 preceding and current row
        ), 1) as "viewsMovingAvg7"
      from daily
      `,
      [days]
    )

    res.json({ ok: true, days, activity: result.rows })
  })
)

module.exports = router
