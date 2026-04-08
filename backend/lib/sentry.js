const Sentry = require('@sentry/node')

const { env } = require('./env')

let sentryEnabled = false

function initSentry() {
  if (!env.SENTRY_DSN || sentryEnabled) {
    return sentryEnabled
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE
  })

  sentryEnabled = true
  return true
}

function captureException(error, context) {
  if (!sentryEnabled) return

  Sentry.withScope((scope) => {
    if (context?.path) scope.setTag('path', context.path)
    if (context?.method) scope.setTag('method', context.method)
    if (context?.userId) scope.setUser({ id: context.userId })

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }

    Sentry.captureException(error)
  })
}

module.exports = {
  captureException,
  initSentry,
  isSentryEnabled: () => sentryEnabled
}
