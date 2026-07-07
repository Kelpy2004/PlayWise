// Data layer for the new Tournaments page (ported from the Claude Design GEN()).
// The backend's TournamentRecord lacks the rich card fields the design shows
// (spots left, prize, fee, region, format, registration deadline), so we build a
// representative dataset and overlay real tournaments where they map.

import type { TournamentRecord } from '../types/api'

export interface GameDef {
  slug: string
  name: string
  abbr: string
  accent: string
}

export const GAMES: GameDef[] = [
  { slug: 'valorant', name: 'Valorant', abbr: 'VAL', accent: '#ff2e6e' },
  { slug: 'cs2', name: 'Counter-Strike 2', abbr: 'CS2', accent: '#ffb627' },
  { slug: 'lol', name: 'League of Legends', abbr: 'LoL', accent: '#1fd7ff' },
  { slug: 'dota2', name: 'Dota 2', abbr: 'DOTA', accent: '#a24dff' },
  { slug: 'rl', name: 'Rocket League', abbr: 'RL', accent: '#caff3f' },
  { slug: 'apex', name: 'Apex Legends', abbr: 'APEX', accent: '#ff2e6e' },
  { slug: 'fortnite', name: 'Fortnite', abbr: 'FN', accent: '#ffb627' },
  { slug: 'sf6', name: 'Street Fighter 6', abbr: 'SF6', accent: '#1fd7ff' },
  { slug: 'ow2', name: 'Overwatch 2', abbr: 'OW2', accent: '#a24dff' },
  { slug: 'r6', name: 'Rainbow Six', abbr: 'R6', accent: '#caff3f' },
  { slug: 'tekken8', name: 'Tekken 8', abbr: 'TK8', accent: '#ff2e6e' },
  { slug: 'brawlhalla', name: 'Brawlhalla', abbr: 'BH', accent: '#ffb627' },
]

export const CORE_GAMES = 9

export interface SourceDef {
  name: string
  color: string
  text: string
  url: string
}

export const SRC: Record<string, SourceDef> = {
  startgg: { name: 'start.gg', color: '#a24dff', text: '#fff', url: 'https://www.start.gg/' },
  faceit: { name: 'FACEIT', color: '#ff9410', text: '#0b0a12', url: 'https://www.faceit.com/' },
  battlefy: { name: 'Battlefy', color: '#1fd7ff', text: '#0b0a12', url: 'https://battlefy.com/' },
  discord: { name: 'Discord', color: '#6470ff', text: '#fff', url: 'https://discord.com/' },
}

export const SOURCE_KEYS = ['startgg', 'faceit', 'battlefy', 'discord'] as const

export const FILTER_DEFS: Array<{ id: 'date' | 'fee' | 'region'; label: string; options: Array<[string, string]> }> = [
  { id: 'date', label: 'Window', options: [['all', 'Any date'], ['48h', 'Closing 48h'], ['week', 'This week'], ['month', 'This month']] },
  { id: 'fee', label: 'Entry', options: [['all', 'Any fee'], ['free', 'Free only'], ['paid', 'Paid only']] },
  { id: 'region', label: 'Region', options: [['all', 'Any region'], ['India', 'India'], ['Asia', 'Asia'], ['EU', 'EU'], ['NA', 'NA'], ['Online', 'Online']] },
]

export interface TItem {
  id: string
  gameSlug: string
  game: string
  accent: string
  title: string
  src: string
  status: 'live' | 'open'
  dlH: number
  startLabel: string
  region: string
  fee: number // -1 = unknown (real tournaments don't expose fees)
  team: string
  fmt: string[]
  prize: number // -1 = unknown
  total: number
  filled: number
  left: number
  real?: boolean // true when mapped from a real backend tournament
  url?: string | null // real registration/source URL
  venue?: string // "City, CC" when the provider exposes it
}

