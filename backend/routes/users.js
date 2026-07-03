const express = require('express')
const { z } = require('zod')

const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { requireAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { resolveGameIdentity } = require('../utils/gameResolver')
const {
  addRuntimeFavorite,
  findRuntimeNewsletterSubscriberByEmail,
  getRuntimeFavorites,
  getRuntimePriceAlerts,
  getRuntimeTournamentSubscriptions,
  removeRuntimeFavorite,
  removeRuntimePriceAlert,
  removeRuntimeTournamentSubscription,
  upsertRuntimeNewsletterSubscriber,
  upsertRuntimePriceAlert,
  upsertRuntimeTournamentSubscription
} = require('../utils/runtimeStore')

const router = express.Router()

const favoriteSchema = z.object({
  gameSlug: z.string().trim().min(1)
})


const priceAlertCreateSchema = z.object({
  gameSlug: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  isActive: z.boolean().optional().default(true)
})

const priceAlertUpdateSchema = z.object({
  isActive: z.boolean().optional()
})


const newsletterActionSchema = z.object({
  email: z.string().trim().email().optional()
})

const tournamentSubscriptionCreateSchema = z.object({
  scope: z.enum(['ALL', 'GAME']).default('ALL'),
  gameSlug: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional(),
  isActive: z.boolean().optional().default(true)
})

const tournamentSubscriptionUpdateSchema = z.object({
  isActive: z.boolean().optional()
})

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

router.get(
  '/me/favorites',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (isDatabaseReady()) {
      const favorites = await getPrisma().favoriteGame.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' }
      })
      return res.json(favorites.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })))
    }

    res.json(getRuntimeFavorites(req.user.id))
  })
)

router.post(
  '/me/favorites',
  requireAuth,
  validateBody(favoriteSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.validatedBody.gameSlug)

    if (!identity.game) {
      throw new ApiError(404, 'Game not found.')
    }

    if (isDatabaseReady()) {
      await getPrisma().favoriteGame.deleteMany({
        where: {
          userId: req.user.id,
          gameSlug: { in: identity.aliases.filter((slug) => slug !== identity.canonicalSlug) }
        }
      })

      const favorite = await getPrisma().favoriteGame.upsert({
        where: {
          userId_gameSlug: {
            userId: req.user.id,
            gameSlug: identity.canonicalSlug
          }
        },
        update: {},
        create: {
          userId: req.user.id,
          gameSlug: identity.canonicalSlug
        }
      })

      return res.status(201).json({ ...favorite, createdAt: favorite.createdAt.toISOString() })
    }

    res.status(201).json(addRuntimeFavorite(req.user.id, identity.canonicalSlug))
  })
)

router.post(
  '/me/favorites/remove',
  requireAuth,
  validateBody(favoriteSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.validatedBody.gameSlug)
    const aliases = identity.aliases.length ? identity.aliases : [req.validatedBody.gameSlug]

    if (isDatabaseReady()) {
      await getPrisma().favoriteGame.deleteMany({
        where: {
          userId: req.user.id,
          gameSlug: { in: aliases }
        }
      })

      return res.json({ ok: true })
    }

    aliases.forEach((slug) => removeRuntimeFavorite(req.user.id, slug))
    res.json({ ok: true })
  })
)

router.get(
  '/me/price-alerts',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (isDatabaseReady()) {
      const alerts = await getPrisma().priceAlert.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
      })
      return res.json(alerts)
    }

    res.json(getRuntimePriceAlerts(req.user.id))
  })
)

