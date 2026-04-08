const express = require('express')
const { z } = require('zod')

const { LAPTOP_LIBRARY, CPU_SCORES, GPU_SCORES, estimatePerformance } = require('../utils/hardware')
const { getPriceSnapshot } = require('../utils/priceTracker')
const { loadGames } = require('../utils/gameCatalog')
const { resolveGameIdentity } = require('../utils/gameResolver')
const { ApiError, asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { optionalAuth, requireAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { getRuntimeGameReactionSummary, setRuntimeGameReaction } = require('../utils/runtimeStore')

const router = express.Router()

const reactionSchema = z.object({
  reaction: z.enum(['LIKE', 'DISLIKE']).nullable().optional().default(null)
})

function buildSearchText(game) {
  const genres = Array.isArray(game.genres)
    ? game.genres
    : Array.isArray(game.genre)
      ? game.genre
      : game.genre
        ? [game.genre]
        : []

  return [game.title, ...genres, game.heroTag || '', game.description || ''].join(' ').toLowerCase()
}

function getRuntimeReactionSummaryForAliases(aliases, userId) {
  const uniqueAliases = Array.from(new Set(aliases.filter(Boolean)))
  let likeCount = 0
  let dislikeCount = 0
  let userReaction = null

  for (const slug of uniqueAliases) {
    const summary = getRuntimeGameReactionSummary(slug, userId)
    likeCount += Number(summary.likeCount) || 0
    dislikeCount += Number(summary.dislikeCount) || 0
    userReaction ||= summary.userReaction || null
  }

  return { likeCount, dislikeCount, userReaction }
}

async function getGameReactionSummary(canonicalSlug, userId, aliases = [canonicalSlug]) {
  const uniqueAliases = Array.from(new Set(aliases.filter(Boolean)))

  if (!isDatabaseReady()) {
    return {
      gameSlug: canonicalSlug,
      ...getRuntimeReactionSummaryForAliases(uniqueAliases, userId)
    }
  }

  const prisma = getPrisma()
  const [likeCount, dislikeCount, userReaction] = await Promise.all([
    prisma.gameReaction.count({ where: { gameSlug: { in: uniqueAliases }, reaction: 'LIKE' } }),
    prisma.gameReaction.count({ where: { gameSlug: { in: uniqueAliases }, reaction: 'DISLIKE' } }),
    userId
      ? prisma.gameReaction.findFirst({
          where: {
            userId,
            gameSlug: { in: uniqueAliases }
          },
          orderBy: { updatedAt: 'desc' }
        })
      : null
  ])

  return {
    gameSlug: canonicalSlug,
    likeCount,
    dislikeCount,
    userReaction: userReaction?.reaction || null
  }
}

async function setGameReactionWithSql(canonicalSlug, aliases, userId, reaction) {
  const prisma = getPrisma()
  const uniqueAliases = Array.from(new Set([...aliases.filter(Boolean), canonicalSlug]))

  if (!reaction) {
    await prisma.gameReaction.deleteMany({
      where: {
        userId,
        gameSlug: { in: uniqueAliases }
      }
    })
  } else {
    await prisma.gameReaction.deleteMany({
      where: {
        userId,
        gameSlug: { in: uniqueAliases.filter((slug) => slug !== canonicalSlug) }
      }
    })

    await prisma.gameReaction.upsert({
      where: {
        userId_gameSlug: {
          userId,
          gameSlug: canonicalSlug
        }
      },
      update: { reaction },
      create: {
        userId,
        gameSlug: canonicalSlug,
        reaction
      }
    })
  }

  return getGameReactionSummary(canonicalSlug, userId, uniqueAliases)
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = String(req.query.q || '').trim().toLowerCase()
    const games = await loadGames()
    const filtered = !query ? games : games.filter((game) => buildSearchText(game).includes(query))
    res.json(filtered)
  })
)

router.get('/hardware/library', (_req, res) => {
  res.json({ laptops: LAPTOP_LIBRARY, cpuScores: CPU_SCORES, gpuScores: GPU_SCORES })
})

router.get(
  '/:slug/prices',
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.params.slug)
    const snapshot = await getPriceSnapshot(identity.canonicalSlug, {
      forceRefresh: req.query.refresh === '1',
      title: identity.game?.title
    })

    res.json(snapshot)
  })
)

router.get(
  '/:slug/reactions',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.params.slug)
    res.json(await getGameReactionSummary(identity.canonicalSlug, req.user?.id, identity.aliases))
  })
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const { game } = await resolveGameIdentity(req.params.slug)

    if (!game) {
      return res.status(404).json({ message: 'Game not found' })
    }

    res.json(game)
  })
)

router.post(
  '/:slug/reactions',
  requireAuth,
  validateBody(reactionSchema),
  asyncHandler(async (req, res) => {
    const identity = await resolveGameIdentity(req.params.slug)
    const game = identity.game

    if (!game) {
      throw new ApiError(404, 'Game not found.')
    }

    if (!isDatabaseReady()) {
      return res.json({
        gameSlug: identity.canonicalSlug,
        ...setRuntimeGameReaction(req.user.id, identity.canonicalSlug, req.validatedBody.reaction)
      })
    }

    res.json(await setGameReactionWithSql(identity.canonicalSlug, identity.aliases, req.user.id, req.validatedBody.reaction))
  })
)

router.post(
  '/:slug/compatibility',
  asyncHandler(async (req, res) => {
    const { game } = await resolveGameIdentity(req.params.slug)

    if (!game) {
      return res.status(404).json({ message: 'Game not found' })
    }

    const result = await estimatePerformance(game, req.body)
    res.json(result)
  })
)

module.exports = router
