// Data helpers for the new PlayWise homepage (ported from the Claude Design VM
// logic). Maps real API records to the view-model the design markup expects, and
// supplies representative fallback data when the API is empty/unreachable.

import type { DealRecord, NewsItem, TournamentRecord } from '../types/api'
import type { GameRecord } from '../types/catalog'

// slug → cover image map, used to give tournaments (and image-less deals) real art.
export type CoverMap = Record<string, string>

export function buildCoverMap(games: Array<Pick<GameRecord, 'slug' | 'image'>>): CoverMap {
  const map: CoverMap = {}
  for (const g of games) {
    if (g.slug && g.image) map[g.slug] = g.image
  }
  return map
}

// Cover gradients cycled across cards (from the design's buildVM()).
export const GRADS = [
  'linear-gradient(135deg,#a24dff,#ff2e6e)',
  'linear-gradient(135deg,#1fd7ff,#a24dff)',
  'linear-gradient(135deg,#ff2e6e,#ffb627)',
  'linear-gradient(135deg,#caff3f,#1fd7ff)',
  'linear-gradient(135deg,#ffb627,#ff2e6e)',
  'linear-gradient(135deg,#a24dff,#1fd7ff)',
  'linear-gradient(135deg,#1fd7ff,#caff3f)',
  'linear-gradient(135deg,#ff2e6e,#a24dff)',
]

const STORE_COLORS: Record<string, string> = {
  Steam: '#1fd7ff',
  Epic: '#e9e6f5',
  'Epic Games': '#e9e6f5',
  Xbox: '#caff3f',
  'GeForce NOW': '#caff3f',
  NVIDIA: '#caff3f',
  Ubisoft: '#1fd7ff',
  EA: '#ff2e6e',
  GOG: '#a24dff',
}

export function storeColor(store?: string | null): string {
  if (!store) return '#a24dff'
  return STORE_COLORS[store] || '#a24dff'
}

function coverFor(index: number, offset = 0): string {
  return GRADS[(index + offset) % GRADS.length]
}

