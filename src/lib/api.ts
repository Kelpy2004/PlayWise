import type {
  AssistantChatMessage,
  AssistantReply,
  AuthAvailabilityResponse,
  AuthProvidersResponse,
  AuthResponse,
  CommentRecord,
  CompatibilityResult,
  ContactResponse,
  FavoriteGame,
  HardwareCatalog,
  HardwareSearchSuggestion,
  NewsletterSubscriberRecord,
  NotificationAdminOverview,
  NotificationDeliveryRecord,
  PriceAlertRecord,
  PriceSnapshot,
  ReactionKind,
  ReactionSummary,
  RecommendationPreview,
  SavedHardwareProfile,
  SessionResponse,
  TournamentRecord,
  TournamentSubscriptionRecord,
  TelemetryEventPayload
} from '../types/api'
import type { CpuRecord, GameRecord, GpuRecord, LaptopRecord } from '../types/catalog'

const LIVE_API_BASE = 'https://playwise-cda1.onrender.com/api'

function normalizeApiBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE?.trim()
  if (configured) {
    return normalizeApiBase(configured)
  }

  if (typeof window === 'undefined') {
    return '/api'
  }

  const host = window.location.hostname.toLowerCase()
  const isLocalHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0'

  if (isLocalHost) {
    return '/api'
  }

  if (host.endsWith('.vercel.app')) {
    return '/api'
  }

  return LIVE_API_BASE
}

const API_BASE = resolveApiBase()
const CATALOG_SNAPSHOT_KEY = 'playwise.catalog.snapshot.v1'
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000
const catalogMemoryCache = new Map<string, { timestamp: number; data: GameRecord[] }>()

function getCatalogCacheKey(params?: { q?: string; section?: string; platform?: string }) {
  const search = new URLSearchParams()
  if (params?.q?.trim()) search.set('q', params.q.trim())
  if (params?.section?.trim()) search.set('section', params.section.trim())
  if (params?.platform?.trim()) search.set('platform', params.platform.trim())
  return search.toString() || '__all__'
}

function readCatalogSnapshot(maxAgeMs = CATALOG_CACHE_TTL_MS): GameRecord[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CATALOG_SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { timestamp?: number; data?: GameRecord[] }
    if (!parsed?.timestamp || !Array.isArray(parsed.data)) return null
    if (Date.now() - parsed.timestamp > maxAgeMs) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCatalogSnapshot(data: GameRecord[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      CATALOG_SNAPSHOT_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    )
  } catch {
    // ignore localStorage write failures
  }
}

export function getCachedCatalogSnapshot(maxAgeMs = CATALOG_CACHE_TTL_MS): GameRecord[] | null {
  return readCatalogSnapshot(maxAgeMs)
}

function normalizeErrorMessage(path: string, payload: unknown): string {
  if (typeof payload !== 'string') {
    return (payload as { message?: string })?.message || 'Something went wrong.'
  }

  const trimmed = payload.trim()

  if (trimmed.startsWith('<!DOCTYPE html') || trimmed.includes('<pre>Cannot ')) {
    if (path.includes('/reactions')) {
      return 'Your current PlayWise backend is outdated. Restart the server so the latest reactions routes load.'
    }

    return 'The server returned an HTML error page instead of the expected API response. Restart the backend and try again.'
  }

  return trimmed || 'Something went wrong.'
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    body?: unknown
    token?: string | null
    headers?: Record<string, string>
  } = {}
): Promise<T> {
  const { method = 'GET', body, token, headers = {} } = options
  const finalHeaders: Record<string, string> = { ...headers }

  if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
  }

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    throw new Error(normalizeErrorMessage(path, payload))
  }

  return payload as T
}