const REG = ['India', 'South Asia', 'Asia', 'EU', 'NA', 'Online', 'India', 'Asia']
const TEAMS = ['5v5', '1v1', 'Squad', '2v2', '3v3', '5v5', '1v1', '5v5']
const FMT: string[][] = [['Double Elim', 'BO3'], ['Single Elim', 'BO1'], ['Round Robin', 'BO2'], ['Swiss', 'BO3'], ['Battle Royale', '3 rounds'], ['Double Elim', 'BO5'], ['Single Elim', 'BO3'], ['Groups → Playoffs', 'BO3']]
const FEE = [0, 0, 5, 10, 0, 15, 25, 8, 0, 12]
const PRIZE = [0, 500, 1000, 2500, 5000, 10000, 25000, 50000, 1500, 7500]
const TOTAL = [16, 32, 64, 128, 24, 48, 8, 96]
const SLEFT = [3, 9, 21, 40, 5, 12, 2, 30]
const DLH = [5, 20, 30, 44, 9, 60, 84, 120, 160, 200, 14, 38]
const SERIES = ['Weekly Cup', 'Open Ladder', 'Community Clash', 'Pro-Am Qualifier', 'Midnight Showdown', 'Grassroots Brawl', 'Last-Chance Qualifier', 'Regional Circuit', 'Rookie Rumble', 'Throwdown']
const TIMES: Array<[number, number, string]> = [[7, 30, 'PM'], [8, 0, 'PM'], [6, 30, 'PM'], [9, 0, 'PM'], [5, 0, 'PM'], [10, 0, 'PM'], [4, 30, 'PM'], [8, 30, 'PM']]
const WD = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']

function calLabel(addD: number, hh: number, mm: number, ap: string): string {
  let day = 26 + addD
  let mon = 'Jun'
  if (day > 30) { day -= 30; mon = 'Jul' }
  if (mon === 'Jul' && day > 31) { day -= 31; mon = 'Aug' }
  return `${WD[((addD % 7) + 7) % 7]} ${day} ${mon} · ${hh}:${String(mm).padStart(2, '0')} ${ap} IST`
}

