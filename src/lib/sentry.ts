import * as Sentry from '@sentry/react'

let initialized = false

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local')
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  // Only report from real production builds served from a real host. The dev
  // server (vite) would otherwise flood Sentry with HMR/edit transients — e.g. a
  // symbol briefly "not defined" in the moment between adding its use and its
  // import — which are not real bugs.
  if (!dsn || initialized || !import.meta.env.PROD || isLocalhost()) {
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.15),
    ignoreErrors: [
      // Stale tab loading a chunk whose hash changed after a new deploy — transient,
      // resolves on reload, not actionable.
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
      'Load failed',
      // Benign browser noise.
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  })

  initialized = true
}

export { Sentry }
