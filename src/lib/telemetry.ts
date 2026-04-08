import type { TelemetryEventPayload } from '../types/api'
import { api } from './api'

const SESSION_KEY = 'playwise-session-id'

function getSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) return existing

  const next = `pw-${crypto.randomUUID()}`
  window.localStorage.setItem(SESSION_KEY, next)
  return next
}

export async function trackEvent(payload: TelemetryEventPayload, token?: string | null): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    await api.trackEvent(
      {
        ...payload,
        sessionId: getSessionId(),
        path: window.location.pathname + window.location.search
      },
      token
    )
  } catch {
    // Telemetry should never break the app.
  }
}

export async function reportClientError(
  error: Error,
  meta?: Record<string, unknown>,
  token?: string | null
): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    await api.reportClientError(
      {
        sessionId: getSessionId(),
        path: window.location.pathname + window.location.search,
        message: error.message,
        stack: error.stack,
        meta
      },
      token
    )
  } catch {
    // Monitoring should never break the app.
  }
}