router.post(
  '/me/price-alerts',
  requireAuth,
  validateBody(priceAlertCreateSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.validatedBody.gameSlug)
    if (!identity.game) {
      throw new ApiError(404, 'Game not found.')
    }

    const email = normalizeEmail(req.validatedBody.email || req.user.email)
    if (!email) {
      throw new ApiError(400, 'A valid email is required for price alerts.')
    }

    if (isDatabaseReady()) {
      const existing = await getPrisma().priceAlert.findFirst({
        where: {
          userId: req.user.id,
          gameSlug: identity.canonicalSlug
        },
        orderBy: { createdAt: 'desc' }
      })

      const alert = existing
        ? await getPrisma().priceAlert.update({
            where: { id: existing.id },
            data: {
              email,
              isActive: true
            }
          })
        : await getPrisma().priceAlert.create({
            data: {
              userId: req.user.id,
              email,
              gameSlug: identity.canonicalSlug,
              targetPrice: null,
              isActive: req.validatedBody.isActive
            }
          })
      return res.status(201).json(alert)
    }

    const existing = getRuntimePriceAlerts(req.user.id).find((entry) => entry.gameSlug === identity.canonicalSlug)
    if (existing) {
      return res.status(201).json(
        upsertRuntimePriceAlert(req.user.id, {
          ...existing,
          email,
          isActive: true,
          updatedAt: new Date().toISOString()
        })
      )
    }

    res.status(201).json(
      upsertRuntimePriceAlert(req.user.id, {
        email,
        gameSlug: identity.canonicalSlug,
        targetPrice: null,
        isActive: req.validatedBody.isActive,
        lastTriggeredAt: null,
        lastNotifiedPrice: null,
        lastSeenPrice: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
  })
)

router.patch(
  '/me/price-alerts/:id',
  requireAuth,
  validateBody(priceAlertUpdateSchema),
  asyncHandler(async (req, res) => {
    if (isDatabaseReady()) {
      const existing = await getPrisma().priceAlert.findUnique({ where: { id: req.params.id } })
      if (!existing || existing.userId !== req.user.id) {
        throw new ApiError(404, 'Price alert not found.')
      }

      const alert = await getPrisma().priceAlert.update({
        where: { id: req.params.id },
        data: {
          ...(req.validatedBody.isActive !== undefined ? { isActive: req.validatedBody.isActive } : {})
        }
      })
      return res.json(alert)
    }

    const existing = getRuntimePriceAlerts(req.user.id).find((entry) => entry.id === req.params.id)
    if (!existing) {
      throw new ApiError(404, 'Price alert not found.')
    }

    res.json(
      upsertRuntimePriceAlert(req.user.id, {
        ...existing,
        ...(req.validatedBody.isActive !== undefined ? { isActive: req.validatedBody.isActive } : {}),
        updatedAt: new Date().toISOString()
      })
    )
  })
)

router.delete(
  '/me/price-alerts/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!String(req.params.id || '').trim()) {
      throw new ApiError(400, 'Price alert id is required.')
    }
    if (isDatabaseReady()) {
      const existing = await getPrisma().priceAlert.findUnique({ where: { id: req.params.id } })
      if (!existing || existing.userId !== req.user.id) {
        throw new ApiError(404, 'Price alert not found.')
      }
      await getPrisma().priceAlert.delete({ where: { id: req.params.id } })
      return res.json({ ok: true })
    }

    removeRuntimePriceAlert(req.user.id, req.params.id)
    res.json({ ok: true })
  })
)

router.get(
  '/me/newsletter',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fallbackEmail = normalizeEmail(req.user.email)
    if (isDatabaseReady()) {
      const subscriber = await getPrisma().newsletterSubscriber.findUnique({
        where: { email: fallbackEmail }
      })
      return res.json(
        subscriber || {
          email: fallbackEmail,
          isSubscribed: false
        }
      )
    }

    const runtime = findRuntimeNewsletterSubscriberByEmail(fallbackEmail)
    res.json(runtime || { email: fallbackEmail, isSubscribed: false })
  })
)

router.post(
  '/me/newsletter/subscribe',
  requireAuth,
  validateBody(newsletterActionSchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.validatedBody.email || req.user.email)
    if (!email) throw new ApiError(400, 'A valid email is required.')

    if (isDatabaseReady()) {
      const subscriber = await getPrisma().newsletterSubscriber.upsert({
        where: { email },
        update: {
          userId: req.user.id,
          isSubscribed: true,
          subscribedAt: new Date(),
          unsubscribedAt: null
        },
        create: {
          userId: req.user.id,
          email,
          isSubscribed: true,
          subscribedAt: new Date(),
          unsubscribedAt: null
        }
      })
      return res.json(subscriber)
    }

    res.json(
      upsertRuntimeNewsletterSubscriber({
        userId: req.user.id,
        email,
        isSubscribed: true,
        subscribedAt: new Date().toISOString(),
        unsubscribedAt: null,
        updatedAt: new Date().toISOString()
      })
    )
  })
)

router.post(
  '/me/newsletter/unsubscribe',
  requireAuth,
  validateBody(newsletterActionSchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.validatedBody.email || req.user.email)
    if (!email) throw new ApiError(400, 'A valid email is required.')

    if (isDatabaseReady()) {
      const subscriber = await getPrisma().newsletterSubscriber.upsert({
        where: { email },
        update: {
          userId: req.user.id,
          isSubscribed: false,
          unsubscribedAt: new Date()
        },
        create: {
          userId: req.user.id,
          email,
          isSubscribed: false,
          subscribedAt: new Date(),
          unsubscribedAt: new Date()
        }
      })
      return res.json(subscriber)
    }

    res.json(
      upsertRuntimeNewsletterSubscriber({
        userId: req.user.id,
        email,
        isSubscribed: false,
        unsubscribedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
  })
)

router.get(
  '/me/tournament-subscriptions',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (isDatabaseReady()) {
      const subscriptions = await getPrisma().tournamentSubscription.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
      })
      return res.json(subscriptions)
    }

    res.json(getRuntimeTournamentSubscriptions(req.user.id))
  })
)

