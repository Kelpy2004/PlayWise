const STRING_FIXES = [
  ['Ã¯', 'ï'],
  ['Ã©', 'é'],
  ['Ã¨', 'è'],
  ['Ã¼', 'ü'],
  ['Ã¡', 'á'],
  ['Â©', '©'],
  ['â€”', '—'],
  ['â€“', '–'],
  ['â€¢', '•'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€�', '”'],
  ['â˜°', '☰']
]

let featuredCache = null
let openSourceCache = null

function repairString(value) {
  return STRING_FIXES.reduce(
    (current, [broken, fixed]) => current.replaceAll(broken, fixed),
    value
  )
}

function repairValue(value) {
  if (Array.isArray(value)) {
    return value.map(repairValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, repairValue(entry)])
    )
  }

  if (typeof value === 'string') {
    return repairString(value)
  }

  return value
}

function ensureGenres(game) {
  if (Array.isArray(game.genre)) return game.genre
  if (Array.isArray(game.genres)) return game.genres
  if (typeof game.genre === 'string' && game.genre) return [game.genre]
  return []
}

function normalizeGame(game) {
  const genres = ensureGenres(game)
  const averageRating = game.structuredRatings
    ? Object.values(game.structuredRatings).reduce((total, value) => total + Number(value || 0), 0) /
      Object.keys(game.structuredRatings).length
    : null

  return {
    ...game,
    genre: genres,
    genres,
    averageRating,
    openSource: Boolean(game.downloadUrl || game.licenseTag)
  }
}

function readWindowCatalog(key) {
  if (typeof window === 'undefined') return []
  const raw = Array.isArray(window[key]) ? window[key] : []
  return repairValue(raw).map(normalizeGame)
}

export function getFeaturedGames() {
  if (!featuredCache) {
    featuredCache = readWindowCatalog('GAME_LIBRARY')
  }

  return featuredCache
}

export function getOpenSourceGames() {
  if (!openSourceCache) {
    openSourceCache = readWindowCatalog('OPEN_SOURCE_GAMES')
  }

  return openSourceCache
}

export function getAllGames() {
  return [...getFeaturedGames(), ...getOpenSourceGames()]
}

export function getGameBySlug(slug) {
  return getAllGames().find((game) => game.slug === slug) || null
}

export function getRelatedGames(game) {
  const bySlug = (game.similarGames || [])
    .map((slug) => getGameBySlug(slug))
    .filter(Boolean)

  if (bySlug.length) {
    return bySlug
  }

  return getAllGames()
    .filter((entry) => entry.slug !== game.slug)
    .filter((entry) => entry.genre.some((genre) => game.genre.includes(genre)))
    .slice(0, 3)
}