function humanize(slug?: string | null): string {
  if (!slug) return ''
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ---- relative-time helpers -------------------------------------------------
export function relPast(iso: string, now = Date.now()): string {
  const s = (now - new Date(iso).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export function relFuture(iso: string, now = Date.now()): string {
  const s = (new Date(iso).getTime() - now) / 1000
  if (s <= 0) return 'now'
  if (s < 3600) return `in ${Math.round(s / 60)}m`
  if (s < 86400) return `in ${Math.round(s / 3600)}h`
  const d = Math.floor(s / 86400)
  const h = Math.round((s % 86400) / 3600)
  return `in ${d}d${h ? ` ${h}h` : ''}`
}

export function fmtDM(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ---- view-models -----------------------------------------------------------
export interface DealVM {
  title: string
  cover: string
  image?: string | null
  store: string
  storeColor: string
  badge: string
  badgeColor: string
  priceText: string
  origText: string
  url?: string
  gameSlug?: string | null
}

export interface TournVM {
  title: string
  game: string
  gameSlug?: string | null
  cover: string
  image?: string | null
  live: boolean
  when: string
  rel: string
  statusColor: string
  statusLabel: string
  startsAt: string
  url?: string | null
}

export interface NewsVM {
  title: string
  source: string
  cover: string
  image?: string | null
  srcColor: string
  time: string
  publishedAt: string
  url?: string
  rank?: string
}

export function mapDeals(deals: DealRecord[], covers: CoverMap = {}): DealVM[] {
  return deals.map((d, i) => {
    const isFree = d.type === 'FREE_GAME' || d.dealPrice === 0
    const deal = typeof d.dealPrice === 'number' ? d.dealPrice : 0
    const orig = typeof d.originalPrice === 'number' ? d.originalPrice : 0
    return {
      title: d.title,
      cover: coverFor(i),
      image: d.imageUrl || (d.gameSlug ? covers[d.gameSlug] : null) || null,
      store: d.store,
      storeColor: storeColor(d.store),
      badge: isFree ? 'FREE' : `−${d.discountPct ?? 0}%`,
      badgeColor: isFree ? '#1fd7ff' : '#caff3f',
      priceText: isFree ? 'Free' : `$${deal.toFixed(2)}`,
      origText: orig ? `$${orig.toFixed(2)}` : '',
      url: d.url,
      gameSlug: d.gameSlug,
    }
  })
}

export function mapTourns(tourns: TournamentRecord[], now = Date.now(), covers: CoverMap = {}): TournVM[] {
  return tourns.map((t, i) => {
    const live = t.status === 'LIVE_NOW'
    const meta = t.metadata || {}
    const gameName =
      (typeof meta.videogame === 'string' && meta.videogame) ||
      humanize(t.gameSlug) ||
      t.title.split(/[—:-]/)[0].trim()
    return {
      title: t.title,
      game: gameName,
      gameSlug: t.gameSlug,
      cover: coverFor(i, 2),
      image: (t.gameSlug ? covers[t.gameSlug] : null) || null,
      live,
      when: live ? 'LIVE NOW' : fmtDM(t.startsAt),
      rel: live ? 'On air now' : relFuture(t.startsAt, now),
      statusColor: live ? '#ff2e6e' : 'rgba(0,0,0,.55)',
      statusLabel: live ? 'LIVE' : 'UPCOMING',
      startsAt: t.startsAt,
      url: (typeof meta.url === 'string' && meta.url) || (typeof meta.registrationUrl === 'string' && meta.registrationUrl) || null,
    }
  })
}

export function mapNews(news: NewsItem[], now = Date.now()): NewsVM[] {
  return news.map((n, i) => ({
    title: n.title,
    source: n.source,
    cover: coverFor(i, 4),
    image: n.image || null,
    srcColor: storeColor(n.source),
    time: relPast(n.publishedAt, now),
    publishedAt: n.publishedAt,
    url: n.url,
  }))
}

// ---- representative fallback (used only when the API returns nothing) -------
export function fallbackDeals(): DealVM[] {
  const raw = [
    { title: 'Cyberpunk 2077', store: 'Steam', dealPrice: 8.99, originalPrice: 59.99, discountPct: 85, isFree: false },
    { title: "Baldur's Gate 3", store: 'GOG', dealPrice: 35.99, originalPrice: 59.99, discountPct: 40, isFree: false },
    { title: 'Elden Ring', store: 'Steam', dealPrice: 29.99, originalPrice: 59.99, discountPct: 50, isFree: false },
    { title: 'Red Dead Redemption 2', store: 'Steam', dealPrice: 19.79, originalPrice: 59.99, discountPct: 67, isFree: false },
    { title: 'Fall Guys', store: 'Epic', dealPrice: 0, originalPrice: 19.99, discountPct: 100, isFree: true },
    { title: 'Forza Horizon 5', store: 'Xbox', dealPrice: 23.09, originalPrice: 59.99, discountPct: 61, isFree: false },
    { title: 'Hades II', store: 'Steam', dealPrice: 24.49, originalPrice: 29.99, discountPct: 18, isFree: false },
    { title: 'It Takes Two', store: 'EA', dealPrice: 9.99, originalPrice: 39.99, discountPct: 75, isFree: false },
    { title: 'Star Wars Outlaws', store: 'Ubisoft', dealPrice: 35.99, originalPrice: 59.99, discountPct: 40, isFree: false },
    { title: 'Control Ultimate Edition', store: 'Epic', dealPrice: 0, originalPrice: 29.99, discountPct: 100, isFree: true },
    { title: 'Hollow Knight', store: 'GOG', dealPrice: 3.74, originalPrice: 14.99, discountPct: 75, isFree: false },
    { title: 'Phantom Liberty', store: 'GOG', dealPrice: 20.99, originalPrice: 29.99, discountPct: 30, isFree: false },
  ]
  return raw.map((d, i) => ({
    title: d.title,
    cover: coverFor(i),
    store: d.store,
    storeColor: storeColor(d.store),
    badge: d.isFree ? 'FREE' : `−${d.discountPct}%`,
    badgeColor: d.isFree ? '#1fd7ff' : '#caff3f',
    priceText: d.isFree ? 'Free' : `$${d.dealPrice.toFixed(2)}`,
    origText: `$${d.originalPrice.toFixed(2)}`,
  }))
}

export function fallbackTourns(now = Date.now()): TournVM[] {
  const H = 3600000
  const raw = [
    { title: 'Valorant Champions 2026', game: 'Valorant', offset: -1 * H, status: 'LIVE_NOW' },
    { title: 'CS2 Major Playoffs', game: 'Counter-Strike 2', offset: 0.5 * H, status: 'LIVE_NOW' },
    { title: 'Apex Pro League Finals', game: 'Apex Legends', offset: 30 * H, status: 'UPCOMING' },
    { title: 'Rocket League RLCS', game: 'Rocket League', offset: 52 * H, status: 'UPCOMING' },
    { title: 'Street Fighter 6 Capcom Cup', game: 'Street Fighter 6', offset: 22 * H, status: 'UPCOMING' },
    { title: 'Fortnite FNCS Grand Finals', game: 'Fortnite', offset: 76 * H, status: 'UPCOMING' },
    { title: 'Dota 2 Riyadh Masters', game: 'Dota 2', offset: 120 * H, status: 'UPCOMING' },
    { title: 'League Worlds Qualifier', game: 'League of Legends', offset: 168 * H, status: 'UPCOMING' },
  ]
  return raw.map((t, i) => {
    const live = t.status === 'LIVE_NOW'
    const startsAt = new Date(now + t.offset).toISOString()
    return {
      title: t.title,
      game: t.game,
      cover: coverFor(i, 2),
      live,
      when: live ? 'LIVE NOW' : fmtDM(startsAt),
      rel: live ? 'On air now' : relFuture(startsAt, now),
      statusColor: live ? '#ff2e6e' : 'rgba(0,0,0,.55)',
      statusLabel: live ? 'LIVE' : 'UPCOMING',
      startsAt,
    }
  })
}

export function fallbackNews(now = Date.now()): NewsVM[] {
  const H = 3600000
  const raw = [
    { title: 'Steam Summer Sale goes live with record discounts', source: 'Steam', offset: 3 * H },
    { title: 'Epic gives away Control plus two indies this week', source: 'Epic', offset: 6 * H },
    { title: 'NVIDIA launches DLSS 4 with multi-frame generation', source: 'NVIDIA', offset: 20 * H },
    { title: 'Xbox Game Pass adds six day-one titles in July', source: 'Xbox', offset: 25 * H },
    { title: "Ubisoft reveals the next Assassin's Creed chapter", source: 'Ubisoft', offset: 47 * H },
    { title: 'EA Play drops three sports titles into the vault', source: 'EA', offset: 50 * H },
    { title: 'GeForce NOW adds 25 games and an Ultimate upgrade', source: 'NVIDIA', offset: 74 * H },
    { title: 'Steam Deck OLED gets a surprise summer price cut', source: 'Steam', offset: 100 * H },
  ]
  return raw.map((n, i) => {
    const publishedAt = new Date(now - n.offset).toISOString()
    return {
      title: n.title,
      source: n.source,
      cover: coverFor(i, 4),
      srcColor: storeColor(n.source),
      time: relPast(publishedAt, now),
      publishedAt,
    }
  })
}

// Seeded sample of n items — fresh per visit but stable within it.
export function seededPick<T>(arr: T[], seed: number, n: number): T[] {
  const a = [...arr]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

// ---- Time Machine (representative price history) ----------------------------
export const TM_MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']

export const PRICE_HISTORY: Record<string, number[]> = {
  'Cyberpunk 2077': [59.99, 59.99, 49.99, 49.99, 39.99, 29.99, 29.99, 24.99, 19.99, 14.99, 11.99, 8.99],
  'Elden Ring': [59.99, 59.99, 59.99, 49.99, 49.99, 47.99, 41.99, 41.99, 35.99, 35.99, 29.99, 29.99],
  "Baldur's Gate 3": [59.99, 59.99, 59.99, 59.99, 53.99, 53.99, 47.99, 47.99, 41.99, 41.99, 38.99, 35.99],
  'Red Dead Redemption 2': [59.99, 49.99, 44.99, 39.99, 33.99, 29.99, 29.99, 24.99, 23.99, 21.99, 19.79, 19.79],
}

export const TM_GAMES = Object.keys(PRICE_HISTORY)
