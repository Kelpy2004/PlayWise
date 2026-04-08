const { env } = require('../lib/env')

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const IGDB_BASE_URL = 'https://api.igdb.com/v4'
const IMAGE_CDN = 'https://images.igdb.com/igdb/image/upload'

let accessTokenCache = null
let topGamesCache = { expiresAt: 0, games: [] }
const slugCache = new Map()

function isIgdbEnabled() {
  return Boolean(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET)
}

function trimText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value, maxLength) {
  const text = trimText(value)
  if (!text || text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trim()}…`
}

function firstSentence(value, fallbackLength = 150) {
  const text = trimText(value)
  if (!text) return ''
  const sentence = text.match(/.+?[.!?](\s|$)/)?.[0]
  return truncate(sentence || text, fallbackLength)
}

function buildImageUrl(imageId, size = 'cover_big') {
  if (!imageId) return null
  return `${IMAGE_CDN}/t_${size}/${imageId}.jpg`
}

function normalizeSlug(slug) {
  return sanitizeSlug(slug).replace(/--\d+$/, '')
}

function normalizeWebsiteLabel(category) {
  switch (Number(category)) {
    case 1:
      return 'Official site'
    case 13:
      return 'Steam'
    case 15:
      return 'itch.io'
    case 16:
      return 'Epic Games'
    case 17:
      return 'GOG'
    default:
      return null
  }
}

function buildStoreLinks(websites = []) {
  const links = []
  const seen = new Set()

  for (const website of websites) {
    const label = normalizeWebsiteLabel(website?.category)
    const url = trimText(website?.url)

    if (!label || !url || seen.has(label)) continue
    seen.add(label)
    links.push({ label, url })
  }

  return links
}

function pickOfficialSite(websites = []) {
  const preferred = websites.find((website) => Number(website?.category) === 1 && website?.url)
  return trimText(preferred?.url || websites.find((website) => website?.url)?.url) || null
}

function buildTrailer(videos = []) {
  const videoId = trimText(videos[0]?.video_id)
  if (!videoId) return null

  return {
    title: 'Official trailer',
    youtubeId: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`
  }
}

function toAverageRating(game) {
  const raw = typeof game.total_rating === 'number' ? game.total_rating : game.rating
  if (typeof raw !== 'number') return null
  return Number((raw / 10).toFixed(1))
}

function transformIgdbGame(game) {
  const normalizedSlug = normalizeSlug(game.slug)
  const genres = Array.isArray(game.genres)
    ? game.genres.map((genre) => trimText(genre?.name)).filter(Boolean)
    : []
  const platforms = Array.isArray(game.platforms)
    ? game.platforms.map((platform) => trimText(platform?.name)).filter(Boolean)
    : []
  const screenshots = Array.isArray(game.screenshots) ? game.screenshots : []
  const averageRating = toAverageRating(game)
  const summary = trimText(game.summary)
  const storyline = trimText(game.storyline)

  return {
    slug: normalizedSlug,
    originalSlug: sanitizeSlug(game.slug),
    title: trimText(game.name) || 'Unknown title',
    year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : undefined,
    genre: genres.length ? genres : ['Action'],
    genres: genres.length ? genres : ['Action'],
    platform: platforms,
    supportedPlatforms: platforms,
    heroTag: firstSentence(summary || storyline || `${game.name} is now available inside the PlayWise expanded catalog.`),
    image: buildImageUrl(game.cover?.image_id, 'cover_big'),
    banner: buildImageUrl(screenshots[0]?.image_id, 'screenshot_big') || buildImageUrl(game.cover?.image_id, 'screenshot_big'),
    description: summary || storyline || 'Live game profile powered by IGDB.',
    story: storyline || summary || 'PlayWise is showing the richer catalog summary available from IGDB for this title.',
    bugStatus: {
      label: 'IGDB profile',
      note: 'This expanded catalog card is powered by live IGDB metadata.',
      tone: 'info'
    },
    valueRating: averageRating
      ? {
          score: averageRating,
          advice:
            typeof game.total_rating_count === 'number' && game.total_rating_count > 0
              ? `Strong critical momentum on IGDB across ${game.total_rating_count} rating signals.`
              : 'Solid critical reception in the live catalog feed.'
        }
      : undefined,
    storeLinks: buildStoreLinks(game.websites),
    officialSite: pickOfficialSite(game.websites),
    trailer: buildTrailer(game.videos),
    similarGames: Array.isArray(game.similar_games)
      ? game.similar_games.map((entry) => trimText(entry?.slug)).filter(Boolean)
      : [],
    demandLevel: 'IGDB top rated',
    demandTone: 'blue',
    averageRating,
    catalogSource: 'igdb',
    externalRatingCount: typeof game.total_rating_count === 'number' ? game.total_rating_count : game.rating_count || 0
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return response.json()
}

async function getAccessToken() {
  if (!isIgdbEnabled()) {
    return null
  }

  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token
  }

  const params = new URLSearchParams({
    client_id: env.IGDB_CLIENT_ID,
    client_secret: env.IGDB_CLIENT_SECRET,
    grant_type: 'client_credentials'
  })

  const payload = await fetchJson(`${TWITCH_TOKEN_URL}?${params.toString()}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json'
    }
  })

  accessTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + ((Number(payload.expires_in) || 0) * 1000)
  }

  return accessTokenCache.token
}

async function queryIgdb(endpoint, body) {
  const token = await getAccessToken()
  if (!token) return []

  return fetchJson(`${IGDB_BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Client-ID': env.IGDB_CLIENT_ID,
      Authorization: `Bearer ${token}`
    },
    body
  })
}

