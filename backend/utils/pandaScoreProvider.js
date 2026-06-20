const { env } = require('../lib/env')
const { logger } = require('../lib/logger')

const PANDASCORE_API_BASE = 'https://api.pandascore.co'

const GAME_SLUG_MAP = {
  'counter-strike-2': 'cs-2',
  csgo: 'cs-2',
  cs2: 'cs-2',
  valorant: 'valorant',
  'dota-2': 'dota-2',
  dota2: 'dota-2',
  'league-of-legends': 'league-of-legends',
  lol: 'league-of-legends',
  overwatch: 'ow',
  'rocket-league': 'rl',
  'rainbow-six-siege': 'r6siege',
  pubg: 'pubg',
  'apex-legends': 'apex-legends',
  fortnite: 'fortnite',
  'call-of-duty': 'cod-mw',
  'street-fighter': 'sf',
  tekken: 'tekken-8',
  'super-smash-bros': 'smash-bros-ultimate',
  'starcraft-2': 'starcraft-2',
  'king-of-glory': 'arena-of-valor',
  cod: 'cod-mw',
  sf6: 'sf',
  'street-fighter-6': 'sf',
  'tekken-8': 'tekken-8',
  sc2: 'starcraft-2',
  starcraft: 'starcraft-2',
  hearthstone: 'hs',
  halo: 'halo',
  'halo-infinite': 'halo',
  'ea-sports-fc': 'ea-sports-fc-online',
  'fc-25': 'ea-sports-fc-online',
  'fc-26': 'ea-sports-fc-online'
}

const PANDASCORE_TO_SLUG = {
  'cs-2': 'counter-strike-2',
  'cs-go': 'counter-strike-2',
  csgo: 'counter-strike-2',
  valorant: 'valorant',
  'dota-2': 'dota-2',
  'league-of-legends': 'league-of-legends',
  ow: 'overwatch',
  rl: 'rocket-league',
  r6siege: 'rainbow-six-siege',
  pubg: 'pubg',
  'apex-legends': 'apex-legends',
  fortnite: 'fortnite',
  'cod-mw': 'call-of-duty',
  sf: 'street-fighter',
  'tekken-8': 'tekken',
  'smash-bros-ultimate': 'super-smash-bros',
  'starcraft-2': 'starcraft-2',
  'arena-of-valor': 'king-of-glory',
  hs: 'hearthstone',
  halo: 'halo',
  'ea-sports-fc-online': 'ea-sports-fc'
}

function inferStatus(beginAt, endAt) {
  const now = Date.now()
  const start = beginAt ? new Date(beginAt).getTime() : NaN
  const end = endAt ? new Date(endAt).getTime() : NaN

  if (Number.isFinite(start) && start > now) return 'UPCOMING'
  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end > now)) return 'LIVE_NOW'
  if (Number.isFinite(end) && end <= now) return 'ENDED'
  return 'UPCOMING'
}

function mapPandaScoreTournament(item) {
  const videogameSlug = String(item?.videogame?.slug || '').toLowerCase()
  const gameSlug = PANDASCORE_TO_SLUG[videogameSlug] || videogameSlug || null

  const beginAt = item?.begin_at || null
  const endAt = item?.end_at || null
  const leagueName = item?.league?.name || ''
  const serieName = item?.serie?.full_name || item?.serie?.name || ''
  const title = item?.name
    ? `${leagueName ? leagueName + ': ' : ''}${item.name}`
    : serieName || leagueName || 'PandaScore Tournament'

  const registrationUrl = item?.league?.url || item?.live_url || null

  return {
    slug: `pandascore-${item?.id || ''}`,
    title: title.trim(),
    gameSlug,
    status: inferStatus(beginAt, endAt),
    startsAt: beginAt || new Date().toISOString(),
    endsAt: endAt,
    metadata: {
      provider: 'pandascore',
      providerId: item?.id || null,
      videogame: item?.videogame?.name || null,
      videogameSlug,
      league: leagueName || null,
      serie: serieName || null,
      tier: item?.tier || null,
      prizePool: item?.prizepool || null,
      region: item?.region || null,
      country: item?.country || null,
      liveSupported: item?.live_supported || false,
      url: registrationUrl,
      registrationUrl
    }
  }
}

async function pandaScoreFetch(endpoint) {
  const token = env.PANDASCORE_API_TOKEN
  if (!token) return null

  const separator = endpoint.includes('?') ? '&' : '?'
  const url = `${PANDASCORE_API_BASE}${endpoint}${separator}token=${token}`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'PlayWise/1.0'
    },
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    throw new Error(`PandaScore API ${endpoint} returned ${response.status}`)
  }

  return response.json()
}

async function loadPandaScoreTournaments(options = {}) {
  if (!env.PANDASCORE_API_TOKEN) return []

  const gameQuery = String(options.gameQuery || '').trim().toLowerCase()
  const limit = Math.min(options.limit || 50, 100)

  try {
    const results = []

    if (gameQuery && GAME_SLUG_MAP[gameQuery]) {
      const pandaSlug = GAME_SLUG_MAP[gameQuery]
      const [upcoming, running] = await Promise.allSettled([
        pandaScoreFetch(`/${pandaSlug}/tournaments/upcoming?per_page=${limit}&sort=begin_at`),
        pandaScoreFetch(`/${pandaSlug}/tournaments/running?per_page=${Math.min(limit, 20)}`)
      ])

      if (running.status === 'fulfilled' && Array.isArray(running.value)) {
        results.push(...running.value.map(mapPandaScoreTournament))
      }
      if (upcoming.status === 'fulfilled' && Array.isArray(upcoming.value)) {
        results.push(...upcoming.value.map(mapPandaScoreTournament))
      }
    } else {
      const [upcoming, running] = await Promise.allSettled([
        pandaScoreFetch(`/tournaments/upcoming?per_page=${limit}&sort=begin_at`),
        pandaScoreFetch(`/tournaments/running?per_page=${Math.min(limit, 20)}`)
      ])

      if (running.status === 'fulfilled' && Array.isArray(running.value)) {
        results.push(...running.value.map(mapPandaScoreTournament))
      }
      if (upcoming.status === 'fulfilled' && Array.isArray(upcoming.value)) {
        results.push(...upcoming.value.map(mapPandaScoreTournament))
      }
    }

    if (gameQuery && !GAME_SLUG_MAP[gameQuery]) {
      return results.filter((t) => {
        const slug = String(t.gameSlug || '').toLowerCase()
        const title = String(t.title || '').toLowerCase()
        const game = String(t.metadata?.videogame || '').toLowerCase()
        return slug.includes(gameQuery) || title.includes(gameQuery) || game.includes(gameQuery)
      })
    }

    const seen = new Set()
    return results.filter((t) => {
      if (!t.slug || seen.has(t.slug)) return false
      seen.add(t.slug)
      return true
    })
  } catch (error) {
    logger.warn({ error }, 'PandaScore tournaments could not be loaded')
    return []
  }
}

module.exports = {
  loadPandaScoreTournaments
}