export const api = {
  fetchGames: (params?: { q?: string; section?: string; platform?: string }) => {
    const cacheKey = getCatalogCacheKey(params)
    const memoryCached = catalogMemoryCache.get(cacheKey)
    if (memoryCached && Date.now() - memoryCached.timestamp < CATALOG_CACHE_TTL_MS) {
      return Promise.resolve(memoryCached.data)
    }

    if (cacheKey === '__all__') {
      const snapshot = readCatalogSnapshot()
      if (snapshot?.length) {
        catalogMemoryCache.set(cacheKey, { timestamp: Date.now(), data: snapshot })
        return Promise.resolve(snapshot)
      }
    }

    const search = new URLSearchParams()
    if (params?.q?.trim()) search.set('q', params.q.trim())
    if (params?.section?.trim()) search.set('section', params.section.trim())
    if (params?.platform?.trim()) search.set('platform', params.platform.trim())
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request<GameRecord[]>(`/games${suffix}`).then((data) => {
      catalogMemoryCache.set(cacheKey, { timestamp: Date.now(), data })
      if (cacheKey === '__all__' && Array.isArray(data) && data.length) {
        writeCatalogSnapshot(data)
      }
      return data
    })
  },
  fetchGameDetails: (slug: string) => request<GameRecord>(`/games/${slug}`),
  getSession: (token: string) => request<SessionResponse>('/auth/session', { token }),
  fetchAuthProviders: () => request<AuthProvidersResponse>('/auth/providers'),
  checkAuthAvailability: (params: { username?: string; email?: string }) =>
    request<AuthAvailabilityResponse>(
      `/auth/availability?${new URLSearchParams(
        Object.entries(params).reduce(
          (entries, [key, value]) => {
            if (value) {
              entries[key] = value
            }
            return entries
          },
          {} as Record<string, string>
        )
      ).toString()}`
    ),
  login: (body: { usernameOrEmail: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body }),
  register: (body: { username: string; email: string; password: string; adminSetupCode?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body }),
  sendContact: (body: { name: string; email: string; message: string }) =>
    request<ContactResponse>('/contact', { method: 'POST', body }),
  getHardwareCatalog: () => request<HardwareCatalog>('/hardware/catalog'),
  searchHardware: (kind: 'laptop' | 'cpu' | 'gpu', q: string) =>
    request<HardwareSearchSuggestion[]>(
      `/hardware/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}`
    ),
  checkCompatibility: (game: GameRecord, hardware: Record<string, unknown>) =>
    request<CompatibilityResult>('/hardware/compatibility', { method: 'POST', body: { game, hardware } }),
  fetchComments: (slug: string, token?: string | null) => request<CommentRecord[]>(`/comments/${slug}`, { token }),
  postComment: (slug: string, body: { username?: string; message: string }, token?: string | null) =>
    request<CommentRecord>(`/comments/${slug}`, { method: 'POST', body, token }),
  reactToComment: (commentId: string, reaction: ReactionKind | null, token: string) =>
    request<ReactionSummary>(`/comments/${commentId}/reactions`, {
      method: 'POST',
      body: { reaction },
      token
    }),
  fetchPrices: (slug: string) => request<PriceSnapshot>(`/games/${slug}/prices`),
  fetchGameReactions: (slug: string, token?: string | null) =>
    request<ReactionSummary>(`/games/${slug}/reactions`, { token }),
  reactToGame: (slug: string, reaction: ReactionKind | null, token: string) =>
    request<ReactionSummary>(`/games/${slug}/reactions`, {
      method: 'POST',
      body: { reaction },
      token
    }),
  createCpu: (body: CpuRecord, token: string) =>
    request<CpuRecord>('/hardware/cpus', { method: 'POST', body, token }),
  createGpu: (body: GpuRecord, token: string) =>
    request<GpuRecord>('/hardware/gpus', { method: 'POST', body, token }),
  createLaptop: (body: LaptopRecord, token: string) =>
    request<LaptopRecord>('/hardware/laptops', { method: 'POST', body, token }),
  trackEvent: (body: TelemetryEventPayload & { sessionId: string; path?: string }, token?: string | null) =>
    request<{ ok: true }>('/telemetry/events', { method: 'POST', body, token }),
  reportClientError: (
    body: { sessionId: string; path?: string; message: string; stack?: string; meta?: Record<string, unknown> },
    token?: string | null
  ) => request<{ ok: true }>('/telemetry/errors', { method: 'POST', body, token }),
  fetchFavorites: (token: string) => request<FavoriteGame[]>('/users/me/favorites', { token }),
  addFavorite: (gameSlug: string, token: string) =>
    request<FavoriteGame>('/users/me/favorites', { method: 'POST', token, body: { gameSlug } }),
  removeFavorite: (gameSlug: string, token: string) =>
    request<{ ok: true }>('/users/me/favorites/remove', { method: 'POST', token, body: { gameSlug } }),
  fetchSavedHardwareProfiles: (token: string) =>
    request<SavedHardwareProfile[]>('/users/me/hardware-profiles', { token }),
  createSavedHardwareProfile: (
    body: Omit<SavedHardwareProfile, 'id'>,
    token: string
  ) => request<SavedHardwareProfile>('/users/me/hardware-profiles', { method: 'POST', body, token }),
  previewRecommendation: (
    body: { gameSlug: string; hardware?: Record<string, unknown>; priceSnapshot?: PriceSnapshot | null },
    token?: string | null
  ) => request<RecommendationPreview>('/recommendations/assist', { method: 'POST', body, token }),
  askAssistant: (
    body: { messages: AssistantChatMessage[]; pagePath?: string; gameSlug?: string },
    token?: string | null
  ) => request<AssistantReply>('/assistant/chat', { method: 'POST', body, token }),
  fetchPriceAlerts: (token: string) => request<PriceAlertRecord[]>('/users/me/price-alerts', { token }),
  createPriceAlert: (
    body: { gameSlug: string; email?: string; targetPrice?: number | null; isActive?: boolean },
    token: string
  ) => request<PriceAlertRecord>('/users/me/price-alerts', { method: 'POST', body, token }),
  updatePriceAlert: (
    id: string,
    body: { targetPrice?: number | null; isActive?: boolean },
    token: string
  ) => request<PriceAlertRecord>(`/users/me/price-alerts/${id}`, { method: 'PATCH', body, token }),
  deletePriceAlert: (id: string, token: string) =>
    request<{ ok: true }>(`/users/me/price-alerts/${id}`, { method: 'DELETE', token }),
  fetchMyNewsletterStatus: (token: string) =>
    request<NewsletterSubscriberRecord>('/users/me/newsletter', { token }),
  subscribeMyNewsletter: (body: { email?: string }, token: string) =>
    request<NewsletterSubscriberRecord>('/users/me/newsletter/subscribe', { method: 'POST', body, token }),
  unsubscribeMyNewsletter: (body: { email?: string }, token: string) =>
    request<NewsletterSubscriberRecord>('/users/me/newsletter/unsubscribe', { method: 'POST', body, token }),
  subscribeNewsletter: (body: { email: string }, token?: string | null) =>
    request<NewsletterSubscriberRecord>('/newsletter/subscribe', { method: 'POST', body, token }),
  unsubscribeNewsletter: (body: { email: string }, token?: string | null) =>
    request<NewsletterSubscriberRecord>('/newsletter/unsubscribe', { method: 'POST', body, token }),
  fetchTournaments: (params?: { game?: string; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.game?.trim()) search.set('game', params.game.trim())
    if (typeof params?.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0) {
      search.set('limit', String(Math.floor(params.limit)))
    }
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request<TournamentRecord[]>(`/tournaments${suffix}`)
  },
  upsertTournament: (
    body: {
      slug: string
      title: string
      gameSlug?: string | null
      startsAt: string
      endsAt?: string | null
      status?: 'UPCOMING' | 'LIVE_NOW' | 'ENDED'
      metadata?: Record<string, unknown> | null
    },
    token: string
  ) => request<TournamentRecord>('/tournaments', { method: 'POST', body, token }),
  fetchTournamentSubscriptions: (token: string) =>
    request<TournamentSubscriptionRecord[]>('/users/me/tournament-subscriptions', { token }),
  createTournamentSubscription: (
    body: { scope: 'ALL' | 'GAME'; gameSlug?: string | null; email?: string; isActive?: boolean },
    token: string
  ) => request<TournamentSubscriptionRecord>('/users/me/tournament-subscriptions', { method: 'POST', body, token }),
  updateTournamentSubscription: (id: string, body: { isActive?: boolean }, token: string) =>
    request<TournamentSubscriptionRecord>(`/users/me/tournament-subscriptions/${id}`, { method: 'PATCH', body, token }),
  deleteTournamentSubscription: (id: string, token: string) =>
    request<{ ok: true }>(`/users/me/tournament-subscriptions/${id}`, { method: 'DELETE', token }),
  fetchAdminNotificationOverview: (token: string) =>
    request<NotificationAdminOverview>('/admin/notifications/overview', { token }),
  fetchAdminPriceAlerts: (token: string) =>
    request<PriceAlertRecord[]>('/admin/notifications/price-alerts', { token }),
  fetchAdminNewsletterSubscribers: (token: string) =>
    request<NewsletterSubscriberRecord[]>('/admin/notifications/newsletter-subscribers', { token }),
  fetchAdminTournamentSubscribers: (token: string) =>
    request<TournamentSubscriptionRecord[]>('/admin/notifications/tournament-subscribers', { token }),
  fetchAdminNotificationDeliveries: (token: string) =>
    request<NotificationDeliveryRecord[]>('/admin/notifications/deliveries', { token })
}

export function getOAuthStartUrl(provider: 'google' | 'microsoft' | 'apple', returnTo = '/'): string {
  const params = new URLSearchParams({ returnTo })
  return `${API_BASE}/auth/oauth/${provider}/start?${params.toString()}`
}