function sanitizeSlug(slug) {
  return String(slug || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim()
}

function buildGameFields() {
  return [
    'name',
    'slug',
    'summary',
    'storyline',
    'first_release_date',
    'total_rating',
    'total_rating_count',
    'rating',
    'rating_count',
    'cover.image_id',
    'screenshots.image_id',
    'genres.name',
    'platforms.name',
    'websites.url',
    'websites.category',
    'videos.video_id',
    'similar_games.slug'
  ].join(',')
}

function buildTopRatedQuery(limit) {
  return `
    fields ${buildGameFields()};
    where total_rating != null
      & total_rating_count > 80
      & first_release_date != null
      & first_release_date < ${Math.floor(Date.now() / 1000)}
      & version_parent = null
      & platforms = (6);
    sort total_rating desc;
    limit ${Math.min(Math.max(limit, 1), 50)};
  `
}

async function getTopRatedGames(limit = env.IGDB_TOP_GAMES_LIMIT) {
  if (!isIgdbEnabled()) return []

  if (topGamesCache.expiresAt > Date.now() && topGamesCache.games.length) {
    return topGamesCache.games.slice(0, limit)
  }

  const response = await queryIgdb('games', buildTopRatedQuery(limit))
  const games = Array.isArray(response)
    ? response.map(transformIgdbGame).filter((game) => game.slug && game.title)
    : []

  topGamesCache = {
    expiresAt: Date.now() + env.IGDB_CACHE_MS,
    games
  }

  games.forEach((game) => {
    slugCache.set(game.slug, game)
    if (game.originalSlug && game.originalSlug !== game.slug) {
      slugCache.set(game.originalSlug, game)
    }
  })

  return games
}

async function getTopRatedGameBySlug(slug) {
  const requestedSlug = sanitizeSlug(slug)
  const normalizedSlug = normalizeSlug(slug)
  if (!normalizedSlug || !isIgdbEnabled()) return null

  const cached = slugCache.get(requestedSlug) || slugCache.get(normalizedSlug)
  if (cached) return cached

  const topGames = await getTopRatedGames()
  const fromTopList = topGames.find((game) => game.slug === normalizedSlug)
  if (fromTopList) return fromTopList

  const body = `
    fields ${buildGameFields()};
    where slug = "${requestedSlug}" | slug = "${normalizedSlug}";
    limit 1;
  `

  const response = await queryIgdb('games', body)
  const game = Array.isArray(response) && response[0] ? transformIgdbGame(response[0]) : null

  if (game?.slug) {
    slugCache.set(game.slug, game)
    if (game.originalSlug && game.originalSlug !== game.slug) {
      slugCache.set(game.originalSlug, game)
    }
  }

  return game
}

module.exports = {
  getTopRatedGameBySlug,
  getTopRatedGames,
  isIgdbEnabled
}
