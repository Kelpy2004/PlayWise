const fs = require('fs')
const path = require('path')
const vm = require('vm')

const seedGames = require('../data/seedGames')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getTopRatedGames } = require('./igdbCatalog')

const DATA_FILE = path.resolve(__dirname, '../../public/data.js')

let sharedCatalogCache = null
let sharedCatalogMtime = null

function ensureGenres(game) {
  if (Array.isArray(game.genres)) return game.genres
  if (Array.isArray(game.genre)) return game.genre
  if (typeof game.genre === 'string' && game.genre.trim()) return [game.genre.trim()]
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
  return {
    ...game,
    slug: String(game.slug || '').trim(),
    title: String(game.title || 'Unknown title').trim(),
    genres: ensureGenres(game),
    genre: ensureGenres(game),
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

function mergeDatabaseGames(sharedGames, dbGames) {
  if (!dbGames.length) return sharedGames

  const dbMap = new Map(dbGames.map((game) => [game.slug, game]))

  const merged = sharedGames.map((game) => {
    const dbGame = dbMap.get(game.slug)
    return dbGame ? { ...game, ...dbGame, genres: game.genres, genre: game.genre } : game
  })

  for (const dbGame of dbGames) {
    if (!merged.some((game) => game.slug === dbGame.slug)) {
      merged.push(normalizeGame(dbGame))
    }
  }

  return merged
}

function mergeCatalogLists(primaryGames, secondaryGames) {
  if (!secondaryGames.length) return primaryGames

  const merged = [...primaryGames]
  const knownSlugs = new Set(primaryGames.map((game) => game.slug))

  for (const game of secondaryGames) {
    if (!game?.slug || knownSlugs.has(game.slug)) continue
    knownSlugs.add(game.slug)
    merged.push(normalizeGame(game))
  }

  return merged
}

async function loadGames() {
  const sharedGames = readSharedCatalog()
  const externalGames = await getTopRatedGames().catch(() => [])
  const catalogBase = mergeCatalogLists(sharedGames, externalGames)

  if (!isDatabaseReady()) {
    return catalogBase
  }

  const prisma = getPrisma()
  const games = await prisma.game.findMany({ orderBy: { title: 'asc' } })
  return mergeDatabaseGames(catalogBase, games)
}

async function ensureGamesSeeded() {
  if (!isDatabaseReady()) return

  const prisma = getPrisma()
  const totalGames = await prisma.game.count()
  if (!totalGames) {
    const sharedGames = readSharedCatalog()
    await prisma.game.createMany({
      data: sharedGames.map((game) => ({
        slug: game.slug,
        title: game.title,
        year: game.year || null,
        heroTag: game.heroTag || null,
        description: game.description || null
      })),
      skipDuplicates: true
    })
  }
}

module.exports = {
  ensureGamesSeeded,
  loadGames
}
