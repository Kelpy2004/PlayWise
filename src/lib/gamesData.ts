// Data layer for the All Games page (Constellation + Chart + Stacks fusion).
// Normalizes whatever api.fetchLibrary returns into a uniform shape and provides
// grouping/positioning helpers + a representative fallback for offline dev.

export interface LibGame {
  slug: string
  title: string
  year: number | null
  genres: string[]
  stores: string[]
  platforms: string[]
  averageRating: number | null
  popularityScore: number | null
  image: string | null
  banner: string | null
  releaseTimestamp: string | null
  publisher: string | null
}

export interface Game {
  slug: string
  title: string
  score: number // 0–10
  pop: number // 0–100 percentile
  genres: string[]
  platforms: string[]
  year: number
  image: string | null
  cover: string // gradient fallback
  genre: string // primary genre (for colour)
}

export const GRADS = [
  'linear-gradient(135deg,#a24dff,#ff2e6e)', 'linear-gradient(135deg,#1fd7ff,#a24dff)', 'linear-gradient(135deg,#ff2e6e,#ffb627)',
  'linear-gradient(135deg,#caff3f,#1fd7ff)', 'linear-gradient(135deg,#ffb627,#ff2e6e)', 'linear-gradient(135deg,#a24dff,#1fd7ff)',
  'linear-gradient(135deg,#1fd7ff,#caff3f)', 'linear-gradient(135deg,#ff2e6e,#a24dff)',
]

export const GENRE_COLOR: Record<string, string> = {
  RPG: '#a24dff', Action: '#ff2e6e', Shooter: '#1fd7ff', Roguelike: '#caff3f', Simulation: '#ffb627', Sim: '#ffb627',
  Racing: '#1fd7ff', Horror: '#ff2e6e', Metroidvania: '#caff3f', Adventure: '#ffb627', Strategy: '#a24dff', Indie: '#caff3f',
  Puzzle: '#1fd7ff', Sports: '#ffb627', Platformer: '#caff3f', 'Co-op': '#1fd7ff', Sandbox: '#a24dff', Survival: '#ff2e6e',
}
export function genreColor(genre?: string): string {
  if (!genre) return '#a24dff'
  return GENRE_COLOR[genre] || '#a24dff'
}

export const PLAT_COLOR: Record<string, string> = { PC: '#1fd7ff', Xbox: '#caff3f', PlayStation: '#a24dff', PS: '#a24dff', Switch: '#ff2e6e', 'GeForce NOW': '#caff3f' }
export const PLATFORMS = ['PC', 'Steam', 'Epic', 'Xbox', 'PlayStation', 'Switch', 'GeForce NOW']

export function matchesPlatform(g: Game, plat: string, raw?: LibGame): boolean {
  const hay = [...g.platforms, ...(raw?.stores || [])].map((s) => s.toLowerCase())
  const p = plat.toLowerCase()
  if (p === 'pc') return hay.some((h) => h.includes('pc') || h.includes('windows') || h.includes('steam') || h.includes('epic'))
  if (p === 'playstation') return hay.some((h) => h.includes('playstation') || h.includes('ps'))
  return hay.some((h) => h.includes(p))
}

export type Sort = 'rated' | 'popular' | 'az' | 'new'

export function normalize(raw: LibGame[]): Game[] {
  if (!raw.length) return []
  const maxR = Math.max(...raw.map((g) => g.averageRating || 0))
  const scale = maxR <= 5 ? 2 : maxR <= 10 ? 1 : maxR <= 100 ? 0.1 : 1
  // popularity percentile
  const popVals = raw.map((g) => g.popularityScore || 0)
  const sortedPop = [...popVals].sort((a, b) => a - b)
  const pct = (v: number) => {
    if (sortedPop.length < 2) return 50
    const idx = sortedPop.findIndex((x) => x >= v)
    return Math.round(((idx < 0 ? sortedPop.length - 1 : idx) / (sortedPop.length - 1)) * 100)
  }
  return raw.map((g, i) => ({
    slug: g.slug,
    title: g.title,
    score: Math.max(0, Math.min(10, (g.averageRating || 0) * scale)),
    pop: pct(g.popularityScore || 0),
    genres: g.genres?.length ? g.genres : ['Game'],
    platforms: g.platforms?.length ? g.platforms : g.stores || [],
    year: g.year || (g.releaseTimestamp ? new Date(g.releaseTimestamp).getFullYear() : 0),
    image: g.image || g.banner || null,
    cover: GRADS[i % GRADS.length],
    genre: (g.genres && g.genres[0]) || 'Game',
  }))
}

