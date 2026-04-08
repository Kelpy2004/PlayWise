import * as Sentry from '@sentry/react'

let initialized = false

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!dsn || initialized) {
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.15)
  })

  initialized = true
}

export { Sentry }
