const { logger } = require('../lib/logger')
const { env } = require('../lib/env')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { sendTypedNotification } = require('./notificationService')
const { inferTournamentStatus, loadTournaments } = require('./tournamentCatalog')
const {
  getAllRuntimeTournamentSubscriptions,
  getRuntimeNotificationDeliveries,
  setRuntimeTournaments,
  upsertRuntimeTournamentSubscription
} = require('./runtimeStore')

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tokenSet(value) {
  const normalized = normalizeToken(value)
  if (!normalized) return new Set()
  return new Set(normalized.split('-').filter((token) => token.length > 2))
}

function hasTokenOverlap(left, right) {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) return false
  for (const token of leftTokens) {
    if (rightTokens.has(token)) return true
  }
  return false
}

function subscriptionMatchesTournament(subscription, tournament) {
  if (!subscription.isActive) return false
  if (subscription.scope === 'ALL') return true
  if (!subscription.gameSlug) return false

  const expected = normalizeToken(subscription.gameSlug)
  const fromTournament = normalizeToken(tournament.gameSlug)
  if (expected && fromTournament && expected === fromTournament) return true

  const metadataGame = tournament?.metadata?.videogame
  return hasTokenOverlap(subscription.gameSlug, tournament.gameSlug) || hasTokenOverlap(subscription.gameSlug, metadataGame)
}

function getTournamentKey(tournament) {
  return tournament?.id || tournament?.slug || ''
}

function isWithinSoonWindow(startsAt, now, windowMinutes) {
  const start = new Date(startsAt)
  if (Number.isNaN(start.getTime())) return false
  const diffMs = start.getTime() - now.getTime()
  return diffMs >= 0 && diffMs <= windowMinutes * 60 * 1000
}

