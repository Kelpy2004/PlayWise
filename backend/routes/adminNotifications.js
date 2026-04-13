const express = require('express')

const { asyncHandler } = require('../lib/http')
const { getPrisma, isDatabaseReady } = require('../lib/prisma')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const {
  getAllRuntimePriceAlerts,
  getAllRuntimeTournamentSubscriptions,
  getRuntimeNewsletterSubscribers,
  getRuntimeNotificationDeliveries
} = require('../utils/runtimeStore')

const router = express.Router()

router.get(
  '/overview',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    if (isDatabaseReady()) {
      const prisma = getPrisma()
      const [activePriceAlerts, subscribedNewsletters, activeTournamentSubs, recentDeliveries] = await Promise.all([
        prisma.priceAlert.count({ where: { isActive: true } }),
        prisma.newsletterSubscriber.count({ where: { isSubscribed: true } }),
        prisma.tournamentSubscription.count({ where: { isActive: true } }),
        prisma.notificationDelivery.count({
          where: {
            createdAt: { gte: new Date(Date.now() - (24 * 60 * 60 * 1000)) }
          }
        })
      ])

      return res.json({ activePriceAlerts, subscribedNewsletters, activeTournamentSubs, recentDeliveries })
    }

    const runtimePriceAlerts = getAllRuntimePriceAlerts()
    const runtimeTournamentSubscriptions = getAllRuntimeTournamentSubscriptions()
    const runtimeNewsletters = getRuntimeNewsletterSubscribers().filter((entry) => entry.isSubscribed).length
    const runtimeRecent = getRuntimeNotificationDeliveries().filter((entry) => {
      const created = new Date(entry.createdAt || 0).getTime()
      return Number.isFinite(created) && created >= Date.now() - (24 * 60 * 60 * 1000)
    }).length

    res.json({
      activePriceAlerts: runtimePriceAlerts.filter((entry) => entry.isActive).length,
      subscribedNewsletters: runtimeNewsletters,
      activeTournamentSubs: runtimeTournamentSubscriptions.filter((entry) => entry.isActive).length,
      recentDeliveries: runtimeRecent
    })
  })
)

router.get(
  '/price-alerts',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    if (isDatabaseReady()) {
      const alerts = await getPrisma().priceAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 300 })
      return res.json(alerts)
    }

    res.json(getAllRuntimePriceAlerts())
  })
)

router.get(
  '/newsletter-subscribers',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    if (isDatabaseReady()) {
      const subscribers = await getPrisma().newsletterSubscriber.findMany({ orderBy: { updatedAt: 'desc' }, take: 500 })
      return res.json(subscribers)
    }

    res.json(getRuntimeNewsletterSubscribers())
  })
)

router.get(
  '/tournament-subscribers',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    if (isDatabaseReady()) {
      const subscriptions = await getPrisma().tournamentSubscription.findMany({ orderBy: { createdAt: 'desc' }, take: 400 })
      return res.json(subscriptions)
    }

    res.json(getAllRuntimeTournamentSubscriptions())
  })
)

router.get(
  '/deliveries',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    if (isDatabaseReady()) {
      const deliveries = await getPrisma().notificationDelivery.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })
      return res.json(deliveries)
    }

    res.json(getRuntimeNotificationDeliveries())
  })
)

module.exports = router
