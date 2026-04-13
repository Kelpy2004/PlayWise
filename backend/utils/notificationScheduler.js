const { env } = require('../lib/env')
const { logger } = require('../lib/logger')
const { runPriceAlertCycle } = require('./priceAlertJob')
const { runTournamentNotificationCycle } = require('./tournamentNotificationJob')

let started = false

function safeInterval(fn, intervalMs, label) {
  const tick = async () => {
    try {
      await fn()
    } catch (error) {
      logger.error({ error }, `${label} interval failed`)
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

  safeInterval(runPriceAlertCycle, Math.max(30 * 1000, env.PRICE_ALERT_JOB_INTERVAL_MS), 'price-alert-job')
  safeInterval(runTournamentNotificationCycle, Math.max(30 * 1000, env.TOURNAMENT_JOB_INTERVAL_MS), 'tournament-notification-job')
  logger.info('Notification jobs started')
}

module.exports = {
  startNotificationJobs
}
