import type { GameRecord } from '../types/catalog'

const STRING_FIXES: Array<[string, string]> = [
  ['ÃƒÂ¯', 'Ã¯'],
  ['ÃƒÂ©', 'Ã©'],
  ['ÃƒÂ¨', 'Ã¨'],
  ['ÃƒÂ¼', 'Ã¼'],
  ['ÃƒÂ¡', 'Ã¡'],
  ['Ã‚Â©', 'Â©'],
  ['Ã¢â‚¬â€', 'â€”'],
  ['Ã¢â‚¬â€œ', 'â€“'],
  ['Ã¢â‚¬Â¢', 'â€¢'],
  ['Ã¢â‚¬â„¢', 'â€™'],
  ['Ã¢â‚¬Å“', 'â€œ'],
  ['Ã¢â‚¬ï¿½', 'â€'],
  ['Ã¢ËœÂ°', 'â˜°']
]

let featuredCache: GameRecord[] | null = null
let openSourceCache: GameRecord[] | null = null

function repairString(value: string): string {
  return STRING_FIXES.reduce((current, [broken, fixed]) => current.replaceAll(broken, fixed), value)
}

function repairValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => repairValue(entry)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, repairValue(entry)])
    ) as T
  }

  if (typeof value === 'string') {
    return repairString(value) as T
  }

  return value
}

function ensureGenres(game: Partial<GameRecord>): string[] {
  if (Array.isArray(game.genre)) return game.genre
  if (Array.isArray(game.genres)) return game.genres
  if (typeof game.genre === 'string' && game.genre) return [game.genre]
  return []
}

function normalizeGame(game: Partial<GameRecord>): GameRecord {
  const genres = ensureGenres(game)
  const ratings = game.structuredRatings
  const averageRating = ratings
    ? Object.values(ratings).reduce((total, value) => total + Number(value || 0), 0) / Object.keys(ratings).length
    : null

  return {
    ...game,
    slug: game.slug || '',
    title: game.title || 'Unknown title',
    genre: genres,
    genres,
    averageRating,
    openSource: Boolean(game.downloadUrl || game.licenseTag)
  } as GameRecord
}

function readWindowCatalog(key: 'GAME_LIBRARY' | 'OPEN_SOURCE_GAMES'): GameRecord[] {
  if (typeof window === 'undefined') return []
  const raw = Array.isArray(window[key]) ? window[key] : []
  return repairValue(raw).map((entry) => normalizeGame(entry))
}

export function getFeaturedGames(): GameRecord[] {
  if (!featuredCache) {
    featuredCache = readWindowCatalog('GAME_LIBRARY')
  }

  return featuredCache
}

export function getOpenSourceGames(): GameRecord[] {
  if (!openSourceCache) {
    openSourceCache = readWindowCatalog('OPEN_SOURCE_GAMES')
  }

  return openSourceCache
}

export function getAllGames(): GameRecord[] {
  return [...getFeaturedGames(), ...getOpenSourceGames()]
}

export function getGameBySlug(slug?: string): GameRecord | null {
  if (!slug) return null
  return getAllGames().find((game) => game.slug === slug) || null
}

export function getRelatedGames(game: GameRecord): GameRecord[] {
  const bySlug = (game.similarGames || [])
    .map((slug) => getGameBySlug(slug))
    .filter((entry): entry is GameRecord => Boolean(entry))

  if (bySlug.length) {
    return bySlug
  }

  return getAllGames()
    .filter((entry) => entry.slug !== game.slug)
    .filter((entry) => entry.genre.some((genre) => game.genre.includes(genre)))
    .slice(0, 3)
}