// Deterministic "movement" for the chart (representative — backend has no weekly rank).
export function movement(slug: string): { dir: 'up' | 'down' | 'new' | 'same'; n: number } {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  const r = h % 100
  if (r < 14) return { dir: 'new', n: 0 }
  if (r < 46) return { dir: 'up', n: (h % 6) + 1 }
  if (r < 74) return { dir: 'down', n: ((h >> 3) % 4) + 1 }
  return { dir: 'same', n: 0 }
}

export function sortGames(games: Game[], sort: Sort): Game[] {
  const arr = [...games]
  if (sort === 'rated') arr.sort((a, b) => b.score - a.score || b.pop - a.pop)
  else if (sort === 'popular') arr.sort((a, b) => b.pop - a.pop || b.score - a.score)
  else if (sort === 'az') arr.sort((a, b) => a.title.localeCompare(b.title))
  else arr.sort((a, b) => b.year - a.year || b.score - a.score)
  return arr
}

// Seeded shuffle so the map can show a fresh, class-correct sample each visit.
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export type ChartWindow = 'all' | 'year' | 'month'
export const CHART_WINDOWS: Array<[ChartWindow, string]> = [['all', 'All-time'], ['year', 'This year'], ['month', 'This month']]

function monthNoise(slug: string): number {
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

// "Most played" ranking per window. Backend has no per-window playtime, so year
// favours recent + popular and month adds a stable per-title wobble — distinct,
// sensible orderings rather than random noise.
export function chartRank(games: Game[], w: ChartWindow): Game[] {
  const yr = new Date().getFullYear()
  const score = (g: Game) => {
    if (w === 'all') return g.pop
    if (w === 'year') return g.pop * 0.6 + Math.max(0, 100 - (yr - (g.year || yr)) * 14) * 0.4
    return g.pop * 0.7 + monthNoise(g.slug) * 40
  }
  return [...games].sort((a, b) => score(b) - score(a))
}

export interface Band { stamp: string; label: string; sub: string; accent: string; games: Game[] }

export function buildBands(games: Game[], sort: Sort): Band[] {
  if (sort === 'rated') {
    const defs: Array<[string, string, string, string, (g: Game) => boolean]> = [
      ['S', 'S-Tier', '9.0 and up', 'var(--lime)', (g) => g.score >= 9],
      ['A', 'A-Tier', '8.0 – 8.9', 'var(--cyan)', (g) => g.score >= 8 && g.score < 9],
      ['B', 'B-Tier', '7.0 – 7.9', 'var(--vio)', (g) => g.score >= 7 && g.score < 8],
      ['C', 'C-Tier', 'below 7.0', 'var(--amber)', (g) => g.score < 7],
    ]
    return defs.map(([stamp, label, sub, accent, f]) => ({ stamp, label, sub, accent, games: games.filter(f).sort((a, b) => b.score - a.score) })).filter((b) => b.games.length)
  }
  if (sort === 'popular') {
    const ranked = sortGames(games, 'popular')
    const q = Math.max(1, Math.ceil(ranked.length / 4))
    const defs: Array<[string, string, string, string]> = [
      ['T', 'Trending', 'red-hot right now', 'var(--pink)'],
      ['H', 'Hot', 'lots of buzz', 'var(--amber)'],
      ['R', 'Rising', 'picking up steam', 'var(--cyan)'],
      ['D', 'Deep Cuts', 'cult favourites', 'var(--vio)'],
    ]
    return defs.map((d, i) => ({ stamp: d[0], label: d[1], sub: d[2], accent: d[3], games: ranked.slice(i * q, i * q + q) })).filter((b) => b.games.length)
  }
  if (sort === 'az') {
    const groups = new Map<string, Game[]>()
    sortGames(games, 'az').forEach((g) => {
      const k = (g.title.replace(/^The\s+/i, '')[0] || '#').toUpperCase()
      const key = /[A-Z]/.test(k) ? k : '#'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(g)
    })
    const accents = ['var(--lime)', 'var(--cyan)', 'var(--vio)', 'var(--amber)', 'var(--pink)']
    return [...groups.entries()].map(([k, gs], i) => ({ stamp: k, label: k, sub: `${gs.length} game${gs.length === 1 ? '' : 's'}`, accent: accents[i % accents.length], games: gs }))
  }
  const groups = new Map<number, Game[]>()
  sortGames(games, 'new').forEach((g) => { const y = g.year || 0; if (!groups.has(y)) groups.set(y, []); groups.get(y)!.push(g) })
  const accents = ['var(--lime)', 'var(--cyan)', 'var(--vio)', 'var(--amber)', 'var(--pink)']
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([y, gs], i) => ({ stamp: y ? `'${String(y).slice(2)}` : '—', label: y ? String(y) : 'Undated', sub: `${gs.length} game${gs.length === 1 ? '' : 's'}`, accent: accents[i % accents.length], games: gs }))
}

