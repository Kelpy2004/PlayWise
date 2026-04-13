const { env } = require('../lib/env')
const { logger } = require('../lib/logger')

const STARTGG_GRAPHQL_URL = 'https://api.start.gg/gql/alpha'

const GAME_SLUG_ALIASES = {
  valorant: 'valorant',
  dota2: 'dota-2',
  dota: 'dota-2',
  'league-of-legends': 'league-of-legends',
  lol: 'league-of-legends',
  'counter-strike': 'counter-strike-2',
  csgo: 'counter-strike-2',
  cs2: 'counter-strike-2',
  'counter-strike-2': 'counter-strike-2',
  cod: 'call-of-duty-modern-warfare',
  'call-of-duty': 'call-of-duty-modern-warfare',
  warzone: 'call-of-duty-modern-warfare',
  'rainbow-six-siege': 'rainbow-six-siege',
  'rainbow-6-siege': 'rainbow-six-siege',
  overwatch: 'overwatch'
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeGameSlugFromName(value) {
  const normalized = normalizeText(value)
  if (!normalized) return null
  return GAME_SLUG_ALIASES[normalized] || normalized
}

function inferStatus(startsAt, endsAt) {
  const now = Date.now()
  const start = startsAt ? new Date(startsAt).getTime() : Number.NaN
  const end = endsAt ? new Date(endsAt).getTime() : Number.NaN

  if (Number.isFinite(start) && start > now) return 'UPCOMING'
  if (Number.isFinite(start) && start <= now && (!Number.isFinite(end) || end > now)) return 'LIVE_NOW'
  if (Number.isFinite(end) && end <= now) return 'ENDED'
  return 'UPCOMING'
}

function buildStartGgUrl(slug) {
  const clean = String(slug || '').trim().replace(/^\/+|\/+$/g, '')
  if (!clean) return null
  if (clean.startsWith('tournament/')) {
    return `https://www.start.gg/${clean}`
  }
  return `https://www.start.gg/tournament/${clean}`
}

function extractGameSlug(node) {
  const events = Array.isArray(node?.events) ? node.events : []
  for (const event of events) {
    const videogameName = event?.videogame?.name || event?.videogame?.slug || event?.name
    const normalized = normalizeGameSlugFromName(videogameName)
    if (normalized) return normalized
  }
  return null
}

function extractVideogameNames(node) {
  const events = Array.isArray(node?.events) ? node.events : []
  const names = []
  const seen = new Set()

  for (const event of events) {
    const name = String(event?.videogame?.name || event?.videogame?.slug || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }

  return names
}

function mapTournamentNode(node) {
  const startAt = node?.startAt ? new Date(Number(node.startAt) * 1000).toISOString() : new Date().toISOString()
  const endAt = node?.endAt ? new Date(Number(node.endAt) * 1000).toISOString() : null
  const slug = String(node?.slug || '').trim()
  const siteUrl = buildStartGgUrl(slug)
  const registrationUrl = siteUrl ? `${siteUrl}/register` : null
  const videogameNames = extractVideogameNames(node)
  const primaryVideogameName = videogameNames[0] || ''

  return {
    slug: `startgg-${String(node?.id || '').trim()}`,
    title: String(node?.name || 'Tournament').trim(),
    gameSlug: extractGameSlug(node),
    status: inferStatus(startAt, endAt),
    startsAt: startAt,
    endsAt: endAt,
    metadata: {
      provider: 'startgg',
      providerTournamentId: node?.id || null,
      providerSlug: slug || null,
      videogame: primaryVideogameName || null,
      videogames: videogameNames,
      city: node?.city || null,
      countryCode: node?.countryCode || null,
      registrationClosesAt: node?.registrationClosesAt
        ? new Date(Number(node.registrationClosesAt) * 1000).toISOString()
        : null,
      url: siteUrl,
      registrationUrl
    }
  }
}

function buildGameSearchTerms(gameQuery) {
  const base = String(gameQuery || '').trim()
  if (!base) return []

  const normalized = normalizeText(base).replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  const compact = normalized.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
  const sansEdition = compact.replace(/\b(remastered|remake|edition|ultimate|definitive|game-of-the-year|goty)\b/g, '').replace(/\s+/g, ' ').trim()

  const terms = new Set([base, normalized, compact, sansEdition])

  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    terms.add(parts.slice(0, 2).join(' '))
    terms.add(parts.slice(0, 3).join(' '))
    terms.add(parts.slice(0, Math.min(parts.length, 4)).join(' '))
  }

  if (parts.length >= 3) {
    terms.add(parts.slice(-2).join(' '))
    terms.add(parts.slice(-3).join(' '))
  }

  return Array.from(terms).filter(Boolean)
}

function tokenSet(value) {
  const normalized = normalizeText(value)
  return new Set(normalized.split('-').filter((token) => token.length > 2))
}

function countTokenOverlap(left, right) {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) return 0
  let overlap = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1
  })
  return overlap
}

