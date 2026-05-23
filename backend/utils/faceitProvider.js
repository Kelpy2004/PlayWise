const { env } = require('../lib/env')
const { logger } = require('../lib/logger')

const FACEIT_API_BASE = 'https://open.faceit.com/data/v4'

// Maps PlayWise game slugs to FACEIT game IDs
const GAME_ID_MAP = {
  'counter-strike-2': 'cs2',
  csgo: 'cs2',
  cs2: 'cs2',
  valorant: 'valorant',
  dota2: 'dota2',
  'dota-2': 'dota2',
  'league-of-legends': 'lol',
  overwatch: 'overwatch',
  'rocket-league': 'rocket_league',
  'rainbow-six-siege': 'r6siege',
  pubg: 'pubg',
  'apex-legends': 'apex_legends'
}

// Reverse map for normalizing game slugs from FACEIT names
const FACEIT_TO_SLUG = {
  cs2: 'counter-strike-2',
  csgo: 'counter-strike-2',
  valorant: 'valorant',
  dota2: 'dota-2',
  lol: 'league-of-legends',
  overwatch: 'overwatch',
  rocket_league: 'rocket-league',
  r6siege: 'rainbow-six-siege',
  pubg: 'pubg',
  apex_legends: 'apex-legends'
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

function mapFaceitChampionship(item) {
  const gameId = String(item?.game_id || '').toLowerCase()
  const gameSlug = FACEIT_TO_SLUG[gameId] || gameId || null

  const startsAt = item?.championship_start
    ? new Date(item.championship_start * 1000).toISOString()
    : new Date().toISOString()
  const endsAt = item?.championship_end
    ? new Date(item.championship_end * 1000).toISOString()
    : null

  return {
    slug: `faceit-${item?.championship_id || item?.id || ''}`,
    title: String(item?.name || 'FACEIT Championship').trim(),
    gameSlug,
    status: inferStatus(startsAt, endsAt),
    startsAt,
    endsAt,
    metadata: {
      provider: 'faceit',
      providerId: item?.championship_id || item?.id || null,
      gameId,
      region: item?.region || null,
      prizePool: item?.prize_type || null,
      currentSubscriptions: item?.current_subscriptions || 0,
      slots: item?.slots || null,
      url: item?.faceit_url
        ? String(item.faceit_url).replace('{lang}', 'en')
        : `https://www.faceit.com/en/championship/${item?.championship_id || ''}`,
      registrationUrl: item?.faceit_url
        ? String(item.faceit_url).replace('{lang}', 'en')
        : null,
      organizer: item?.organizer_name || item?.organizer_id || null,
      anticheat: item?.anticheat_required || false
    }
  }
}

async function faceitFetch(endpoint) {
  const apiKey = env.FACEIT_API_KEY
  if (!apiKey) return null

  const response = await fetch(`${FACEIT_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`FACEIT API ${endpoint} returned ${response.status}`)
  }

  return response.json()
}

async function loadFaceitTournaments(options = {}) {
  if (!env.FACEIT_API_KEY) return []

  const gameQuery = String(options.gameQuery || '').trim().toLowerCase()
  const limit = Math.min(options.limit || 40, 100)

  try {
    const results = []

    // Determine which games to fetch
    let targetGames = Object.values(GAME_ID_MAP)
    if (gameQuery && GAME_ID_MAP[gameQuery]) {
      targetGames = [GAME_ID_MAP[gameQuery]]
    }

    // Deduplicate game IDs
    targetGames = [...new Set(targetGames)]

    // Fetch championships for each game (limit to top 4 games to avoid rate limits)
    const fetchPromises = targetGames.slice(0, 4).map(async (faceitGameId) => {
      try {
        const data = await faceitFetch(
          `/championships?game=${faceitGameId}&type=upcoming&offset=0&limit=${Math.min(limit, 20)}`
        )
        const items = Array.isArray(data?.items) ? data.items : []
        return items.map(mapFaceitChampionship)
      } catch (error) {
        logger.debug({ error, faceitGameId }, 'FACEIT championship fetch failed for game')
        return []
      }
    })

    const batches = await Promise.allSettled(fetchPromises)
    for (const batch of batches) {
      if (batch.status === 'fulfilled') {
        results.push(...batch.value)
      }
    }

    // Filter by game query if provided
    if (gameQuery) {
      return results.filter((t) => {
        const slug = String(t.gameSlug || '').toLowerCase()
        const title = String(t.title || '').toLowerCase()
        return slug.includes(gameQuery) || title.includes(gameQuery) || gameQuery.includes(slug)
      })
    }

    return results
  } catch (error) {
    logger.warn({ error }, 'FACEIT tournaments could not be loaded')
    return []
  }
}

module.exports = {
  loadFaceitTournaments
}