async function runTournamentNotificationCycle() {
  try {
    const tournaments = await loadTournaments()
    const now = new Date()
    const soonWindowMinutes = Math.max(5, Number(env.TOURNAMENT_SOON_WINDOW_MINUTES) || 30)

    if (isDatabaseReady()) {
      const prisma = getPrisma()
      const subscriptions = await prisma.tournamentSubscription.findMany({
        where: { isActive: true },
        take: 500
      })

      for (const subscription of subscriptions) {
        for (const tournament of tournaments) {
          if (!subscriptionMatchesTournament(subscription, tournament)) continue

          const status = inferTournamentStatus(tournament, now)
          const isSoon = status === 'UPCOMING' && isWithinSoonWindow(tournament.startsAt, now, soonWindowMinutes)
          const alreadySentNew = await prisma.notificationDelivery.findFirst({
            where: {
              type: 'TOURNAMENT_SOON',
              recipientEmail: subscription.email,
              tournamentId: tournament.id,
              status: 'SENT'
            },
            select: { id: true }
          })

          const alreadySentLive = await prisma.notificationDelivery.findFirst({
            where: {
              type: 'TOURNAMENT_LIVE',
              recipientEmail: subscription.email,
              tournamentId: tournament.id,
              status: 'SENT'
            },
            select: { id: true }
          })

          const shouldSendNewListing = isSoon && !alreadySentNew
          const shouldSendLive = status === 'LIVE_NOW' && !alreadySentLive

          if (!shouldSendNewListing && !shouldSendLive) continue

          if (shouldSendNewListing) {
            await sendTypedNotification({
              type: 'TOURNAMENT_SOON',
              email: subscription.email,
              userId: subscription.userId || null,
              gameSlug: tournament.gameSlug || null,
              tournamentId: tournament.id,
              payload: {
                tournamentTitle: tournament.title,
                startsAt: tournament.startsAt,
                gameSlug: tournament.gameSlug || null,
                tournamentSlug: tournament.slug || null,
                registrationUrl: tournament?.metadata?.registrationUrl || null,
                reason: 'NEW_LISTING'
              }
            })
          }

          if (shouldSendLive) {
            await sendTypedNotification({
              type: 'TOURNAMENT_LIVE',
              email: subscription.email,
              userId: subscription.userId || null,
              gameSlug: tournament.gameSlug || null,
              tournamentId: tournament.id,
              payload: {
                tournamentTitle: tournament.title,
                gameSlug: tournament.gameSlug || null,
                tournamentSlug: tournament.slug || null,
                registrationUrl: tournament?.metadata?.registrationUrl || null
              }
            })
          }

          await prisma.tournamentSubscription.update({
            where: { id: subscription.id },
            data: {
              ...(shouldSendNewListing ? { lastSoonNotifiedAt: new Date() } : {}),
              ...(shouldSendLive ? { lastLiveNotifiedAt: new Date() } : {})
            }
          })
        }
      }

      return
    }

    setRuntimeTournaments(tournaments)
    const runtimeDeliveries = getRuntimeNotificationDeliveries()

    const subscriptions = getAllRuntimeTournamentSubscriptions()
      .filter((entry) => entry.isActive)
      .slice(0, 500)

    for (const subscription of subscriptions) {
      for (const tournament of tournaments) {
        if (!subscriptionMatchesTournament(subscription, tournament)) continue

        const status = inferTournamentStatus(tournament, now)
        const isSoon = status === 'UPCOMING' && isWithinSoonWindow(tournament.startsAt, now, soonWindowMinutes)
        const tournamentKey = getTournamentKey(tournament)
        const alreadySentNew = runtimeDeliveries.some(
          (entry) =>
            entry.type === 'TOURNAMENT_SOON' &&
            entry.status === 'SENT' &&
            entry.recipientEmail === subscription.email &&
            (entry.tournamentId === tournament.id || (tournamentKey && entry.payload?.tournamentSlug === tournamentKey))
        )
        const alreadySentLive = runtimeDeliveries.some(
          (entry) =>
            entry.type === 'TOURNAMENT_LIVE' &&
            entry.status === 'SENT' &&
            entry.recipientEmail === subscription.email &&
            (entry.tournamentId === tournament.id || (tournamentKey && entry.payload?.tournamentSlug === tournamentKey))
        )
        const shouldSendNewListing = isSoon && !alreadySentNew
        const shouldSendLive = status === 'LIVE_NOW' && !alreadySentLive

        if (!shouldSendNewListing && !shouldSendLive) continue

        if (shouldSendNewListing) {
          await sendTypedNotification({
            type: 'TOURNAMENT_SOON',
            email: subscription.email,
            userId: subscription.userId || null,
            gameSlug: tournament.gameSlug || null,
            tournamentId: tournament.id,
            payload: {
              tournamentTitle: tournament.title,
              startsAt: tournament.startsAt,
              gameSlug: tournament.gameSlug || null,
              tournamentSlug: tournament.slug || null,
              registrationUrl: tournament?.metadata?.registrationUrl || null,
              reason: 'NEW_LISTING'
            }
          })
        }

        if (shouldSendLive) {
          await sendTypedNotification({
            type: 'TOURNAMENT_LIVE',
            email: subscription.email,
            userId: subscription.userId || null,
            gameSlug: tournament.gameSlug || null,
            tournamentId: tournament.id,
            payload: {
              tournamentTitle: tournament.title,
              gameSlug: tournament.gameSlug || null,
              tournamentSlug: tournament.slug || null,
              registrationUrl: tournament?.metadata?.registrationUrl || null
            }
          })
        }

        if (subscription.userId) {
          upsertRuntimeTournamentSubscription(subscription.userId, {
            ...subscription,
            ...(shouldSendNewListing ? { lastSoonNotifiedAt: new Date().toISOString() } : {}),
            ...(shouldSendLive ? { lastLiveNotifiedAt: new Date().toISOString() } : {}),
            updatedAt: new Date().toISOString()
          })
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Tournament notification cycle failed')
  }
}

module.exports = {
  runTournamentNotificationCycle
}