function hasTokenOverlap(left, right, minimumMatches = 1) {
  return countTokenOverlap(left, right) >= minimumMatches
}

async function resolveVideogameIdsForQuery(gameQuery) {
  const videogameQuery = `
    query PlayWiseVideogameSearch($name: String!) {
      videogames(query: { filter: { name: $name }, perPage: 10 }) {
        nodes {
          id
          name
          slug
        }
      }
    }
  `

  const ids = new Set()
  for (const term of buildGameSearchTerms(gameQuery)) {
    try {
      const payload = await startGgGraphql(videogameQuery, { name: term })
      const nodes = Array.isArray(payload?.data?.videogames?.nodes) ? payload.data.videogames.nodes : []
      for (const node of nodes) {
        const name = String(node?.name || '')
        const slug = String(node?.slug || '')
        if (hasTokenOverlap(gameQuery, name) || hasTokenOverlap(gameQuery, slug)) {
          if (node?.id != null) ids.add(node.id)
        }
      }
    } catch (error) {
      logger.debug({ error, term }, 'start.gg videogame search failed for one term')
    }
  }

  return Array.from(ids)
}

function dedupeBySlug(items) {
  const deduped = []
  const seen = new Set()
  for (const entry of items) {
    const key = String(entry?.slug || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(entry)
  }
  return deduped
}

function tournamentMatchesGameQuery(entry, gameQuery) {
  if (!gameQuery) return true
  const queryTokenCount = tokenSet(gameQuery).size
  const minMatches = queryTokenCount >= 2 ? 2 : 1
  const candidates = [
    entry?.gameSlug,
    entry?.title,
    entry?.metadata?.videogame,
    ...(Array.isArray(entry?.metadata?.videogames) ? entry.metadata.videogames : [])
  ]
  return candidates.some((candidate) => hasTokenOverlap(gameQuery, candidate, minMatches))
}

async function loadProviderTournaments(options = {}) {
  if (!env.STARTGG_API_TOKEN) return []

  const limit = Math.max(5, Math.min(100, options.limit || env.STARTGG_TOURNAMENT_LIMIT))
  const gameQuery = String(options.gameQuery || '').trim()

  const tournamentsQuery = `
    query PlayWiseTournaments($perPage: Int!, $videogameIds: [ID]) {
      tournaments(query: { perPage: $perPage, page: 1, sortBy: "startAt asc", filter: { upcoming: true, videogameIds: $videogameIds } }) {
        nodes {
          id
          slug
          name
          city
          countryCode
          startAt
          endAt
          registrationClosesAt
          events(limit: 6) {
            id
            name
            videogame {
              id
              name
              slug
            }
          }
        }
      }
    }
  `

  try {
    let videogameIds = null
    if (gameQuery) {
      const ids = await resolveVideogameIdsForQuery(gameQuery)
      videogameIds = ids.length ? ids : null
    }

    const fetchNodes = async (ids) => {
      const payload = await startGgGraphql(tournamentsQuery, {
        perPage: limit,
        videogameIds: ids
      })
      return Array.isArray(payload?.data?.tournaments?.nodes) ? payload.data.tournaments.nodes : []
    }

    let nodes = await fetchNodes(videogameIds)
    let mapped = nodes
      .map(mapTournamentNode)
      .filter((entry) => entry.slug && entry.title)
      .filter((entry) => tournamentMatchesGameQuery(entry, gameQuery))

    if (gameQuery && mapped.length === 0 && Array.isArray(videogameIds) && videogameIds.length) {
      nodes = await fetchNodes(null)
      mapped = nodes
        .map(mapTournamentNode)
        .filter((entry) => entry.slug && entry.title)
        .filter((entry) => tournamentMatchesGameQuery(entry, gameQuery))
    }

    return dedupeBySlug(mapped)
  } catch (error) {
    logger.warn({ error }, 'start.gg tournaments could not be loaded; using local tournaments only')
    return []
  }
}

async function startGgGraphql(query, variables) {
  const response = await fetch(STARTGG_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STARTGG_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`start.gg request failed (${response.status})`)
  }

  const payload = await response.json()
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(`start.gg graphql error: ${payload.errors[0]?.message || 'unknown error'}`)
  }
  return payload
}

module.exports = {
  loadProviderTournaments
}