export function fmtLeft(ms: number): string {
  if (ms <= 0) return 'Closed'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

export function generated(): TItem[] {
  const out: TItem[] = []
  GAMES.forEach((g, gi) => {
    const K = 3 + ((gi * 2 + 1) % 5)
    for (let j = 0; j < K; j++) {
      const live = j === 0 && gi % 3 === 0
      const dlH = live ? -6 : DLH[(gi + j * 2) % DLH.length]
      const total = TOTAL[(gi + j) % TOTAL.length]
      let left = SLEFT[(gi * 2 + j) % SLEFT.length]
      if (left >= total) left = Math.max(2, Math.floor(total * 0.18))
      const filled = total - left
      const fee = FEE[(gi + j) % FEE.length]
      const prize = PRIZE[(gi + j) % PRIZE.length]
      const team = TEAMS[(gi + j) % TEAMS.length]
      const fmt = FMT[(gi + j) % FMT.length]
      const src = SOURCE_KEYS[(gi + j) % 4]
      const region = REG[(gi + j) % REG.length]
      const series = SERIES[(gi + j) % SERIES.length]
      const tm = TIMES[(gi + j) % TIMES.length]
      const addD = Math.max(1, Math.ceil(Math.abs(dlH) / 24)) + 1
      out.push({
        id: `${g.slug}-${j}`,
        gameSlug: g.slug,
        game: g.name,
        accent: g.accent,
        title: `${g.name} ${series} #${10 + gi + j}`,
        src,
        status: live ? 'live' : 'open',
        dlH,
        startLabel: calLabel(addD, tm[0], tm[1], tm[2]),
        region,
        fee,
        team,
        fmt,
        prize,
        total,
        filled,
        left,
      })
    }
  })
  return out
}

// Map a provider country code onto the page's region filter values.
const ASIA_CODES = new Set(['JP', 'KR', 'CN', 'SG', 'TH', 'PH', 'MY', 'ID', 'VN', 'TW', 'HK', 'MO', 'BD', 'PK', 'LK', 'NP'])
const EU_CODES = new Set(['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'PT', 'AT', 'CH', 'CZ', 'IE', 'GR', 'HU', 'RO', 'UA'])
const NA_CODES = new Set(['US', 'CA', 'MX'])

export function regionFromCountry(code?: string | null): string {
  const c = (code || '').toUpperCase()
  if (!c) return 'Online'
  if (c === 'IN') return 'India'
  if (ASIA_CODES.has(c)) return 'Asia'
  if (EU_CODES.has(c)) return 'EU'
  if (NA_CODES.has(c)) return 'NA'
  return 'Online'
}

const RAIL_ACCENTS = ['#ff2e6e', '#ffb627', '#1fd7ff', '#a24dff', '#caff3f']
export function accentFor(slug: string): string {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return RAIL_ACCENTS[h % RAIL_ACCENTS.length]
}

// Map real tournaments into the page's card shape using the provider metadata
// (registration deadline, venue, source URL); fields the providers don't expose
// (fee/prize/team/format/spots) stay unknown instead of being invented.
export function mapReal(tournaments: TournamentRecord[], now = Date.now()): TItem[] {
  return tournaments.map((t, i) => {
    const meta = (t.metadata || {}) as Record<string, unknown>
    const gameSlug = t.gameSlug || 'game'
    const game = GAMES.find((g) => g.slug === t.gameSlug)
    const accent = game?.accent || accentFor(gameSlug)
    const provider = String(meta.provider || '').toLowerCase()
    const src = SOURCE_KEYS.find((k) => provider.includes(k) || provider.includes(SRC[k].name.toLowerCase().replace(/[^a-z]/g, ''))) || SOURCE_KEYS[i % 4]
    const live = t.status === 'LIVE_NOW'
    const regCloses = typeof meta.registrationClosesAt === 'string' ? new Date(meta.registrationClosesAt).getTime() : NaN
    const deadline = Number.isFinite(regCloses) ? regCloses : new Date(t.startsAt).getTime()
    const dlH = live ? -6 : Math.max(1, Math.round((deadline - now) / 3600000))
    const city = typeof meta.city === 'string' ? meta.city : ''
    const country = typeof meta.countryCode === 'string' ? meta.countryCode : ''
    return {
      id: t.slug || `r${i}`,
      gameSlug,
      game: (typeof meta.videogame === 'string' && meta.videogame) || game?.name || t.title.split(/[—:-]/)[0].trim(),
      accent,
      title: t.title,
      src,
      status: live ? 'live' : 'open',
      dlH,
      startLabel: new Date(t.startsAt).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
      region: regionFromCountry(country),
      fee: -1,
      team: '',
      fmt: [],
      prize: -1,
      total: 0,
      filled: 0,
      left: 0,
      real: true,
      url: (typeof meta.url === 'string' && meta.url) || (typeof meta.registrationUrl === 'string' && meta.registrationUrl) || null,
      venue: city ? `${city}${country ? `, ${country}` : ''}` : country ? country : '',
    }
  })
}

export interface CardVM {
  id: string
  gameSlug: string
  game: string
  accent: string
  title: string
  sourceName: string
  sourceColor: string
  sourceText: string
  url: string
  status: 'live' | 'open'
  deadlineAt: number
  leftInit: string
  startLabel: string
  region: string
  teamSize: string
  formats: string[]
  prizeLabel: string
  feeLabel: string
  spotsLeft: number
  fillPct: string
  barColor: string
  stLabel: string
  stBg: string
  stFg: string
  stBorder: string
  stDot: boolean
  real: boolean
  venue: string
}

export function enrich(t: TItem, now: number): CardVM {
  const src = SRC[t.src]
  const deadlineAt = now + t.dlH * 3600000
  const ms = deadlineAt - now
  const urgent = t.dlH > 0 && t.dlH < 48
  let stLabel = 'OPEN'
  let stBg = 'var(--card2,#221c3c)'
  let stFg = 'var(--tx2,#aaa3c6)'
  let stBorder = 'var(--line2,#3a3460)'
  let stDot = false
  if (t.status === 'live') { stLabel = 'LIVE'; stBg = '#ff2e6e'; stFg = '#fff'; stBorder = 'var(--bd,#f6f4ff)'; stDot = true }
  else if (urgent) { stLabel = 'CLOSING SOON'; stBg = '#ff2e6e'; stFg = '#fff'; stBorder = 'var(--bd,#f6f4ff)'; stDot = true }
  const low = t.left <= Math.max(4, Math.round(t.total * 0.15))
  return {
    id: t.id,
    gameSlug: t.gameSlug,
    game: t.game,
    accent: t.accent,
    title: t.title,
    sourceName: src.name,
    sourceColor: src.color,
    sourceText: src.text,
    url: t.url || src.url,
    status: t.status,
    deadlineAt,
    leftInit: t.status === 'live' ? 'Live now' : fmtLeft(ms),
    startLabel: t.startLabel,
    region: t.region,
    teamSize: t.team,
    formats: t.fmt,
    prizeLabel: t.prize < 0 ? '' : t.prize === 0 ? 'Casual' : `$${t.prize >= 1000 ? `${t.prize / 1000}K` : t.prize}`,
    feeLabel: t.fee < 0 ? 'Entry: see source' : t.fee === 0 ? 'Free entry' : `$${t.fee} entry`,
    spotsLeft: t.left,
    fillPct: t.total > 0 ? `${Math.round((t.filled / t.total) * 100)}%` : '0%',
    barColor: low ? 'var(--pink)' : 'var(--cyan)',
    stLabel,
    stBg,
    stFg,
    stBorder,
    stDot,
    real: Boolean(t.real),
    venue: t.venue || '',
  }
}
