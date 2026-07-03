const express = require('express')
const { z } = require('zod')

const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { inferTournamentStatus, loadTournaments } = require('../utils/tournamentCatalog')
const { resolveGameIdentity } = require('../utils/gameResolver')

const router = express.Router()

const guestSubscribeSchema = z.object({
  email: z.string().trim().email(),
  scope: z.enum(['ALL', 'GAME']).default('GAME'),
  gameSlug: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional().default(true)
})

const guestUnsubscribeSchema = z.object({
  email: z.string().trim().email(),
  gameSlug: z.string().trim().optional().nullable()
})

// Tournament game slugs come from providers (start.gg etc.), so they may not
// exist in the games catalog — canonicalize when possible, else keep as-is.
async function canonicalTournamentGameSlug(slug) {
  try {
    const identity = await resolveGameIdentity(slug)
    if (identity && identity.game) return identity.canonicalSlug
  } catch {
    /* keep provider slug */
  }
  return slug
}

const upsertTournamentSchema = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  gameSlug: z.string().trim().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  status: z.enum(['UPCOMING', 'LIVE_NOW', 'ENDED']).optional(),
  metadata: z.record(z.any()).optional().nullable()
})

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const queryGame = String(req.query.game || '').trim()
    const queryLimit = Number(req.query.limit || 0)
    const tournaments = await loadTournaments({
      gameQuery: queryGame || null,
      limit: Number.isFinite(queryLimit) && queryLimit > 0 ? queryLimit : undefined
    })
    res.json(tournaments)
  })
)

router.post(
  '/',
  requireAuth,
  requireAdmin,
  validateBody(upsertTournamentSchema),
  asyncHandler(async (req, res) => {
    if (!isDatabaseReady()) {
      throw new ApiError(503, 'Tournament writes require SQL database mode.')
    }

    const body = req.validatedBody
    const status = body.status || inferTournamentStatus(body)
    const prisma = getPrisma()
    const tournament = await prisma.tournament.upsert({
      where: { slug: body.slug },
      update: {
        title: body.title,
        gameSlug: body.gameSlug || null,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        status,
        metadata: body.metadata || null
      },
      create: {
        slug: body.slug,
        title: body.title,
        gameSlug: body.gameSlug || null,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        status,
        metadata: body.metadata || null
      }
    })

    res.status(201).json({
      ...tournament,
      startsAt: tournament.startsAt.toISOString(),
      endsAt: tournament.endsAt ? tournament.endsAt.toISOString() : null,
      createdAt: tournament.createdAt.toISOString(),
      updatedAt: tournament.updatedAt.toISOString()
    })
  })
)

// Guest-friendly tournament alerts: email + optional game scope, no login
// required (logged-in requests attach the user for dashboard visibility).
router.post(
  '/subscribe',
  optionalAuth,
  validateBody(guestSubscribeSchema),
  asyncHandler(async (req, res) => {
    if (!isDatabaseReady()) {
      throw new ApiError(503, 'Tournament subscriptions require SQL database mode.')
    }

    const body = req.validatedBody
    const email = body.email.toLowerCase()
    let gameSlug = null
    if (body.scope === 'GAME') {
      if (!body.gameSlug) throw new ApiError(400, 'A game slug is required when scope is GAME.')
      gameSlug = await canonicalTournamentGameSlug(body.gameSlug)
    }

    const prisma = getPrisma()
    const userId = req.user ? req.user.id : null
    const existing = await prisma.tournamentSubscription.findFirst({
      where: { email, scope: body.scope, gameSlug },
      orderBy: { createdAt: 'desc' }
    })

    const subscription = existing
      ? await prisma.tournamentSubscription.update({
          where: { id: existing.id },
          data: { isActive: body.isActive, ...(userId && !existing.userId ? { userId } : {}) }
        })
      : await prisma.tournamentSubscription.create({
          data: { userId, email, scope: body.scope, gameSlug, isActive: body.isActive }
        })

    res.status(existing ? 200 : 201).json({ ok: true, subscription })
  })
)

router.delete(
  '/subscribe',
  optionalAuth,
  validateBody(guestUnsubscribeSchema),
  asyncHandler(async (req, res) => {
    if (!isDatabaseReady()) {
      throw new ApiError(503, 'Tournament subscriptions require SQL database mode.')
    }

    const email = req.validatedBody.email.toLowerCase()
    const gameSlug = req.validatedBody.gameSlug
      ? await canonicalTournamentGameSlug(req.validatedBody.gameSlug)
      : null

    const result = await getPrisma().tournamentSubscription.updateMany({
      where: { email, ...(gameSlug ? { gameSlug } : {}) },
      data: { isActive: false }
    })

    res.json({ ok: true, unsubscribed: result.count })
  })
)

module.exports = router
