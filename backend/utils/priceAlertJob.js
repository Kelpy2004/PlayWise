const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { loadGames } = require('./gameCatalog')
const { getPriceSnapshot } = require('./priceTracker')
const { sendTypedNotification } = require('./notificationService')
const { getAllRuntimePriceAlerts, upsertRuntimePriceAlert } = require('./runtimeStore')

function resolveCurrentAmount(snapshot) {
  if (typeof snapshot?.bestDeal?.amount === 'number') {
    return snapshot.bestDeal.amount
  }

  const pricedStores = (snapshot?.stores || [])
    .map((store) => store?.amount)
    .filter((amount) => typeof amount === 'number')

  if (!pricedStores.length) return null
  return Math.min(...pricedStores)
}

function shouldNotify(alert, currentAmount) {
  const hasTarget = typeof alert.targetPrice === 'number'
  const targetReached = hasTarget && currentAmount <= alert.targetPrice
  const droppedSinceLastSeen = typeof alert.lastSeenPrice === 'number' && currentAmount < alert.lastSeenPrice
  const changedSinceNotify = alert.lastNotifiedPrice == null || currentAmount !== alert.lastNotifiedPrice

  if (!changedSinceNotify) {
    return { notify: false, reason: null }
  }

  if (targetReached) {
    return { notify: true, reason: 'TARGET_REACHED' }
  }

  if (droppedSinceLastSeen) {
    return { notify: true, reason: 'PRICE_DROPPED' }
  }

  return { notify: false, reason: null }
}

async function runPriceAlertCycle() {
  try {
    const games = await loadGames()
    const titleBySlug = new Map(games.map((game) => [game.slug, game.title]))

    if (isDatabaseReady()) {
      const prisma = getPrisma()
      const alerts = await prisma.priceAlert.findMany({
        where: { isActive: true },
        take: env.NOTIFICATION_BATCH_LIMIT
      })

      for (const alert of alerts) {
        const snapshot = await getPriceSnapshot(alert.gameSlug, { title: titleBySlug.get(alert.gameSlug) })
        const currentAmount = resolveCurrentAmount(snapshot)
        if (typeof currentAmount !== 'number') continue

        const decision = shouldNotify(alert, currentAmount)
        if (decision.notify) {
          await sendTypedNotification({
            type: decision.reason === 'TARGET_REACHED' ? 'PRICE_TARGET' : 'PRICE_DROP',
            email: alert.email,
            userId: alert.userId || null,
            gameSlug: alert.gameSlug,
            payload: {
              gameTitle: titleBySlug.get(alert.gameSlug) || alert.gameSlug,
              gameSlug: alert.gameSlug,
              currentPrice: snapshot?.bestDeal?.currentPrice || String(currentAmount),
              targetPrice: alert.targetPrice,
              reason: decision.reason
            }
          })
        }

        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: {
            lastSeenPrice: currentAmount,
            ...(decision.notify ? { lastNotifiedPrice: currentAmount, lastTriggeredAt: new Date() } : {})
          }
        })
      }
      return
    }

    const runtimeAlerts = getAllRuntimePriceAlerts().filter((alert) => alert.isActive)
    for (const alert of runtimeAlerts.slice(0, env.NOTIFICATION_BATCH_LIMIT)) {
      const snapshot = await getPriceSnapshot(alert.gameSlug, { title: titleBySlug.get(alert.gameSlug) })
      const currentAmount = resolveCurrentAmount(snapshot)
      if (typeof currentAmount !== 'number') continue

      const decision = shouldNotify(alert, currentAmount)
      if (decision.notify) {
        await sendTypedNotification({
          type: decision.reason === 'TARGET_REACHED' ? 'PRICE_TARGET' : 'PRICE_DROP',
          email: alert.email,
          userId: alert.userId || null,
          gameSlug: alert.gameSlug,
          payload: {
            gameTitle: titleBySlug.get(alert.gameSlug) || alert.gameSlug,
            gameSlug: alert.gameSlug,
            currentPrice: snapshot?.bestDeal?.currentPrice || String(currentAmount),
            targetPrice: alert.targetPrice,
            reason: decision.reason
          }
        })
      }

      if (alert.userId) {
        upsertRuntimePriceAlert(alert.userId, {
          ...alert,
          lastSeenPrice: currentAmount,
          ...(decision.notify
            ? { lastNotifiedPrice: currentAmount, lastTriggeredAt: new Date().toISOString() }
            : {}),
          updatedAt: new Date().toISOString()
        })
      }
    }
  } catch (error) {
    logger.error({ error }, 'Price alert notification cycle failed')
  }
}

module.exports = {
  runPriceAlertCycle
}
