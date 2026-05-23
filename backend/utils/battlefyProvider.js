const { logger } = require('../lib/logger')

const BATTLEFY_API_BASE = 'https://search.battlefy.com/tournament/organization'
const BATTLEFY_SEARCH_URL = 'https://search.battlefy.com/tournament'

// Map PlayWise slugs to Battlefy game names for search
const GAME_NAME_MAP = {
  valorant: 'VALORANT',
  'counter-strike-2': 'Counter-Strike 2',
  csgo: 'Counter-Strike 2',
  cs2: 'Counter-Strike 2',
  'league-of-legends': 'League of Legends',
  lol: 'League of Legends',
  'dota-2': 'Dota 2',
  dota2: 'Dota 2',
  overwatch: 'Overwatch 2',
  'apex-legends': 'Apex Legends',
  fortnite: 'Fortnite',
  'rocket-league': 'Rocket League',
  'rainbow-six-siege': 'Rainbow Six Siege',
  pubg: 'PUBG: BATTLEGROUNDS'
}

function normalizeSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferStatus(startsAt, endsAt) {
  const now = Date.now()
  const start = startsAt ? new Date(startsAt).getTime() : NaN
  const end = endsAt ? new Date(endsAt).getTime() : NaN

  if (Number.isFinite(start) && start > now) return 'UPCOMING'
  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end > now)) return 'LIVE_NOW'
  if (Number.isFinite(end) && end <= now) return 'ENDED'
  return 'UPCOMING'
}

function mapBattlefyTournament(item) {
  const gameName = item?.game?.name || item?.gameName || ''
  const gameSlug = normalizeSlug(gameName)
  const startsAt = item?.startTime || item?.start_time || new Date().toISOString()
  const endsAt = item?.endTime || item?.end_time || null

  return {
    slug: `battlefy-${item?._id || item?.id || ''}`,
    title: String(item?.name || 'Battlefy Tournament').trim(),
    gameSlug: gameSlug || null,
    status: inferStatus(startsAt, endsAt),
    startsAt,
    endsAt,
    metadata: {
      provider: 'battlefy',
      providerId: item?._id || item?.id || null,
      gameName,
      region: item?.region || null,
      teamCount: item?.playersPerTeam || null,
      currentTeams: item?.teamCount || 0,
      maxTeams: item?.maxTeams || null,
      isFeatured: item?.isFeatured || false,
      prizePool: item?.prizes?.length ? item.prizes.map((p) => p.title || p).join(', ') : null,
      url: `https://battlefy.com/${item?.organization?.slug || 'tournament'}/${item?.slug || item?._id || ''}/${item?._id || ''}`,
      registrationUrl: `https://battlefy.com/${item?.organization?.slug || 'tournament'}/${item?.slug || item?._id || ''}/${item?._id || ''}/register`,
      isRegistrationOpen: item?.isRegistrationEnabled !== false
    }
  }
}

async function battlefyFetch(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PlayWise/1.0'
    }
  })

  if (!response.ok) {
    throw new Error(`Battlefy API returned ${response.status} for ${url}`)
  }

  return response.json()
}

async function loadBattlefyTournaments(options = {}) {
  const gameQuery = String(options.gameQuery || '').trim().toLowerCase()
  const limit = Math.min(options.limit || 30, 50)

  try {
    const results = []

    // Search upcoming tournaments
    const searchParams = new URLSearchParams({
      page: '1',
      size: String(limit),
      sort: 'start-time-asc',
      status: 'registration-open'
    })

    // Add game filter if we have a matching game name
    if (gameQuery && GAME_NAME_MAP[gameQuery]) {
      searchParams.set('game', GAME_NAME_MAP[gameQuery])
    }

    try {
      const data = await battlefyFetch(`${BATTLEFY_SEARCH_URL}?${searchParams}`)
      const tournaments = Array.isArray(data) ? data : Array.isArray(data?.tournaments) ? data.tournaments : []
      results.push(...tournaments.map(mapBattlefyTournament))
    } catch (error) {
      logger.debug({ error }, 'Battlefy search endpoint failed, trying featured')
    }

    // Also fetch featured/upcoming as backup
    if (results.length < 5) {
      try {
        const featured = await battlefyFetch(
          `${BATTLEFY_SEARCH_URL}?page=1&size=${limit}&sort=start-time-asc&status=upcoming`
        )
        const items = Array.isArray(featured) ? featured : Array.isArray(featured?.tournaments) ? featured.tournaments : []
        const mapped = items.map(mapBattlefyTournament)
        // Merge without duplicates
        const existingSlugs = new Set(results.map((r) => r.slug))
        for (const t of mapped) {
          if (!existingSlugs.has(t.slug)) {
            results.push(t)
            existingSlugs.add(t.slug)
          }
        }
      } catch (error) {
        logger.debug({ error }, 'Battlefy upcoming fetch also failed')
      }
    }

    // Filter by game query if provided and no direct game filter was used
    if (gameQuery && !GAME_NAME_MAP[gameQuery]) {
      return results.filter((t) => {
        const slug = String(t.gameSlug || '').toLowerCase()
        const title = String(t.title || '').toLowerCase()
        const gameName = String(t.metadata?.gameName || '').toLowerCase()
        return (
          slug.includes(gameQuery) ||
          title.includes(gameQuery) ||
          gameName.includes(gameQuery) ||
          gameQuery.includes(slug)
        )
      })
    }

    return results
  } catch (error) {
    logger.warn({ error }, 'Battlefy tournaments could not be loaded')
    return []
  }
}

module.exports = {
  loadBattlefyTournaments
}
