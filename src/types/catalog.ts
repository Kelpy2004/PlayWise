export type Tone = 'good' | 'warn' | 'bad' | 'blue' | 'info'

export interface StructuredRatings {
  story: number
  gameplay: number
  graphics: number
  optimization: number
  replayability: number
}

export interface BugStatus {
  label: string
  note?: string
  tone?: Tone | string
}

export interface ValueRating {
  score: number
  advice: string
}

export interface PlayerTypes {
  bestFor?: string[]
  notIdealFor?: string[]
}

export interface TimeCommitment {
  mainStory?: string
  mainPlusSide?: string
  completionist?: string
}

export interface RequirementTarget {
  cpuScore?: number
  gpuScore?: number
  ram?: number
}

export interface Requirements {
  minimum?: RequirementTarget
  recommended?: RequirementTarget
}

export interface OptimizationTier {
  tier: string
  settings: string
  fps: string
  note: string
}

export interface StoreLink {
  label: string
  url: string
}

export interface TrailerInfo {
  title: string
  youtubeId: string
  url: string
}

export interface GameRecord {
  slug: string
  catalogSource?: 'local' | 'igdb' | string
  externalRatingCount?: number
  shortCode?: string
  title: string
  year?: number
  genre: string[]
  genres?: string[]
  platform?: string[]
  heroTag?: string
  image?: string
  banner?: string
  description?: string
  story?: string
  gallery?: string[]
  structuredRatings?: StructuredRatings
  bugStatus?: BugStatus
  valueRating?: ValueRating
  playerTypes?: PlayerTypes
  timeCommitment?: TimeCommitment
  optimizationGuide?: OptimizationTier[]
  similarGames?: string[]
  storeInsight?: string
  requirements?: Requirements
  trailer?: TrailerInfo
  storeLinks?: StoreLink[]
  demandLevel?: string
  demandTone?: Tone | string
  officialSite?: string
  downloadUrl?: string
  licenseTag?: string
  pricingTag?: string
  averageRating?: number | null
  openSource?: boolean
  supportedPlatforms?: string[]
}

export interface CpuRecord {
  id?: string
  name: string
  score: number
  family?: string
  platform?: string
  notes?: string
}

export interface GpuRecord {
  id?: string
  name: string
  score: number
  family?: string
  platform?: string
  notes?: string
}

export interface LaptopRecord {
  id?: string
  model: string
  brand?: string
  cpu: string
  gpu: string
  ram: number
  platform?: string
  tags?: string[]
  notes?: string
}
