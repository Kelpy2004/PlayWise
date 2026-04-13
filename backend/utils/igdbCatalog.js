const { env } = require('../lib/env')

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const IGDB_BASE_URL = 'https://api.igdb.com/v4'
const IMAGE_CDN = 'https://images.igdb.com/igdb/image/upload'
const MIN_EXPANDED_CATALOG_SIZE = 500
const IGDB_BATCH_SIZE = 50

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
  return `${text.slice(0, maxLength - 3).trim()}...`
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

function sanitizeSlug(slug) {
  return String(slug || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim()
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

function ensureArray(values) {
  return Array.isArray(values) ? values : []
}

function mergeCatalogBuckets(...bucketLists) {
  return Array.from(new Set(bucketLists.flat().filter(Boolean)))
}

function formatReleaseTimestamp(unixSeconds) {
  if (!unixSeconds) return null
  const releaseDate = new Date(unixSeconds * 1000)
  if (Number.isNaN(releaseDate.getTime())) return null
  return releaseDate.toISOString()
}

function getBucketLabel(catalogBuckets = []) {
  if (catalogBuckets.includes('popular')) return 'Popular now'
  if (catalogBuckets.includes('top-rated')) return 'Top rated'
  if (catalogBuckets.includes('mid-popular')) return 'Mid-popular'
  if (catalogBuckets.includes('new-release')) return 'New release'
  return 'IGDB profile'
}

function transformIgdbGame(game, options = {}) {
  const normalizedSlug = normalizeSlug(game.slug)
  const genres = ensureArray(game.genres)
    .map((genre) => trimText(genre?.name))
    .filter(Boolean)
  const platforms = ensureArray(game.platforms)
    .map((platform) => trimText(platform?.name))
    .filter(Boolean)
  const screenshots = ensureArray(game.screenshots)
  const averageRating = toAverageRating(game)
  const summary = trimText(game.summary)
  const storyline = trimText(game.storyline)
  const storeLinks = buildStoreLinks(game.websites)
  const hasEpicLink = storeLinks.some((entry) => entry.label === 'Epic Games')
  const catalogBuckets = mergeCatalogBuckets(options.catalogBuckets, hasEpicLink ? ['epic-store'] : [])
  const popularityScore = typeof options.popularityScore === 'number' ? options.popularityScore : null

  return {
    slug: normalizedSlug,
    originalSlug: sanitizeSlug(game.slug),
    title: trimText(game.name) || 'Unknown title',
    year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : undefined,
    releaseTimestamp: formatReleaseTimestamp(game.first_release_date),
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
      label: getBucketLabel(catalogBuckets),
      note: 'This expanded catalog card is powered by live IGDB metadata.',
      tone: catalogBuckets.includes('top-rated') ? 'good' : catalogBuckets.includes('mid-popular') ? 'info' : 'blue'
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
    storeLinks,
    officialSite: pickOfficialSite(game.websites),
    trailer: buildTrailer(game.videos),
    similarGames: ensureArray(game.similar_games).map((entry) => trimText(entry?.slug)).filter(Boolean),
    demandLevel: getBucketLabel(catalogBuckets),
    demandTone: catalogBuckets.includes('top-rated') ? 'good' : catalogBuckets.includes('mid-popular') ? 'info' : 'blue',
    averageRating,
    catalogSource: 'igdb',
    catalogBuckets,
    popularityScore,
    externalRatingCount: typeof game.total_rating_count === 'number' ? game.total_rating_count : game.rating_count || 0
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
    catalogBuckets: mergeCatalogBuckets(primary.catalogBuckets, secondary.catalogBuckets),
    popularityScore: Math.max(primary.popularityScore || 0, secondary.popularityScore || 0) || null,
    averageRating: primary.averageRating ?? secondary.averageRating
  }
}

function normalizeCatalogList(games = []) {
  const mergedBySlug = new Map()

  for (const game of games) {
    if (!game?.slug) continue
    mergedBySlug.set(game.slug, mergeCatalogEntries(mergedBySlug.get(game.slug), game))
  }

  return Array.from(mergedBySlug.values())
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

function buildGameFields() {
  return [
    'id',
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

function buildBaseGameWhereClause() {
  return `
    first_release_date != null
      & first_release_date < ${Math.floor(Date.now() / 1000)}
      & version_parent = null
      & cover != null
      & platforms.name = "PC (Microsoft Windows)"
  `
}

function chunkValues(values, size) {
  const chunks = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

function buildRecentQuery(limit, offset = 0) {
  return `
    fields ${buildGameFields()};
    where ${buildBaseGameWhereClause()}
      & total_rating != null
      & total_rating_count > 10;
    sort first_release_date desc;
    limit ${limit};
    offset ${offset};
  `
}

function buildTopRatedQuery(limit, offset = 0) {
  return `
    fields ${buildGameFields()};
    where ${buildBaseGameWhereClause()}
      & total_rating != null
      & total_rating_count > 50;
    sort total_rating desc;
    limit ${limit};
    offset ${offset};
  `
}

function buildPopularityPrimitiveQuery(limit, offset = 0) {
  return `
    fields game_id,popularity_type,value,external_popularity_source;
    where game_id != null;
    sort value desc;
    limit ${limit};
    offset ${offset};
  `
}

function buildGamesByIdsQuery(ids) {
  return `
    fields ${buildGameFields()};
    where id = (${ids.join(',')})
      & ${buildBaseGameWhereClause()};
    limit ${ids.length};
  `
}

function scorePopularityEntry(entry) {
  const baseValue = Number(entry?.value) || 0
  const sourceWeight = entry?.external_popularity_source === 1 ? 2 : 1
  const typeWeight = entry?.popularity_type >= 30 ? 1.15 : 1
  return baseValue * sourceWeight * typeWeight
}

function aggregatePopularityEntries(entries = []) {
  const gameMap = new Map()

  for (const entry of entries) {
    const gameId = Number(entry?.game_id)
    if (!gameId) continue

    const current = gameMap.get(gameId) || { gameId, score: 0, hits: 0 }
    current.score += scorePopularityEntry(entry)
    current.hits += 1
    gameMap.set(gameId, current)
  }

  return Array.from(gameMap.values()).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return right.hits - left.hits
  })
}

async function fetchGamesFromQuery(query, catalogBuckets) {
  const response = await queryIgdb('games', query)
  return Array.isArray(response)
    ? response
        .map((game) => transformIgdbGame(game, { catalogBuckets }))
        .filter((game) => game.slug && game.title)
    : []
}

async function fetchGamesByIds(ids, catalogBuckets, popularityScores) {
  if (!ids.length) return []

  const chunks = chunkValues(ids, IGDB_BATCH_SIZE)
  const byId = new Map()

  for (const chunk of chunks) {
    const response = await queryIgdb('games', buildGamesByIdsQuery(chunk))
    for (const game of Array.isArray(response) ? response : []) {
      byId.set(game.id, game)
    }
  }

  return ids
    .map((id) => {
      const game = byId.get(id)
      if (!game) return null
      return transformIgdbGame(game, {
        catalogBuckets,
        popularityScore: popularityScores.get(id) || null
      })
    })
    .filter(Boolean)
}

async function getPopularGamesByTier(targetCount) {
  const primitivePages = []

  for (const offset of [0, 250, 500, 750, 1000, 1250]) {
    primitivePages.push(await queryIgdb('popularity_primitives', buildPopularityPrimitiveQuery(250, offset)))
  }

  const popularityRankings = aggregatePopularityEntries(primitivePages.flat())
  const popularityScores = new Map(popularityRankings.map((entry) => [entry.gameId, entry.score]))

  const popularIds = popularityRankings.slice(0, Math.max(targetCount, 100)).map((entry) => entry.gameId)
  const midPopularIds = popularityRankings
    .slice(Math.max(targetCount, 100), Math.max(targetCount, 100) + Math.max(targetCount, 100))
    .map((entry) => entry.gameId)

  const popularGames = await fetchGamesByIds(popularIds, ['popular'], popularityScores)
  const midPopularGames = await fetchGamesByIds(midPopularIds, ['mid-popular'], popularityScores)

  return { popularGames, midPopularGames }
}

async function getExpandedCatalog(limit = env.IGDB_TOP_GAMES_LIMIT) {
  if (!isIgdbEnabled()) return []

  const targetCount = Math.max(Number(limit) || 0, MIN_EXPANDED_CATALOG_SIZE)

  if (topGamesCache.expiresAt > Date.now() && topGamesCache.games.length >= targetCount) {
    return topGamesCache.games.slice(0, targetCount)
  }

  const recentGames = []
  const topRatedGames = []
  const recentBatchSize = 100
  const topRatedBatchSize = 100
  const pages = Math.max(2, Math.ceil(targetCount / 100))

  for (let page = 0; page < pages; page += 1) {
    const recentChunk = await fetchGamesFromQuery(buildRecentQuery(recentBatchSize, page * recentBatchSize), ['new-release'])
    const topRatedChunk = await fetchGamesFromQuery(buildTopRatedQuery(topRatedBatchSize, page * topRatedBatchSize), ['top-rated'])
    recentGames.push(...recentChunk)
    topRatedGames.push(...topRatedChunk)
  }
  const { popularGames, midPopularGames } = await getPopularGamesByTier(
    Math.min(Math.max(Math.floor(targetCount / 2), 80), 120)
  )

  const games = normalizeCatalogList([...topRatedGames, ...popularGames, ...midPopularGames, ...recentGames]).slice(0, targetCount)

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

async function getTopRatedGames(limit = env.IGDB_TOP_GAMES_LIMIT) {
  return getExpandedCatalog(limit)
}

async function getTopRatedGameBySlug(slug) {
  const requestedSlug = sanitizeSlug(slug)
  const normalizedSlug = normalizeSlug(slug)
  if (!normalizedSlug || !isIgdbEnabled()) return null

  const cached = slugCache.get(requestedSlug) || slugCache.get(normalizedSlug)
  if (cached) return cached

  const topGames = await getExpandedCatalog()
  const fromTopList = topGames.find((game) => game.slug === normalizedSlug)
  if (fromTopList) return fromTopList

  const body = `
    fields ${buildGameFields()};
    where slug = "${requestedSlug}" | slug = "${normalizedSlug}";
    limit 1;
  `

  const response = await queryIgdb('games', body)
  const game = Array.isArray(response) && response[0]
    ? transformIgdbGame(response[0], { catalogBuckets: ['igdb-search-result'] })
    : null

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