router.post(
  '/me/tournament-subscriptions',
  requireAuth,
  validateBody(tournamentSubscriptionCreateSchema),
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.validatedBody.email || req.user.email)
    if (!email) throw new ApiError(400, 'A valid email is required.')

    let canonicalGameSlug = null
    if (req.validatedBody.scope === 'GAME') {
      if (!req.validatedBody.gameSlug) {
        throw new ApiError(400, 'A game slug is required when scope is GAME.')
      }
      // Tournament game slugs come from providers and may not exist in the games
      // catalog — canonicalize when we can, otherwise keep the provider slug.
      const identity = await resolveGameIdentity(req.validatedBody.gameSlug)
      canonicalGameSlug = identity.game ? identity.canonicalSlug : req.validatedBody.gameSlug
    }

    if (isDatabaseReady()) {
      const existing = await getPrisma().tournamentSubscription.findFirst({
        where: {
          userId: req.user.id,
          email,
          scope: req.validatedBody.scope,
          gameSlug: canonicalGameSlug
        },
        orderBy: { createdAt: 'desc' }
      })

      const subscription = existing
        ? await getPrisma().tournamentSubscription.update({
            where: { id: existing.id },
            data: { isActive: true }
          })
        : await getPrisma().tournamentSubscription.create({
            data: {
              userId: req.user.id,
              email,
              scope: req.validatedBody.scope,
              gameSlug: canonicalGameSlug,
              isActive: req.validatedBody.isActive
            }
          })
      return res.status(201).json(subscription)
    }

    const existing = getRuntimeTournamentSubscriptions(req.user.id).find(
      (entry) => entry.scope === req.validatedBody.scope && (entry.gameSlug || null) === canonicalGameSlug
    )
    if (existing) {
      return res.status(201).json(
        upsertRuntimeTournamentSubscription(req.user.id, {
          ...existing,
          email,
          isActive: true,
          updatedAt: new Date().toISOString()
        })
      )
    }

    res.status(201).json(
      upsertRuntimeTournamentSubscription(req.user.id, {
        email,
        scope: req.validatedBody.scope,
        gameSlug: canonicalGameSlug,
        isActive: req.validatedBody.isActive,
        lastSoonNotifiedAt: null,
        lastLiveNotifiedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    )
  })
)

router.patch(
  '/me/tournament-subscriptions/:id',
  requireAuth,
  validateBody(tournamentSubscriptionUpdateSchema),
  asyncHandler(async (req, res) => {
    if (isDatabaseReady()) {
      const existing = await getPrisma().tournamentSubscription.findUnique({ where: { id: req.params.id } })
      if (!existing || existing.userId !== req.user.id) {
        throw new ApiError(404, 'Tournament subscription not found.')
      }

      const subscription = await getPrisma().tournamentSubscription.update({
        where: { id: req.params.id },
        data: {
          ...(req.validatedBody.isActive !== undefined ? { isActive: req.validatedBody.isActive } : {})
        }
      })
      return res.json(subscription)
    }

    const existing = getRuntimeTournamentSubscriptions(req.user.id).find((entry) => entry.id === req.params.id)
    if (!existing) {
      throw new ApiError(404, 'Tournament subscription not found.')
    }

    res.json(
      upsertRuntimeTournamentSubscription(req.user.id, {
        ...existing,
        ...(req.validatedBody.isActive !== undefined ? { isActive: req.validatedBody.isActive } : {}),
        updatedAt: new Date().toISOString()
      })
    )
  })
)

router.delete(
  '/me/tournament-subscriptions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!String(req.params.id || '').trim()) {
      throw new ApiError(400, 'Tournament subscription id is required.')
    }
    if (isDatabaseReady()) {
      const existing = await getPrisma().tournamentSubscription.findUnique({ where: { id: req.params.id } })
      if (!existing || existing.userId !== req.user.id) {
        throw new ApiError(404, 'Tournament subscription not found.')
      }
      await getPrisma().tournamentSubscription.delete({ where: { id: req.params.id } })
      return res.json({ ok: true })
    }

    removeRuntimeTournamentSubscription(req.user.id, req.params.id)
    res.json({ ok: true })
  })
)

module.exports = router
