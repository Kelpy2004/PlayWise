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

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function matchesSection(game, section) {
  const normalizedSection = normalizeText(section)
  if (!normalizedSection) return true
  const buckets = Array.isArray(game.catalogBuckets) ? game.catalogBuckets : []

  if (normalizedSection === 'new' || normalizedSection.includes('new')) return buckets.includes('new-release')
  if (normalizedSection === 'top' || normalizedSection.includes('top')) return buckets.includes('top-rated')
  if (normalizedSection === 'popular') return buckets.includes('popular') || buckets.includes('mid-popular')
  if (normalizedSection.includes('epic')) return buckets.includes('epic-store')

  return true
}

function matchesPlatform(game, platform) {
  const normalizedPlatform = normalizeText(platform)
  if (!normalizedPlatform) return true
  const platforms = [...(game.platform || []), ...(game.supportedPlatforms || [])].map(normalizeText)
  return platforms.some((entry) => entry.includes(normalizedPlatform))
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
    const section = String(req.query.section || '').trim()
    const platform = String(req.query.platform || '').trim()
    const games = await loadGames()
    const filtered = games.filter((game) => {
      if (query && !buildSearchText(game).includes(query)) return false
      if (!matchesSection(game, section)) return false
      if (!matchesPlatform(game, platform)) return false
      return true
    })
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
    res.json(filtered)
  })
)

/* ── Paginated library endpoint (server-side filtering) ── */
router.get(
  '/library',
  asyncHandler(async (req, res) => {
    if (!isDatabaseReady()) {
      return res.status(503).json({ message: 'Database not available' })
    }

    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit) || 36))
    const skip = (page - 1) * limit
    const q = String(req.query.q || '').trim()
    const store = String(req.query.store || '').trim()
    const genre = String(req.query.genre || '').trim()
    const sort = String(req.query.sort || 'title').trim()

    const prisma = getPrisma()

    const filterParams = []
    const conditions = ['TRUE']

    if (q) {
      filterParams.push(`%${q}%`)
      conditions.push(`title ILIKE $${filterParams.length}`)
    }
    if (store) {
      filterParams.push(store)
      conditions.push(`$${filterParams.length} = ANY(stores)`)
    }
    if (genre) {
      filterParams.push(genre)
      conditions.push(`$${filterParams.length} = ANY(genres)`)
    }

    const where = conditions.join(' AND ')

    let orderClause
    switch (sort) {
      case 'rating':
        orderClause = '"averageRating" DESC NULLS LAST, title ASC'
        break
      case 'newest':
        orderClause = '"releaseTimestamp" DESC NULLS LAST, title ASC'
        break
      case 'popular':
        orderClause = '"popularityScore" DESC NULLS LAST, "averageRating" DESC NULLS LAST, title ASC'
        break
      case 'title':
      default:
        orderClause = `CASE WHEN title ~* '^[a-z]' THEN 0 ELSE 1 END, title ASC`
        break
    }

    const limitIdx = filterParams.length + 1
    const offsetIdx = filterParams.length + 2

    const dataQuery = `
      SELECT slug, title, year, "heroTag", genres, stores, platforms,
             "averageRating", "popularityScore", image, banner,
             "catalogBuckets", "releaseTimestamp",
             payload->>'publisher' AS publisher
      FROM "Game"
      WHERE ${where}
      ORDER BY ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `

    const countQuery = `SELECT COUNT(*)::int AS total FROM "Game" WHERE ${where}`

    const [games, countResult, allGenres, storeCounts] = await Promise.all([
      prisma.$queryRawUnsafe(dataQuery, ...filterParams, limit, skip),
      prisma.$queryRawUnsafe(countQuery, ...filterParams),
      prisma.$queryRaw`
        SELECT DISTINCT unnest(genres) AS genre FROM "Game" ORDER BY genre
      `.catch(() => []),
      prisma.$queryRaw`
        SELECT unnest(stores) AS store, COUNT(*)::int AS count
        FROM "Game"
        GROUP BY store
        ORDER BY count DESC
      `.catch(() => [])
    ])

    const total = countResult[0]?.total || 0

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120')
    res.json({
      games,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        genres: allGenres.map((r) => r.genre).filter(Boolean),
        stores: storeCounts.map((r) => ({ name: r.store, count: r.count }))
      }
    })
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
