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
  PriceSnapshot,
  ReactionKind,
  ReactionSummary,
  RecommendationPreview,
  SavedHardwareProfile,
  SessionResponse,
  TelemetryEventPayload
} from '../types/api'
import type { CpuRecord, GameRecord, GpuRecord, LaptopRecord } from '../types/catalog'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

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
  fetchGames: () => request<GameRecord[]>('/games'),
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
  ) => request<AssistantReply>('/assistant/chat', { method: 'POST', body, token })
}

export function getOAuthStartUrl(provider: 'google' | 'microsoft' | 'apple', returnTo = '/'): string {
  const params = new URLSearchParams({ returnTo })
  return `${API_BASE}/auth/oauth/${provider}/start?${params.toString()}`
}
