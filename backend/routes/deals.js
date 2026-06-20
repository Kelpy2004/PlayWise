const { Router } = require('express')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getDeals, fetchSteamNews } = require('../utils/dealsAggregator')
const {
  getRuntimeDealSubscriptions,
  upsertRuntimeDealSubscription,
  removeRuntimeDealSubscription
} = require('../utils/runtimeStore')
const { optionalAuth, requireAuth } = require('../middleware/auth')

const router = Router()

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

// POST /api/deals/subscribe — subscribe to deal alerts
router.post('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id
    const email = String(req.body.email || req.user.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ ok: false, error: 'Email is required' })

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

// DELETE /api/deals/subscribe — unsubscribe from deal alerts
router.delete('/subscribe', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id
    const email = String(req.body.email || req.user.email || '').trim().toLowerCase()
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

module.exports = router
