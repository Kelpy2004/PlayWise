const seedTournaments = require('../data/seedTournaments')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { loadProviderTournaments } = require('./tournamentProvider')

function inferTournamentStatus(tournament, now = new Date()) {
  const start = new Date(tournament.startsAt)
  const end = tournament.endsAt ? new Date(tournament.endsAt) : null

  if (!Number.isNaN(start.getTime()) && start <= now && (!end || end > now)) {
    return 'LIVE_NOW'
  }

  if (end && !Number.isNaN(end.getTime()) && end <= now) {
    return 'ENDED'
  }

  return 'UPCOMING'
}

function normalizeQuery(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatTournamentRow(row, inferredStatus) {
  return {
    ...row,
    status: inferredStatus,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

async function syncProviderTournaments(prisma, providerTournaments) {
  if (!providerTournaments.length) return
  await Promise.all(
    providerTournaments.map((entry) =>
      prisma.tournament.upsert({
        where: { slug: entry.slug },
        update: {
          title: entry.title,
          gameSlug: entry.gameSlug || null,
          status: entry.status,
          startsAt: new Date(entry.startsAt),
          endsAt: entry.endsAt ? new Date(entry.endsAt) : null,
          metadata: entry.metadata || null
        },
        create: {
          slug: entry.slug,
          title: entry.title,
          gameSlug: entry.gameSlug || null,
          status: entry.status,
          startsAt: new Date(entry.startsAt),
          endsAt: entry.endsAt ? new Date(entry.endsAt) : null,
          metadata: entry.metadata || null
        }
      })
    )
  )
}

async function loadTournaments(options = {}) {
  const queryText = String(options.gameQuery || '').trim()
  const normalizedQuery = normalizeQuery(queryText)
  const providerTournaments = await loadProviderTournaments({
    gameQuery: queryText || null,
    limit: options.limit
  })

  if (!isDatabaseReady()) {
    const localTournaments = seedTournaments
      .map((entry) => ({
        ...entry,
        status: inferTournamentStatus(entry)
      }))
      .filter((entry) => {
        if (!normalizedQuery) return true
        const title = normalizeQuery(entry.title)
        const gameSlug = normalizeQuery(entry.gameSlug)
        return title.includes(normalizedQuery) || gameSlug.includes(normalizedQuery)
      })
    return mergeTournaments(providerTournaments, localTournaments)
  }

  const prisma = getPrisma()
  await syncProviderTournaments(prisma, providerTournaments)
  const providerSlugs = providerTournaments.map((entry) => entry.slug).filter(Boolean)

  const rows = await prisma.tournament.findMany({
    where: normalizedQuery
      ? {
          OR: [
            { title: { contains: queryText, mode: 'insensitive' } },
            { gameSlug: { contains: normalizedQuery, mode: 'insensitive' } },
            { gameSlug: { contains: queryText, mode: 'insensitive' } },
            ...(providerSlugs.length ? [{ slug: { in: providerSlugs } }] : [])
          ]
        }
      : undefined,
    orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    take: Math.max(10, Math.min(150, Number(options.limit) || 80))
  })

  const now = new Date()
  const updates = []
  const tournaments = rows.map((row) => {
    const inferred = inferTournamentStatus(row, now)
    if (row.status !== inferred) {
      updates.push(
        prisma.tournament.update({
          where: { id: row.id },
          data: { status: inferred }
        })
      )
    }
    return formatTournamentRow(row, inferred)
  })

  if (updates.length) {
    await prisma.$transaction(updates)
  }

  return tournaments
}

function mergeTournaments(primary, fallback) {
  const merged = [...primary, ...fallback]
  const seen = new Set()
  return merged.filter((entry) => {
    const key = String(entry.slug || entry.id || '').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function ensureTournamentsSeeded() {
  if (!isDatabaseReady()) return

  const prisma = getPrisma()
  const count = await prisma.tournament.count()
  if (count > 0) return

  await prisma.tournament.createMany({
    data: seedTournaments.map((entry) => ({
      slug: entry.slug,
      title: entry.title,
      gameSlug: entry.gameSlug || null,
      status: inferTournamentStatus(entry),
      startsAt: new Date(entry.startsAt),
      endsAt: entry.endsAt ? new Date(entry.endsAt) : null,
      metadata: entry.metadata || null
    })),
    skipDuplicates: true
  })
}

module.exports = {
  ensureTournamentsSeeded,
  inferTournamentStatus,
  loadTournaments
}
