import type { CpuRecord, GameRecord, GpuRecord, LaptopRecord } from './catalog'

export interface SessionUser {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
}

export interface AuthResponse {
  message?: string
  token: string
  user: SessionUser
}

export interface SessionResponse {
  user: SessionUser
}

export interface ContactResponse {
  ok: boolean
  message: string
}

export interface HardwareCatalog {
  cpus: CpuRecord[]
  gpus: GpuRecord[]
  laptops: LaptopRecord[]
  ramOptions: number[]
}

export type ReactionKind = 'LIKE' | 'DISLIKE'

export interface HardwareSearchSuggestion {
  kind: 'laptop' | 'cpu' | 'gpu'
  label: string
  value: string
  matchValue?: string
  meta?: string
  confidence?: number
  matchType?: string
}

export interface CompatibilityResult {
  canRun: string
  performance?: string
  tone?: string
  recommendedPreset: string
  fps?: {
    low?: string
    medium?: string
    high?: string
  }
  expectedFps?: string
  warning?: string
  source: string
  platform?: string
  details?: string[]
}

export interface CommentRecord {
  id?: string
  username: string
  message: string
  gameSlug?: string
  userId?: string | null
  likeCount?: number
  dislikeCount?: number
  userReaction?: ReactionKind | null
  createdAt: string
}

export interface ReactionSummary {
  gameSlug?: string
  commentId?: string
  likeCount: number
  dislikeCount: number
  userReaction?: ReactionKind | null
}

export interface PriceStoreEntry {
  store: string
  amount?: number | null
  regularAmount?: number | null
  currency?: string | null
  currentPrice?: string | null
  regularPrice?: string | null
  cut?: number | null
  url?: string | null
  note?: string | null
}

export interface PriceHistoryPoint {
  timestamp: string
  amount: number
  regularAmount?: number | null
  cut?: number | null
  currency?: string | null
  store?: string | null
  label?: string
}

export interface PriceTimingInsight {
  decision: 'BUY_NOW' | 'WAIT_FOR_DROP' | 'WATCH_CLOSELY' | 'FAIR_PRICE'
  confidence: number
  dropProbability: number
  forecastWindowDays?: number | null
  summary: string
  reasons: string[]
  stats: {
    currentAmount?: number | null
    historicalLowAmount?: number | null
    average30Amount?: number | null
    average90Amount?: number | null
    currentVsLowPct?: number | null
    saleCycleDays?: number | null
    daysSinceLastSale?: number | null
    recentTrendPct?: number | null
    volatility?: number | null
  }
}

export interface PriceSnapshot {
  supported: boolean
  live: boolean
  message: string
  source?: string
  bestDeal?: PriceStoreEntry | null
  historicalLow?: {
    store?: string | null
    amount?: number | null
    currency?: string | null
    price?: string | null
    regularAmount?: number | null
    regularPrice?: string | null
    cut?: number | null
    timestamp?: string | null
  } | null
  stores?: PriceStoreEntry[]
  history?: {
    available: boolean
    source?: string
    spanDays?: number
    points: PriceHistoryPoint[]
  }
  timing?: PriceTimingInsight
  lastUpdated?: string
}

export interface SavedHardwareProfile {
  id: string
  label: string
  kind: 'LAPTOP' | 'MANUAL'
  laptopModel?: string | null
  cpuName?: string | null
  gpuName?: string | null
  ram?: number | null
  isDefault: boolean
}

export interface FavoriteGame {
  id: string
  gameSlug: string
  createdAt: string
}

export interface RecommendationPreview {
  decision: 'BUY_NOW' | 'WAIT_FOR_SALE' | 'SKIP' | 'TRY_ALTERNATIVE'
  confidence: number
  summary: string
  reasons: string[]
  alternativeSlug?: string | null
  game?: GameRecord | null
}

export interface AssistantChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AssistantReply {
  reply: string
  model?: string
}

export interface TelemetryEventPayload {
  category: string
  action: string
  label?: string
  meta?: Record<string, unknown>
}
