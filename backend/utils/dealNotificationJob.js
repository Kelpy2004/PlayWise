const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { getAllRuntimeDealSubscriptions } = require('./runtimeStore')
const { sendTypedNotification } = require('./notificationService')
const { getDealsCache } = require('./dealsAggregator')

const BATCH_LIMIT = env.NOTIFICATION_BATCH_LIMIT || 200

async function getActiveSubscriptions() {
  if (isDatabaseReady()) {
    const prisma = getPrisma()
    return prisma.dealSubscription.findMany({
      where: { isActive: true },
      take: BATCH_LIMIT
    })
  }
  return getAllRuntimeDealSubscriptions().filter((s) => s.isActive !== false)
}

function shouldNotify(subscription, deal) {
  // Respect subscription preferences
  if (deal.type === 'FREE_GAME' || deal.type === 'MISSION_FREE') {
    return subscription.notifyFreeGames !== false
  }
  if (deal.type === 'DISCOUNT') {
    if (!subscription.notifyDiscounts) return false
    const minPct = subscription.minDiscountPct || 75
    return (deal.discountPct || 0) >= minPct
  }
  return true
}

function isNewDeal(deal, lastNotifiedAt) {
  if (!lastNotifiedAt) return true
  const dealCreated = new Date(deal.createdAt || deal.startsAt || 0).getTime()
  const lastNotified = new Date(lastNotifiedAt).getTime()
  return dealCreated > lastNotified
}

async function runDealNotificationCycle() {
  const cache = getDealsCache()
  if (!cache.data.length) return

  const subscriptions = await getActiveSubscriptions()
  if (!subscriptions.length) return

  // Only notify about active deals
  const activeDeals = cache.data.filter((d) => d.isActive !== false)
  if (!activeDeals.length) return

  let sent = 0
  for (const sub of subscriptions) {
    const newDeals = activeDeals.filter(
      (deal) => shouldNotify(sub, deal) && isNewDeal(deal, sub.lastNotifiedAt)
    )
    if (!newDeals.length) continue

    // Group deals for one email
    const freeDeals = newDeals.filter((d) => d.type === 'FREE_GAME' || d.type === 'MISSION_FREE')
    const discountDeals = newDeals.filter((d) => d.type === 'DISCOUNT')

    try {
      await sendTypedNotification({
        type: 'DEAL_ALERT',
        email: sub.email,
        userId: sub.userId || null,
        payload: {
          freeGames: freeDeals.slice(0, 10).map((d) => ({
            title: d.title,
            store: d.store,
            url: d.url,
            endsAt: d.endsAt
          })),
          discounts: discountDeals.slice(0, 10).map((d) => ({
            title: d.title,
            store: d.store,
            discountPct: d.discountPct,
            dealPrice: d.dealPrice,
            originalPrice: d.originalPrice,
            currency: d.currency,
            url: d.url
          })),
          totalFree: freeDeals.length,
          totalDiscounts: discountDeals.length
        }
      })

      // Update lastNotifiedAt
      if (isDatabaseReady()) {
        const prisma = getPrisma()
        await prisma.dealSubscription.update({
          where: { id: sub.id },
          data: { lastNotifiedAt: new Date() }
        })
      }

      sent++
    } catch (error) {
      logger.warn({ error, email: sub.email }, 'Deal notification failed for subscriber')
    }

    if (sent >= BATCH_LIMIT) break
  }

  if (sent > 0) {
    logger.info({ sent }, 'Deal notifications dispatched')
  }
}

module.exports = {
  runDealNotificationCycle
}
