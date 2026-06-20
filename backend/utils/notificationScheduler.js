const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { isDatabaseReady } = require('../lib/prisma')
const { runPriceAlertCycle } = require('./priceAlertJob')
const { runTournamentNotificationCycle } = require('./tournamentNotificationJob')
const { runDealNotificationCycle } = require('./dealNotificationJob')

let started = false
let dbFailures = 0
const DB_FAILURE_COOLDOWN = 5

function safeInterval(fn, intervalMs, label, requiresDb = false) {
  const tick = async () => {
    if (requiresDb && (!isDatabaseReady() || dbFailures >= DB_FAILURE_COOLDOWN)) {
      return
    }
    try {
      await fn()
      if (requiresDb) dbFailures = 0
    } catch (error) {
      if (requiresDb) dbFailures++
      if (dbFailures === DB_FAILURE_COOLDOWN) {
        logger.warn(`${label}: database unreachable, pausing until next restart`)
      } else {
        logger.error({ error }, `${label} interval failed`)
      }
    }
  }

  const handle = setInterval(() => {
    void tick()
  }, intervalMs)

  handle.unref()
  void tick()
}

function startNotificationJobs() {
  if (started) return
  started = true

  safeInterval(runPriceAlertCycle, Math.max(30 * 1000, env.PRICE_ALERT_JOB_INTERVAL_MS), 'price-alert-job', true)
  const soonWindowMs = Math.max(5, Number(env.TOURNAMENT_SOON_WINDOW_MINUTES) || 30) * 60 * 1000
  const tournamentInterval = Math.min(Math.max(30 * 1000, env.TOURNAMENT_JOB_INTERVAL_MS), soonWindowMs / 2)
  safeInterval(runTournamentNotificationCycle, tournamentInterval, 'tournament-notification-job', true)
  safeInterval(runDealNotificationCycle, Math.max(60 * 1000, env.DEALS_JOB_INTERVAL_MS), 'deal-notification-job', true)
  logger.info('Notification jobs started (price alerts, tournaments, deals)')
}

module.exports = {
  startNotificationJobs
}
