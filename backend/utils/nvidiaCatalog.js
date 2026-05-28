const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')

const NVIDIA_GFN_URL = 'https://static.nvidiagrid.net/supported-public-game-list/locales/gfnpc-en-US.json'
const UPSERT_BATCH_SIZE = 50

let gfnCache = { expiresAt: 0, games: [] }

function normalizeTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleToSlug(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function mapNvidiaStore(store) {
  const s = String(store || '').toLowerCase()
  if (s.includes('epic')) return 'Epic Games Store'
  if (s.includes('ubisoft') || s.includes('uplay')) return 'Ubisoft Store'
  if (s.includes('gog')) return 'GOG'
  if (s.includes('xbox') || s.includes('microsoft')) return 'Xbox'
  return 'Steam'
}

function transformNvidiaGame(entry) {
  const slug = titleToSlug(entry.title)
  if (!slug) return null

  const genres = Array.isArray(entry.genres) ? entry.genres.filter(Boolean) : []
  const nativeStore = mapNvidiaStore(entry.store)
  const stores = [nativeStore, 'GeForce NOW'].filter(Boolean)

  return {
    slug,
    title: String(entry.title || '').trim(),
    year: null,
    heroTag: entry.isFullyOptimized
      ? `${entry.title} is fully optimized for GeForce NOW cloud streaming.`
      : `${entry.title} is available on GeForce NOW cloud streaming.`,
    description: `Play ${entry.title} on GeForce NOW. Published by ${entry.publisher || 'Unknown'}.`,
    catalogSource: 'nvidia-gfn',
    catalogBuckets: entry.isFullyOptimized ? ['gfn-optimized'] : ['gfn-supported'],
    popularityScore: entry.isFullyOptimized ? 5 : 2,
    releaseTimestamp: null,
    externalRatingCount: null,
    genres,
    platforms: ['PC (Microsoft Windows)'],
    supportedPlatforms: ['PC (Microsoft Windows)'],
    stores,
    averageRating: null,
    image: null,
    banner: null,
    publisher: entry.publisher || null,
    steamUrl: entry.steamUrl || null,
    nvidiaId: entry.id,
    isFullyOptimized: entry.isFullyOptimized || false,
    storeLinks: entry.steamUrl
      ? [{ label: 'Steam', url: entry.steamUrl }]
      : []
  }
}

async function fetchNvidiaGfnGames() {
  if (gfnCache.expiresAt > Date.now() && gfnCache.games.length > 0) {
    return gfnCache.games
  }

  const response = await fetch(NVIDIA_GFN_URL)
  if (!response.ok) {
    throw new Error(`NVIDIA GFN fetch failed: ${response.status}`)
  }

  const rawGames = await response.json()
  if (!Array.isArray(rawGames)) {
    throw new Error('NVIDIA GFN response is not an array')
  }

  const games = rawGames
    .filter((g) => g?.title && g?.status === 'AVAILABLE')
    .map(transformNvidiaGame)
    .filter(Boolean)

  gfnCache = { expiresAt: Date.now() + env.IGDB_CACHE_MS, games }
  logger.info({ count: games.length }, 'Fetched NVIDIA GeForce NOW catalog')
  return games
}

function buildTitleIndex(games) {
  const index = new Map()
  for (const game of games) {
    const key = normalizeTitle(game.title)
    if (key) index.set(key, game)
  }
  return index
}

async function syncNvidiaToDatabase() {
  if (!isDatabaseReady()) return 0

  let nvidiaGames
  try {
    nvidiaGames = await fetchNvidiaGfnGames()
  } catch (error) {
    logger.warn({ error }, 'NVIDIA GFN sync failed — skipping')
    return 0
  }

  if (!nvidiaGames.length) return 0

  const prisma = getPrisma()

  const existingGames = await prisma.game.findMany({
    select: { slug: true, title: true, stores: true, catalogBuckets: true, payload: true }
  })

  const titleIndex = new Map()
  const slugIndex = new Map()
  for (const game of existingGames) {
    titleIndex.set(normalizeTitle(game.title), game)
    slugIndex.set(game.slug, game)
  }

  let matched = 0
  let created = 0
  const updates = []
  const inserts = []

  for (const nvGame of nvidiaGames) {
    const normalizedTitle = normalizeTitle(nvGame.title)
    const existing = titleIndex.get(normalizedTitle) || slugIndex.get(nvGame.slug)

    if (existing) {
      const currentStores = Array.isArray(existing.stores) ? existing.stores : []
      const currentBuckets = Array.isArray(existing.catalogBuckets) ? existing.catalogBuckets : []
      const newStores = Array.from(new Set([...currentStores, 'GeForce NOW']))
      const gfnBucket = nvGame.catalogBuckets[0]
      const newBuckets = currentBuckets.includes(gfnBucket)
        ? currentBuckets
        : [...currentBuckets, gfnBucket]

      if (newStores.length !== currentStores.length || newBuckets.length !== currentBuckets.length) {
        updates.push({
          slug: existing.slug,
          stores: newStores,
          catalogBuckets: newBuckets
        })
      }
      matched++
    } else {
      inserts.push({
        slug: nvGame.slug,
        title: nvGame.title,
        year: null,
        heroTag: nvGame.heroTag,
        description: nvGame.description,
        catalogSource: 'nvidia-gfn',
        catalogBuckets: nvGame.catalogBuckets,
        popularityScore: nvGame.popularityScore,
        releaseTimestamp: null,
        externalRatingCount: null,
        genres: nvGame.genres,
        platforms: nvGame.platforms,
        supportedPlatforms: nvGame.supportedPlatforms,
        stores: nvGame.stores,
        averageRating: null,
        image: null,
        banner: null,
        payload: {
          ...nvGame,
          catalogSource: 'nvidia-gfn'
        }
      })
      created++
    }
  }

  const updateChunks = chunkValues(updates, UPSERT_BATCH_SIZE)
  for (const chunk of updateChunks) {
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.game.update({
          where: { slug: u.slug },
          data: { stores: u.stores, catalogBuckets: u.catalogBuckets }
        })
      )
    )
  }

  const insertChunks = chunkValues(inserts, UPSERT_BATCH_SIZE)
  for (const chunk of insertChunks) {
    await prisma.game.createMany({ data: chunk, skipDuplicates: true })
  }

  logger.info({ matched, created, updated: updates.length }, 'NVIDIA GFN catalog synced to SQL')
  return matched + created
}

function chunkValues(values, size) {
  const chunks = []
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size))
  }
  return chunks
}

module.exports = {
  fetchNvidiaGfnGames,
  syncNvidiaToDatabase
}