export interface GenreSection { genre: string; accent: string; stamp: string; games: Game[] }

// Group games by primary genre (similar games together), ordered by size, with
// each genre's games ordered by the active sort.
export function buildGenres(games: Game[], sort: Sort): GenreSection[] {
  const map = new Map<string, Game[]>()
  games.forEach((g) => { const k = g.genre || 'Other'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(g) })
  return [...map.entries()]
    .map(([genre, gs]) => ({ genre, accent: genreColor(genre), stamp: genre.slice(0, 3).toUpperCase(), games: sortGames(gs, sort) }))
    .sort((a, b) => b.games.length - a.games.length)
}

// map positioning
export const mapX = (pop: number) => Math.max(5, Math.min(94, 5 + (pop / 100) * 89))
export const mapY = (score: number) => Math.max(6, Math.min(90, 90 - ((score - 5) / (10 - 5)) * 84))

const FB: Array<[string, number, number, string, string[], number]> = [
  ['Elden Ring', 9.6, 99, 'RPG', ['PC', 'Xbox', 'PlayStation'], 2022],
  ["Baldur's Gate 3", 9.5, 92, 'RPG', ['PC', 'PlayStation'], 2023],
  ['God of War Ragnarök', 9.4, 90, 'Action', ['PlayStation', 'PC'], 2022],
  ['Disco Elysium', 9.2, 55, 'RPG', ['PC', 'PlayStation'], 2019],
  ['Hades II', 9.1, 71, 'Roguelike', ['PC'], 2024],
  ['Outer Wilds', 9.0, 51, 'Adventure', ['PC', 'Xbox'], 2019],
  ['Hollow Knight', 8.9, 64, 'Metroidvania', ['PC', 'Switch'], 2017],
  ['Stardew Valley', 8.9, 80, 'Simulation', ['PC', 'Switch'], 2016],
  ['Forza Horizon 5', 8.8, 86, 'Racing', ['PC', 'Xbox'], 2021],
  ['Cyberpunk 2077', 8.6, 96, 'RPG', ['PC', 'Xbox', 'PlayStation'], 2020],
  ['Hi-Fi Rush', 8.5, 60, 'Action', ['PC', 'Xbox'], 2023],
  ['Alan Wake 2', 8.4, 73, 'Horror', ['PC', 'Xbox', 'PlayStation'], 2023],
  ['Sea of Thieves', 7.9, 74, 'Adventure', ['PC', 'Xbox'], 2018],
  ['Dead Cells', 8.2, 62, 'Roguelike', ['PC', 'Switch'], 2018],
  ['Starfield', 7.7, 84, 'RPG', ['PC', 'Xbox'], 2023],
  ['Halo Infinite', 7.6, 79, 'Shooter', ['PC', 'Xbox'], 2021],
  ['Apex Legends', 7.5, 91, 'Shooter', ['PC', 'Xbox', 'PlayStation'], 2019],
  ['Destiny 2', 7.4, 83, 'Shooter', ['PC', 'Xbox', 'PlayStation'], 2017],
  ['Far Cry 6', 7.2, 78, 'Shooter', ['PC', 'Xbox', 'PlayStation'], 2021],
  ['Anno 1800', 8.1, 48, 'Strategy', ['PC'], 2019],
  ['Cities: Skylines II', 6.8, 57, 'Simulation', ['PC', 'Xbox'], 2023],
  ['Redfall', 6.2, 56, 'Shooter', ['PC', 'Xbox'], 2023],
  ['Suicide Squad', 6.0, 70, 'Action', ['PC', 'Xbox', 'PlayStation'], 2024],
  ['Gollum', 4.8, 40, 'Adventure', ['PC', 'Xbox', 'PlayStation'], 2023],
  ["Marvel's Spider-Man Remastered", 8.7, 88, 'Action', ['PC', 'PlayStation'], 2022],
  ['Ghost of Tsushima', 9.0, 82, 'Action', ['PC', 'PlayStation'], 2020],
  ['Sekiro: Shadows Die Twice', 9.1, 80, 'Action', ['PC', 'Xbox', 'PlayStation'], 2019],
  ['Devil May Cry 5', 8.6, 70, 'Action', ['PC', 'Xbox', 'PlayStation'], 2019],
  ['Returnal', 8.5, 64, 'Action', ['PC', 'PlayStation'], 2021],
  ['It Takes Two', 8.9, 76, 'Action', ['PC', 'Xbox', 'PlayStation'], 2021],
  ['Bayonetta 3', 8.3, 55, 'Action', ['Switch'], 2022],
  ['The Witcher 3: Wild Hunt', 9.3, 95, 'RPG', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2015],
  ['Persona 5 Royal', 9.4, 78, 'RPG', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2019],
  ['Final Fantasy XVI', 8.7, 76, 'RPG', ['PC', 'PlayStation'], 2023],
  ['The Elder Scrolls V: Skyrim', 9.0, 90, 'RPG', ['PC', 'Xbox', 'PlayStation'], 2011],
  ['Mass Effect Legendary Edition', 8.8, 72, 'RPG', ['PC', 'Xbox', 'PlayStation'], 2021],
  ['Diablo IV', 8.0, 85, 'RPG', ['PC', 'Xbox', 'PlayStation'], 2023],
  ['Divinity: Original Sin 2', 9.2, 66, 'RPG', ['PC', 'Xbox', 'Switch'], 2017],
  ["Dragon's Dogma 2", 8.1, 68, 'RPG', ['PC', 'Xbox', 'PlayStation'], 2024],
  ['Doom Eternal', 8.8, 80, 'Shooter', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2020],
  ['Overwatch 2', 6.9, 84, 'Shooter', ['PC', 'Xbox', 'PlayStation'], 2022],
  ['Valorant', 8.0, 90, 'Shooter', ['PC'], 2020],
  ['Counter-Strike 2', 8.3, 94, 'Shooter', ['PC'], 2023],
  ['Titanfall 2', 9.0, 60, 'Shooter', ['PC', 'Xbox', 'PlayStation'], 2016],
  ['Helldivers 2', 8.6, 88, 'Shooter', ['PC', 'PlayStation'], 2024],
  ['Resident Evil 4', 9.3, 82, 'Horror', ['PC', 'Xbox', 'PlayStation'], 2023],
  ['Dead Space', 8.9, 70, 'Horror', ['PC', 'Xbox', 'PlayStation'], 2023],
  ['Phasmophobia', 8.2, 67, 'Horror', ['PC'], 2020],
  ['Amnesia: The Bunker', 7.8, 44, 'Horror', ['PC', 'Xbox', 'PlayStation'], 2023],
  ['Subnautica', 8.8, 73, 'Adventure', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2018],
  ["No Man's Sky", 8.1, 75, 'Adventure', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2016],
  ['Death Stranding', 8.3, 64, 'Adventure', ['PC', 'PlayStation'], 2019],
  ['Slay the Spire', 8.9, 62, 'Roguelike', ['PC', 'Switch'], 2019],
  ['Risk of Rain 2', 8.4, 58, 'Roguelike', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2020],
  ['Vampire Survivors', 8.6, 71, 'Roguelike', ['PC', 'Xbox'], 2022],
  ['The Sims 4', 7.6, 80, 'Simulation', ['PC', 'Xbox', 'PlayStation'], 2014],
  ['Microsoft Flight Simulator', 8.5, 66, 'Simulation', ['PC', 'Xbox'], 2020],
  ['Planet Coaster', 8.0, 49, 'Simulation', ['PC', 'Xbox', 'PlayStation'], 2016],
  ['Gran Turismo 7', 8.2, 72, 'Racing', ['PlayStation'], 2022],
  ['F1 24', 7.4, 58, 'Racing', ['PC', 'Xbox', 'PlayStation'], 2024],
  ['Civilization VI', 8.7, 74, 'Strategy', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2016],
  ['Total War: Warhammer III', 8.4, 63, 'Strategy', ['PC'], 2022],
  ['Age of Empires IV', 8.3, 60, 'Strategy', ['PC', 'Xbox'], 2021],
  ['Ori and the Will of the Wisps', 9.0, 65, 'Metroidvania', ['PC', 'Xbox', 'Switch'], 2020],
  ['Blasphemous', 8.0, 50, 'Metroidvania', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2019],
  ['Celeste', 9.1, 68, 'Platformer', ['PC', 'Xbox', 'PlayStation', 'Switch'], 2018],
  ['Cuphead', 8.8, 72, 'Platformer', ['PC', 'Xbox', 'Switch'], 2017],
]

export function fallbackGames(): Game[] {
  return FB.map(([title, score, pop, genre, platforms, year], i) => ({
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    title, score, pop, genres: [genre], platforms, year, image: null, cover: GRADS[i % GRADS.length], genre,
  }))
}
