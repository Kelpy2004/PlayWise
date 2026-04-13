const fs = require('fs')
const path = require('path')
const vm = require('vm')

const seedGames = require('../data/seedGames')
const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getTopRatedGames } = require('./igdbCatalog')

const DATA_FILE = path.resolve(__dirname, '../../public/data.js')
const UPSERT_BATCH_SIZE = 40
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000

let sharedCatalogCache = null
let sharedCatalogMtime = null
let mergedCatalogCache = null
let mergedCatalogCachedAt = 0
let mergedCatalogInFlight = null

function ensureGenres(game) {
  if (Array.isArray(game.genres)) return game.genres
  if (Array.isArray(game.genre)) return game.genre
  if (typeof game.genre === 'string' && game.genre.trim()) return [game.genre.trim()]
  return []
}

function ensurePlatforms(game) {
  if (Array.isArray(game.supportedPlatforms)) return game.supportedPlatforms
  if (Array.isArray(game.platform)) return game.platform
  return []
}

function computeAverageRating(game) {
  if (typeof game.averageRating === 'number') return game.averageRating
  if (typeof game.valueRating?.score === 'number') return game.valueRating.score

  const structuredRatings = game.structuredRatings && typeof game.structuredRatings === 'object'
    ? Object.values(game.structuredRatings).filter((value) => typeof value === 'number')
    : []

  if (!structuredRatings.length) return null

  const total = structuredRatings.reduce((sum, value) => sum + value, 0)
  return Number((total / structuredRatings.length).toFixed(1))
}

function normalizeGame(game) {
  const genres = ensureGenres(game)
  const platforms = ensurePlatforms(game)
  const catalogBuckets = Array.isArray(game.catalogBuckets) ? game.catalogBuckets.filter(Boolean) : []

  return {
    ...game,
    slug: String(game.slug || '').trim(),
    title: String(game.title || 'Unknown title').trim(),
    genres,
    genre: genres,
    platform: Array.isArray(game.platform) ? game.platform : platforms,
    supportedPlatforms: platforms,
    catalogBuckets,
    averageRating: computeAverageRating(game),
    heroTag: game.heroTag || null,
    description: game.description || null
  }
}

function readSharedCatalog() {
  try {
    const stat = fs.statSync(DATA_FILE)
    if (sharedCatalogCache && sharedCatalogMtime === stat.mtimeMs) {
      return sharedCatalogCache
    }

    const source = fs.readFileSync(DATA_FILE, 'utf8')
    const sandbox = { window: {} }
    vm.createContext(sandbox)
    vm.runInContext(source, sandbox, { filename: DATA_FILE })

    const featured = Array.isArray(sandbox.window.GAME_LIBRARY) ? sandbox.window.GAME_LIBRARY : []
    const openSource = Array.isArray(sandbox.window.OPEN_SOURCE_GAMES) ? sandbox.window.OPEN_SOURCE_GAMES : []
    const catalog = [...featured, ...openSource]
      .map(normalizeGame)
      .filter((game) => game.slug)

    if (!catalog.length) {
      return seedGames
    }

    sharedCatalogCache = catalog
    sharedCatalogMtime = stat.mtimeMs
    return catalog
  } catch (_) {
    return seedGames
  }
}

function mergeCatalogEntries(primary, secondary) {
  if (!primary) return secondary
  if (!secondary) return primary

  return {
    ...secondary,
    ...primary,
    genre: primary.genre?.length ? primary.genre : secondary.genre,
    genres: primary.genres?.length ? primary.genres : secondary.genres,
    platform: primary.platform?.length ? primary.platform : secondary.platform,
    supportedPlatforms: primary.supportedPlatforms?.length ? primary.supportedPlatforms : secondary.supportedPlatforms,
    storeLinks: primary.storeLinks?.length ? primary.storeLinks : secondary.storeLinks,
    similarGames: primary.similarGames?.length ? primary.similarGames : secondary.similarGames,
    catalogBuckets: Array.from(new Set([...(primary.catalogBuckets || []), ...(secondary.catalogBuckets || [])])),
    popularityScore: Math.max(primary.popularityScore || 0, secondary.popularityScore || 0) || null,
    averageRating: primary.averageRating ?? secondary.averageRating
  }
}

function mergeCatalogLists(primaryGames, secondaryGames) {
  if (!secondaryGames.length) return primaryGames

  const bySlug = new Map()
  for (const game of [...primaryGames, ...secondaryGames]) {
    if (!game?.slug) continue
    bySlug.set(game.slug, mergeCatalogEntries(bySlug.get(game.slug), game))
  }

  return Array.from(bySlug.values())
}

function toDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function mapDbGameToCatalog(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const merged = {
    ...payload,
    slug: row.slug,
    title: row.title,
    year: row.year,
    heroTag: row.heroTag,
    description: row.description,
    catalogSource: row.catalogSource || payload.catalogSource || 'database',
    catalogBuckets: row.catalogBuckets?.length ? row.catalogBuckets : payload.catalogBuckets || [],
    popularityScore: row.popularityScore ?? payload.popularityScore ?? null,
    releaseTimestamp: row.releaseTimestamp ? row.releaseTimestamp.toISOString() : payload.releaseTimestamp || null,
    externalRatingCount: row.externalRatingCount ?? payload.externalRatingCount ?? 0,
    genre: row.genres?.length ? row.genres : payload.genre || payload.genres || [],
    genres: row.genres?.length ? row.genres : payload.genres || payload.genre || [],
    platform: row.platforms?.length ? row.platforms : payload.platform || payload.supportedPlatforms || [],
    supportedPlatforms: row.supportedPlatforms?.length ? row.supportedPlatforms : payload.supportedPlatforms || payload.platform || [],
    averageRating: row.averageRating ?? payload.averageRating ?? null,
    image: row.image || payload.image || null,
    banner: row.banner || payload.banner || null
  }

  return normalizeGame(merged)
}

function mapCatalogGameToDb(game) {
  const normalized = normalizeGame(game)
  return {
    slug: normalized.slug,
    title: normalized.title,
    year: normalized.year || null,
    heroTag: normalized.heroTag || null,
    description: normalized.description || null,
    catalogSource: normalized.catalogSource || null,
    catalogBuckets: normalized.catalogBuckets || [],
    popularityScore: typeof normalized.popularityScore === 'number' ? normalized.popularityScore : null,
    releaseTimestamp: toDate(normalized.releaseTimestamp),
    externalRatingCount: typeof normalized.externalRatingCount === 'number' ? normalized.externalRatingCount : null,
    genres: normalized.genres || [],
    platforms: normalized.platform || [],
    supportedPlatforms: normalized.supportedPlatforms || [],
    averageRating: typeof normalized.averageRating === 'number' ? normalized.averageRating : null,
    image: normalized.image || null,
    banner: normalized.banner || null,
    payload: normalized
  }
}

function chunkValues(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function invalidateMergedCatalogCache() {
  mergedCatalogCache = null
  mergedCatalogCachedAt = 0
}

async function syncExpandedCatalogToDatabase(limit = env.IGDB_TOP_GAMES_LIMIT) {
  if (!isDatabaseReady()) return 0

  const externalGames = await getTopRatedGames(limit).catch((error) => {
    logger.warn({ error }, 'IGDB catalog sync failed. Keeping existing DB catalog as-is.')
    return []
  })

  if (!externalGames.length) return 0

  const prisma = getPrisma()
  const rows = externalGames.map(mapCatalogGameToDb)
  const chunks = chunkValues(rows, UPSERT_BATCH_SIZE)

  for (const chunk of chunks) {
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.game.upsert({
          where: { slug: row.slug },
          update: row,
          create: row
        })
      )
    )
  }

  logger.info({ synced: rows.length }, 'Expanded game catalog synced to SQL.')
  invalidateMergedCatalogCache()
  return rows.length
}

async function loadGames() {
  const isCacheFresh =
    Array.isArray(mergedCatalogCache) &&
    mergedCatalogCache.length > 0 &&
    Date.now() - mergedCatalogCachedAt < CATALOG_CACHE_TTL_MS

  if (isCacheFresh) {
    return mergedCatalogCache
  }

  if (mergedCatalogInFlight) {
    return mergedCatalogInFlight
  }

  mergedCatalogInFlight = (async () => {
  const sharedGames = readSharedCatalog()

  if (!isDatabaseReady()) {
    const externalGames = await getTopRatedGames().catch(() => [])
    const merged = mergeCatalogLists(sharedGames, externalGames)
    mergedCatalogCache = merged
    mergedCatalogCachedAt = Date.now()
    return merged
  }

  const prisma = getPrisma()
  const dbGames = await prisma.game.findMany({
    orderBy: [{ popularityScore: 'desc' }, { averageRating: 'desc' }, { title: 'asc' }],
    take: Math.max(600, Number(env.IGDB_TOP_GAMES_LIMIT) || 500)
  })

  const parsedDbGames = dbGames.map(mapDbGameToCatalog)
  const merged = mergeCatalogLists(sharedGames, parsedDbGames)
  mergedCatalogCache = merged
  mergedCatalogCachedAt = Date.now()
  return merged
  })()

  try {
    return await mergedCatalogInFlight
  } finally {
    mergedCatalogInFlight = null
  }
}

async function ensureGamesSeeded() {
  if (!isDatabaseReady()) return

  const prisma = getPrisma()
  const totalGames = await prisma.game.count()
  if (!totalGames) {
    const sharedGames = readSharedCatalog().map(mapCatalogGameToDb)
    await prisma.game.createMany({
      data: sharedGames,
      skipDuplicates: true
    })
    invalidateMergedCatalogCache()
  }
}

module.exports = {
  ensureGamesSeeded,
  loadGames,
  syncExpandedCatalogToDatabase
}
