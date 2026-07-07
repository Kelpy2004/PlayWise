// Tiny stale-while-revalidate cache for API view-data.
//
// Returning visitors read the last-seen *real* value instantly (so first paint
// shows real numbers/games/covers, not a mock), then the caller refreshes in the
// background and writes the fresh value back. Fails safe: any storage/parse error
// just returns null, so the caller falls back to its representative mock.

const PREFIX = 'pw.cache.'

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data?: T }
    return parsed?.data ?? null
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), data }))
  } catch {
    /* quota exceeded / storage disabled — non-fatal */
  }
}
