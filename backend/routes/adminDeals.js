const { Router } = require('express')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { refreshDeals } = require('../utils/dealsAggregator')
const { logger } = require('../lib/logger')

const router = Router()
router.use(requireAuth, requireAdmin)

const VALID_STORES = ['Steam', 'Epic Games Store', 'Ubisoft Store', 'Xbox', 'NVIDIA', 'EA']
const VALID_TYPES = ['FREE_GAME', 'DISCOUNT', 'MISSION_FREE']

// GET /api/admin/deals — list all deals (including inactive), with filters + pagination
router.get('/', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ ok: false, error: 'Database not available' })
    }

    const prisma = getPrisma()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
    const skip = (page - 1) * limit

    const where = {}
    if (req.query.store) {
      where.store = { contains: req.query.store, mode: 'insensitive' }
    }
    if (req.query.type) {
      where.type = req.query.type
    }
    if (req.query.source) {
      where.source = req.query.source
    }
    if (req.query.active === 'true') where.isActive = true
    if (req.query.active === 'false') where.isActive = false
    if (req.query.q) {
      where.title = { contains: req.query.q, mode: 'insensitive' }
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: limit
      }),
      prisma.deal.count({ where })
    ])

    res.json({
      ok: true,
      deals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/deals — create a deal manually
router.post('/', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ ok: false, error: 'Database not available' })
    }

    const { title, type, store, originalPrice, dealPrice, discountPct, currency, url, imageUrl, startsAt, endsAt, gameSlug } = req.body

    if (!title?.trim()) return res.status(400).json({ ok: false, error: 'Title is required' })
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ ok: false, error: `Type must be one of: ${VALID_TYPES.join(', ')}` })
    if (!store?.trim()) return res.status(400).json({ ok: false, error: 'Store is required' })

    const prisma = getPrisma()
    const slug = gameSlug || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const externalId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const deal = await prisma.deal.create({
      data: {
        externalId,
        type,
        title: title.trim(),
        gameSlug: slug,
        store: store.trim(),
        originalPrice: originalPrice != null ? parseFloat(originalPrice) : null,
        dealPrice: dealPrice != null ? parseFloat(dealPrice) : 0,
        discountPct: discountPct != null ? parseInt(discountPct) : (type === 'FREE_GAME' ? 100 : 0),
        currency: currency || 'USD',
        url: url || '#',
        imageUrl: imageUrl || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        source: 'admin',
        metadata: { createdBy: req.user?.username || 'admin' },
        isActive: true
      }
    })

    logger.info({ dealId: deal.id, title: deal.title }, 'Admin created deal')
    res.status(201).json({ ok: true, deal })
  } catch (error) {
    next(error)
  }
})

// PUT /api/admin/deals/:id — update a deal
router.put('/:id', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ ok: false, error: 'Database not available' })
    }

    const prisma = getPrisma()
    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'Deal not found' })

    const updates = {}
    const { title, type, store, originalPrice, dealPrice, discountPct, currency, url, imageUrl, startsAt, endsAt, isActive, gameSlug } = req.body

    if (title !== undefined) updates.title = title.trim()
    if (type !== undefined && VALID_TYPES.includes(type)) updates.type = type
    if (store !== undefined) updates.store = store.trim()
    if (originalPrice !== undefined) updates.originalPrice = originalPrice != null ? parseFloat(originalPrice) : null
    if (dealPrice !== undefined) updates.dealPrice = dealPrice != null ? parseFloat(dealPrice) : 0
    if (discountPct !== undefined) updates.discountPct = discountPct != null ? parseInt(discountPct) : 0
    if (currency !== undefined) updates.currency = currency
    if (url !== undefined) updates.url = url
    if (imageUrl !== undefined) updates.imageUrl = imageUrl || null
    if (startsAt !== undefined) updates.startsAt = startsAt ? new Date(startsAt) : null
    if (endsAt !== undefined) updates.endsAt = endsAt ? new Date(endsAt) : null
    if (isActive !== undefined) updates.isActive = Boolean(isActive)
    if (gameSlug !== undefined) updates.gameSlug = gameSlug

    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: updates
    })

    logger.info({ dealId: deal.id, title: deal.title }, 'Admin updated deal')
    res.json({ ok: true, deal })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/admin/deals/:id — permanently delete a deal
router.delete('/:id', async (req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ ok: false, error: 'Database not available' })
    }

    const prisma = getPrisma()
    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'Deal not found' })

    await prisma.deal.delete({ where: { id: req.params.id } })

    logger.info({ dealId: req.params.id, title: existing.title }, 'Admin deleted deal')
    res.json({ ok: true, deleted: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/deals/refresh — trigger a manual refresh from direct store APIs
router.post('/refresh', async (_req, res, next) => {
  try {
    const deals = await refreshDeals()
    res.json({ ok: true, message: 'Refresh complete', count: deals.length })
  } catch (error) {
    next(error)
  }
})

// POST /api/admin/deals/purge-old-sources — remove deals from retired third-party sources
router.post('/purge-old-sources', async (_req, res, next) => {
  try {
    if (!isDatabaseReady()) {
      return res.status(503).json({ ok: false, error: 'Database not available' })
    }

    const prisma = getPrisma()
    const oldSources = ['cheapshark', 'cheapshark-epic', 'itad', 'gamerpower', 'reddit']

    const result = await prisma.deal.deleteMany({
      where: { source: { in: oldSources } }
    })

    logger.info({ deleted: result.count, sources: oldSources }, 'Purged old-source deals')
    res.json({ ok: true, deleted: result.count, sources: oldSources })
  } catch (error) {
    next(error)
  }
})

module.exports = router
