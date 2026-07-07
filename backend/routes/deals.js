const { Router } = require('express')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getDeals, fetchSteamNews } = require('../utils/dealsAggregator')
const {
  getRuntimeDealSubscriptions,
  upsertRuntimeDealSubscription,
  removeRuntimeDealSubscription
} = require('../utils/runtimeStore')
const { optionalAuth } = require('../middleware/auth')
const { resolveGameIdentity } = require('../utils/gameResolver')

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/deals — list active deals (free games + discounts)
router.get('/', async (req, res, next) => {
  try {
    const { type, store, freeOnly } = req.query
    const deals = await getDeals({
      type: type || undefined,
      store: store || undefined,
      freeOnly: freeOnly === 'true' || freeOnly === '1'
    })

    res.json({
      ok: true,
      count: deals.length,
      deals
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/deals/free — shorthand for free games only
router.get('/free', async (_req, res, next) => {
  try {
    const deals = await getDeals({ freeOnly: true })
    res.json({ ok: true, count: deals.length, deals })
  } catch (error) {
    next(error)
  }
})

// GET /api/deals/news — Steam news for specific games
router.get('/news', async (req, res, next) => {
  try {
    const appIds = String(req.query.appIds || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!appIds.length) return res.status(400).json({ ok: false, error: 'appIds query param required (comma-separated Steam app IDs)' })

    const news = await fetchSteamNews(appIds.slice(0, 10))
    res.json({ ok: true, count: news.length, news })
  } catch (error) {
    next(error)
  }
})

// GET /api/deals/subscribe — get current user's subscription
router.get('/subscribe', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id
    if (!userId) return res.status(401).json({ ok: false, error: 'Authentication required' })

    if (isDatabaseReady()) {
      const prisma = getPrisma()
      const subs = await prisma.dealSubscription.findMany({
        where: { userId, isActive: true }
      })
      return res.json({ ok: true, subscriptions: subs })
    }

    const subs = getRuntimeDealSubscriptions(userId).filter((s) => s.isActive !== false)
    return res.json({ ok: true, subscriptions: subs })
  } catch (error) {
    next(error)
  }
})

// POST /api/deals/subscribe — subscribe to deal alerts (guest-friendly: email only)
router.post('/subscribe', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || null
    const email = String(req.body.email || req.user?.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'A valid email is required' })

    const minDiscountPct = Math.max(0, Math.min(100, Number(req.body.minDiscountPct) || 75))
    const notifyFreeGames = req.body.notifyFreeGames !== false
    const notifyDiscounts = req.body.notifyDiscounts !== false

    if (isDatabaseReady()) {
      const prisma = getPrisma()
      // Check for existing active subscription
      const existing = await prisma.dealSubscription.findFirst({
        where: { email, isActive: true }
      })
      if (existing) {
        const updated = await prisma.dealSubscription.update({
          where: { id: existing.id },
          data: { minDiscountPct, notifyFreeGames, notifyDiscounts, userId: userId || existing.userId }
        })
        return res.json({ ok: true, subscription: updated, action: 'updated' })
      }

      const subscription = await prisma.dealSubscription.create({
        data: {
          userId: userId || null,
          email,
          minDiscountPct,
          notifyFreeGames,
          notifyDiscounts,
          isActive: true
        }
      })
      return res.status(201).json({ ok: true, subscription, action: 'created' })
    }

    // Runtime store fallback
    const sub = upsertRuntimeDealSubscription(userId || email, {
      userId,
      email,
      minDiscountPct,
      notifyFreeGames,
      notifyDiscounts,
      isActive: true
    })
    return res.status(201).json({ ok: true, subscription: sub, action: 'created' })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/deals/subscribe — unsubscribe from deal alerts (guest-friendly)
router.delete('/subscribe', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || null
    const email = String(req.body.email || req.user?.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ ok: false, error: 'Email is required' })

    if (isDatabaseReady()) {
      const prisma = getPrisma()
      const whereClause = userId ? { userId, isActive: true } : { email, isActive: true }
      const subs = await prisma.dealSubscription.findMany({ where: whereClause })
      for (const sub of subs) {
        await prisma.dealSubscription.update({
          where: { id: sub.id },
          data: { isActive: false }
        })
      }
      return res.json({ ok: true, unsubscribed: subs.length })
    }

    // Runtime store fallback
    const key = userId || email
    const subs = getRuntimeDealSubscriptions(key)
    for (const sub of subs) {
      removeRuntimeDealSubscription(key, sub.id)
    }
    return res.json({ ok: true, unsubscribed: subs.length })
  } catch (error) {
    next(error)
  }
})

// POST /api/deals/price-alerts — per-game price alert, guest-friendly (email + gameSlug)
router.post('/price-alerts', optionalAuth, async (req, res, next) => {
  try {
    const email = String(req.body?.email || req.user?.email || '').trim().toLowerCase()
    const gameSlug = String(req.body?.gameSlug || '').trim()
    if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'A valid email is required' })
    if (!gameSlug) return res.status(400).json({ ok: false, error: 'gameSlug is required' })
    if (!isDatabaseReady()) return res.status(503).json({ ok: false, error: 'Price alerts require SQL database mode' })

    const identity = await resolveGameIdentity(gameSlug)
    if (!identity.game) return res.status(404).json({ ok: false, error: 'Game not found' })

    const prisma = getPrisma()
    const userId = req.user?.id || null
    const existing = await prisma.priceAlert.findFirst({
      where: { email, gameSlug: identity.canonicalSlug },
      orderBy: { createdAt: 'desc' }
    })

    const alert = existing
      ? await prisma.priceAlert.update({
          where: { id: existing.id },
          data: { isActive: true, ...(userId && !existing.userId ? { userId } : {}) }
        })
      : await prisma.priceAlert.create({
          data: { userId, email, gameSlug: identity.canonicalSlug, targetPrice: null, isActive: true }
        })

    res.status(existing ? 200 : 201).json({ ok: true, alert })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/deals/price-alerts — deactivate alerts for an email (+ optional game)
router.delete('/price-alerts', optionalAuth, async (req, res, next) => {
  try {
    const email = String(req.body?.email || req.user?.email || '').trim().toLowerCase()
    const gameSlug = String(req.body?.gameSlug || '').trim()
    if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'A valid email is required' })
    if (!isDatabaseReady()) return res.status(503).json({ ok: false, error: 'Price alerts require SQL database mode' })

    let canonicalSlug = null
    if (gameSlug) {
      const identity = await resolveGameIdentity(gameSlug)
      canonicalSlug = identity.game ? identity.canonicalSlug : gameSlug
    }

    const result = await getPrisma().priceAlert.updateMany({
      where: { email, ...(canonicalSlug ? { gameSlug: canonicalSlug } : {}) },
      data: { isActive: false }
    })

    res.json({ ok: true, deactivated: result.count })
  } catch (error) {
    next(error)
  }
})

module.exports = router
