const { Router } = require('express')
const {
  getNews,
  getNewsSources,
  getNewsForGame,
} = require('../utils/newsAggregator')
const { resolveGameIdentity } = require('../utils/gameResolver')

const router = Router()

/* GET /api/news — all aggregated news (optional ?source=, ?limit=) */
router.get('/', async (req, res, next) => {
  try {
    const { source, limit } = req.query
    const items = await getNews({
      source: source || undefined,
      limit: limit || 100,
    })

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    res.json({
      ok: true,
      count: items.length,
      news: items,
    })
  } catch (error) {
    next(error)
  }
})

/* GET /api/news/sources — list of sources with article counts */
router.get('/sources', async (_req, res, next) => {
  try {
    // Make sure cache is warm so counts are accurate
    await getNews({ limit: 500 })
    const sources = getNewsSources()
    res.json({ ok: true, sources })
  } catch (error) {
    next(error)
  }
})

/* GET /api/news/game/:slug — per-game news (used on game detail page) */
router.get('/game/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim()
    if (!slug) {
      return res.status(400).json({ ok: false, error: 'Game slug required' })
    }

    let identity = null
    try {
      identity = await resolveGameIdentity(slug)
    } catch {
      identity = null
    }

    const game = identity?.game
    const steamAppId = game?.payload?.steamAppId
      || game?.payload?.appId
      || (typeof game?.payload?.steamUrl === 'string'
          ? (game.payload.steamUrl.match(/\/app\/(\d+)/) || [])[1]
          : null)

    const items = await getNewsForGame({
      slug: identity?.canonicalSlug || slug,
      title: game?.title || slug,
      steamAppId,
    })

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    res.json({
      ok: true,
      slug: identity?.canonicalSlug || slug,
      title: game?.title || null,
      count: items.length,
      news: items,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
