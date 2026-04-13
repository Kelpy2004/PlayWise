const express = require('express')
const { z } = require('zod')

const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { inferTournamentStatus, loadTournaments } = require('../utils/tournamentCatalog')

const router = express.Router()

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

module.exports = router
