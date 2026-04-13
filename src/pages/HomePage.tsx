import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getAllGames } from '../lib/catalog'
import { trackEvent } from '../lib/telemetry'
import type { GameRecord } from '../types/catalog'
import Seo from '../components/Seo'

function selectRandomGames(games: GameRecord[], count: number): GameRecord[] {
  const shuffled = [...games]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function matchesQuery(game: GameRecord, query: string): boolean {
  if (!query) return true
  const haystack = `${game.title} ${game.genre.join(' ')} ${(game.platform || []).join(' ')} ${(game.supportedPlatforms || []).join(' ')} ${(game.catalogBuckets || []).join(' ')} ${game.openSource ? 'free to play free' : ''} ${game.heroTag || ''} ${game.description || ''}`.toLowerCase()
  return haystack.includes(query)
}

function parseReleaseTimestamp(game: GameRecord): number {
  if (game.releaseTimestamp) {
    const parsed = new Date(game.releaseTimestamp).getTime()
    if (!Number.isNaN(parsed)) return parsed
  }
  if (typeof game.year === 'number') {
    return new Date(game.year, 0, 1).getTime()
  }
  return 0
}

function sortByRecent(games: GameRecord[]): GameRecord[] {
  return [...games].sort((left, right) => parseReleaseTimestamp(right) - parseReleaseTimestamp(left))
}

function sortByRating(games: GameRecord[]): GameRecord[] {
  return [...games].sort((left, right) => {
    const rightRating = typeof right.averageRating === 'number' ? right.averageRating : right.valueRating?.score || 0
    const leftRating = typeof left.averageRating === 'number' ? left.averageRating : left.valueRating?.score || 0
    if (rightRating !== leftRating) return rightRating - leftRating
    return (right.externalRatingCount || 0) - (left.externalRatingCount || 0)
  })
}

function sortByPopularity(games: GameRecord[]): GameRecord[] {
  return [...games].sort((left, right) => (right.popularityScore || 0) - (left.popularityScore || 0))
}

function uniqueBySlug(games: GameRecord[]): GameRecord[] {
  const seen = new Set<string>()
  return games.filter((game) => {
    if (seen.has(game.slug)) return false
    seen.add(game.slug)
    return true
  })
}

function scoreLabel(game: GameRecord): string {
  const value = typeof game.averageRating === 'number' ? game.averageRating : game.valueRating?.score
  return typeof value === 'number' ? value.toFixed(1) : 'N/A'
}

function microLabel(game: GameRecord) {
  const primaryGenre = game.genre[0] || 'Game'
  const source = game.catalogSource === 'igdb' ? 'IGDB' : 'PlayWise'
  return `${primaryGenre} • ${source}`
}

function TrendingTile({
  game,
  badgeTone
}: {
  game: GameRecord
  badgeTone: 'primary' | 'secondary'
}) {
  return (
    <article className="group cursor-pointer">
      <Link to={`/games/${game.slug}`} className="block">
        <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-xl bg-[#222] transition-transform duration-500 group-hover:scale-[1.03]">
          <div
            className="h-full w-full bg-cover bg-center grayscale transition-all duration-700 group-hover:grayscale-0"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(10,10,10,0.06), rgba(10,10,10,0.84)), url('${game.image || game.banner || ''}')`
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <span className={`rounded px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${badgeTone === 'primary' ? 'bg-[#b1fa50] text-[#101801]' : 'bg-[#3ba7ff] text-white'}`}>
              {badgeTone === 'primary' ? 'Ultra Pick' : 'Trending'}
            </span>
            <span className="font-display text-lg font-bold text-white">{scoreLabel(game)}</span>
          </div>
        </div>
      </Link>
      <Link to={`/games/${game.slug}`} className="font-display text-xl font-bold text-white">
        {game.title}
      </Link>
      <p className="mt-1 text-sm text-white/48">{microLabel(game)}</p>
    </article>
  )
}

function GenreLaneCard({
  title,
  description,
  accent,
  tiltClass,
  icon,
  onClick
}: {
  title: string
  description: string
  accent: string
  tiltClass: string
  icon: string
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={`w-64 flex-shrink-0 text-left ${tiltClass} group`}>
      <div className="relative h-96 overflow-hidden rounded-2xl border border-white/5 bg-[#1a1a1a] p-6 transition-all duration-300 group-hover:-translate-y-4 group-hover:rotate-0">
        <div className="absolute right-0 top-0 p-4 opacity-10 transition-opacity group-hover:opacity-100" style={{ color: accent }}>
          <span className="material-symbols-outlined text-6xl">{icon}</span>
        </div>
        <div className="relative z-10 flex h-full flex-col justify-end">
          <h5 className="font-display text-2xl font-bold uppercase italic tracking-[-0.05em] text-white">{title}</h5>
          <p className="mb-4 mt-2 text-xs text-white/42">{description}</p>
          <span className="flex w-full items-center justify-center rounded bg-white/5 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-colors group-hover:bg-[#b1fa50] group-hover:text-[#081003]">
            Select Genre
          </span>
        </div>
      </div>
    </button>
  )
}

export default function HomePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [catalogGames, setCatalogGames] = useState<GameRecord[]>(() => getAllGames())
  const [selectedGenreKey, setSelectedGenreKey] = useState<string | null>(null)
  const [compatibilityReadiness, setCompatibilityReadiness] = useState(94)
  const [priceCursorPercent, setPriceCursorPercent] = useState(72)
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState({ tone: 'info', message: '' })
  const search = searchParams.get('q') || ''
  const deferredSearch = useDeferredValue(search)
  const activeSearch = deferredSearch.trim()

  const priceTimeline = useMemo(
    () => [
      { price: 62.99, x: 8, y: 72 },
      { price: 59.99, x: 42, y: 58 },
      { price: 49.99, x: 74, y: 34 },
      { price: 54.99, x: 108, y: 42 },
      { price: 39.99, x: 144, y: 20 },
      { price: 44.99, x: 188, y: 32 }
    ],
    []
  )

  const allGames = useMemo(() => catalogGames, [catalogGames])

  const filteredGames = useMemo(
    () => allGames.filter((game) => matchesQuery(game, activeSearch.toLowerCase())),
    [activeSearch, allGames]
  )

  const newReleaseGames = useMemo(
    () => sortByRecent(allGames.filter((game) => game.catalogBuckets?.includes('new-release'))).slice(0, 4),
    [allGames]
  )

  const popularGames = useMemo(
    () => sortByPopularity(allGames.filter((game) => game.catalogBuckets?.includes('popular'))).slice(0, 4),
    [allGames]
  )

  const topRatedGames = useMemo(
    () => sortByRating(allGames.filter((game) => game.catalogBuckets?.includes('top-rated'))).slice(0, 4),
    [allGames]
  )

  const highlightPool = useMemo(() => {
    const source = uniqueBySlug([...popularGames, ...newReleaseGames, ...topRatedGames, ...allGames])
    return selectRandomGames(source.length ? source : allGames, 4)
  }, [allGames, newReleaseGames, popularGames, topRatedGames])

  const trendingGames = useMemo(() => {
    const source = uniqueBySlug([...popularGames, ...topRatedGames, ...newReleaseGames, ...allGames])
    return source.slice(0, 4)
  }, [allGames, newReleaseGames, popularGames, topRatedGames])

  const [spotlightIndex, setSpotlightIndex] = useState(0)
  const spotlightGame = highlightPool[spotlightIndex] || allGames[0]

  const readinessNormalized = (compatibilityReadiness - 15) / 85
  const compatibilityAverageFps = Math.round(60 + readinessNormalized * 380)
  const compatibilityTemperature = Math.round(95 - readinessNormalized * 55)
  const compatibilityVramState = compatibilityReadiness >= 75 ? 'OK' : compatibilityReadiness >= 45 ? 'MID' : 'LOW'
  const compatibilityConfidence = compatibilityReadiness >= 85 ? 'High confidence fit' : compatibilityReadiness >= 60 ? 'Balanced readiness' : 'Needs tuned settings'
  const compatibilityFillStop = `${Math.max(0, Math.min(100, readinessNormalized * 100 - 2.6))}%`

  const pricePath = useMemo(
    () => priceTimeline.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
    [priceTimeline]
  )
  const areaPath = useMemo(() => `${pricePath} L 188 100 L 8 100 Z`, [pricePath])
  const graphMinX = priceTimeline[0]?.x || 8
  const graphMaxX = priceTimeline[priceTimeline.length - 1]?.x || 188
  const graphRange = Math.max(1, graphMaxX - graphMinX)
  const priceCursorX = graphMinX + (priceCursorPercent / 100) * graphRange
  const activeSegmentIndex = Math.min(
    priceTimeline.length - 2,
    Math.max(
      0,
      priceTimeline.findIndex((point, index) => {
        const next = priceTimeline[index + 1]
        return next ? priceCursorX >= point.x && priceCursorX <= next.x : false
      })
    )
  )
  const leftPricePoint = priceTimeline[activeSegmentIndex] || priceTimeline[0]
  const rightPricePoint = priceTimeline[activeSegmentIndex + 1] || leftPricePoint
  const segmentProgress =
    rightPricePoint.x === leftPricePoint.x ? 0 : (priceCursorX - leftPricePoint.x) / (rightPricePoint.x - leftPricePoint.x)
  const selectedPriceY = leftPricePoint.y + (rightPricePoint.y - leftPricePoint.y) * segmentProgress
  const selectedPriceValue = leftPricePoint.price + (rightPricePoint.price - leftPricePoint.price) * segmentProgress
  const priceDirection =
    rightPricePoint.price > leftPricePoint.price ? 'Price rising' : rightPricePoint.price < leftPricePoint.price ? 'Price dropping' : 'Price stable'
  const priceDirectionTone = rightPricePoint.price < leftPricePoint.price ? '#b1fa50' : rightPricePoint.price > leftPricePoint.price ? '#ff7351' : '#3ba7ff'
  const priceFillStop = `${Math.max(0, Math.min(100, priceCursorPercent - 2.6))}%`

  useEffect(() => {
    let ignore = false

    async function loadCatalogFromApi() {
      try {
        const games = await api.fetchGames()
        if (!ignore && Array.isArray(games) && games.length) {
          setCatalogGames(games)
        }
      } catch {
        if (!ignore) {
          setCatalogGames(getAllGames())
        }
      }
    }

    void loadCatalogFromApi()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (highlightPool.length <= 1) {
      return undefined
    }

    const rotationId = window.setInterval(() => {
      setSpotlightIndex((current) => (current + 1) % highlightPool.length)
    }, 3400)

    return () => window.clearInterval(rotationId)
  }, [highlightPool])

  useEffect(() => {
    if (!activeSearch) return

    void trackEvent(
      {
        category: 'discovery',
        action: 'catalog_search',
        label: activeSearch,
        meta: { results: filteredGames.length }
      },
      token
    )
  }, [activeSearch, filteredGames.length, token])

  function handleGenreSelect(genreKey: string) {
    setSelectedGenreKey(genreKey)
    navigate(`/games?q=${encodeURIComponent(genreKey)}`)
  }

  function handlePriceGraphMove(clientX: number, bounds: DOMRect) {
    const percent = ((clientX - bounds.left) / bounds.width) * 100
    setPriceCursorPercent(Math.max(0, Math.min(100, percent)))
  }

  async function handleNewsletterSubscribe() {
    const trimmed = newsletterEmail.trim()
    if (!trimmed) {
      setNewsletterStatus({ tone: 'warn', message: 'Enter your email to subscribe.' })
      return
    }

    try {
      await api.subscribeNewsletter({ email: trimmed }, token)
      setNewsletterStatus({ tone: 'good', message: 'Newsletter subscription active.' })
      setNewsletterEmail('')
    } catch (error) {
      setNewsletterStatus({ tone: 'bad', message: error instanceof Error ? error.message : 'Could not subscribe right now.' })
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const seoTitle = 'PlayWise | Decide before you download'
  const seoDescription =
    'PlayWise helps you choose what to play with smarter ratings, compatibility checks, price tracking, and tournament alerts.'
  const seoUrl = origin ? `${origin}/` : undefined

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} url={seoUrl} />
      <div className="bg-[#060806] text-white">
      <section className="relative min-h-[90vh] overflow-hidden bg-[#0a0a0a] px-4 pb-24 pt-24 sm:px-6 xl:px-8">
        <div className="absolute inset-0 z-0">
          <div
            className="h-full w-full scale-110 bg-cover bg-center opacity-[0.07] blur-sm mix-blend-screen"
            style={{ backgroundImage: `url('${spotlightGame?.banner || spotlightGame?.image || ''}')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#0e0e0e] via-[#0e0e0e]/95 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(177,250,80,0.08),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(59,167,255,0.05),transparent_40%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0e0e0e] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1600px]">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="max-w-3xl">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#b1fa50]/20 bg-[#b1fa50]/10 px-3 py-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#b1fa50]" />
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#b1fa50]">Nexus Core v4.2 Active</span>
              </div>
              <h1 className="font-display text-6xl font-bold uppercase leading-[0.9] tracking-[-0.06em] text-white md:text-8xl">
                One ecosystem ||
                <br />
                <span className="italic text-[#b1fa50] [text-shadow:0_0_20px_rgba(177,250,80,0.35)]">all players</span>
              </h1>
              <p className="mb-10 mt-6 max-w-xl text-xl leading-relaxed text-white/58 md:text-2xl">
                PlayWise helps players save time by making smarter game decisions with PC compatibility checks, price timing
                signals, community feedback, and a cleaner signal-first game library.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/games')}
                  className="group flex items-center gap-2 rounded-lg bg-[#b1fa50] px-8 py-4 text-lg font-bold text-[#0f1b00] shadow-[0_0_30px_rgba(177,250,80,0.2)] transition-all hover:bg-[#c2ff6b]"
                >
                  Launch Engine
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">bolt</span>
                </button>
                <button
                  type="button"
                  onClick={() => spotlightGame && navigate(`/games/${spotlightGame.slug}`)}
                  className="flex items-center gap-2 rounded-lg border border-white/20 px-8 py-4 text-lg font-bold text-white transition-all hover:bg-white/10"
                >
                  View Demo
                  <span className="material-symbols-outlined">play_circle</span>
                </button>
              </div>
            </div>

            <div className="playwise-prism-scene relative hidden items-center justify-center lg:flex">
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(177,250,80,0.15)_0%,transparent_70%)] blur-[80px]" />
              <div className="playwise-prism relative h-72 w-72">
                <div className="playwise-prism-shell absolute inset-0">
                  <div className="playwise-prism-ring absolute inset-0" />
                  <div className="playwise-prism-ring is-secondary absolute inset-0" />
                  <div className="playwise-prism-core relative flex h-32 w-32 items-center justify-center overflow-hidden border border-[#b1fa50]/50 bg-[#b1fa50]/20 backdrop-blur-3xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#b1fa50]/40 to-transparent" />
                    <span className="material-symbols-outlined text-6xl font-thin text-[#b1fa50]">hive</span>
                    <div className="absolute inset-x-5 top-3 h-px bg-[#b1fa50]/60 blur-[1px]" />
                  </div>
                  <div className="playwise-prism-node playwise-prism-node-blue absolute -right-5 -top-4 flex h-12 w-12 items-center justify-center rounded border border-white/10 bg-[#1a1a1a]">
                    <span className="material-symbols-outlined text-lg text-[#3ba7ff]">analytics</span>
                  </div>
                  <div className="playwise-prism-node playwise-prism-node-orange absolute -bottom-8 -left-8 flex h-16 w-16 items-center justify-center rounded border border-white/10 bg-[#1a1a1a]">
                    <span className="material-symbols-outlined text-2xl text-[#ff7351]">memory</span>
                  </div>
                </div>
                <div className="playwise-prism-status absolute left-1/2 top-0 rounded border border-[#b1fa50]/20 bg-black/40 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-[#b1fa50]">
                  Sync_Status: 100%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-12 right-8 z-20 hidden xl:block">
          <div className="rounded-xl border border-white/5 border-l-4 border-l-[#b1fa50] bg-[#1a1a1a]/80 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[#b1fa50]/20">
                <span className="material-symbols-outlined text-2xl text-[#b1fa50]">analytics</span>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b1fa50]">PlayWise Live Sentiment</div>
                <div className="font-display text-xl font-bold text-white">Overwhelmingly Positive</div>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-[88%] bg-[#b1fa50] shadow-[0_0_10px_#b1fa50]" />
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-24 sm:px-6 xl:px-8" id="precision">
        <div className="mb-16">
          <h2 className="font-display text-4xl font-bold uppercase tracking-[-0.05em] text-white md:text-5xl">
            Engineered for <span className="text-[#b1fa50]">precision</span>
          </h2>
          <div className="mt-4 h-1 w-24 bg-[#b1fa50]" />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <article className="group relative overflow-hidden rounded-xl border border-white/5 bg-[#151515] p-8 md:col-span-7">
            <div className="relative z-10 max-w-sm">
              <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-white">PlayWise Compatibility</h3>
              <p className="mb-8 mt-4 text-white/52">
                Real-time performance metering for your specific hardware stack. Adjust readiness to simulate load.
              </p>
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">System readiness</span>
                    <span className="font-bold text-[#b1fa50]">{compatibilityReadiness}%</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="100"
                    value={compatibilityReadiness}
                    onChange={(event) => setCompatibilityReadiness(Number(event.target.value))}
                    className="playwise-range"
                    style={{ ['--range-fill-stop' as string]: compatibilityFillStop }}
                    aria-label="Adjust system readiness"
                  />
                  <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                    <span>Low load</span>
                    <span>{compatibilityConfidence}</span>
                    <span>Maxed</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border border-white/5 bg-[#222] p-4 text-center">
                    <div className="mb-1 text-xs font-bold uppercase tracking-tight text-[#3ba7ff]">Avg FPS</div>
                    <div className="font-display text-xl font-bold text-white">{compatibilityAverageFps}</div>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#222] p-4 text-center">
                    <div className="mb-1 text-xs font-bold uppercase tracking-tight text-[#ff7351]">Temp</div>
                    <div className="font-display text-xl font-bold text-white">{compatibilityTemperature}°C</div>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-[#222] p-4 text-center">
                    <div className="mb-1 text-xs font-bold uppercase tracking-tight text-white/42">VRAM</div>
                    <div className="font-display text-xl font-bold text-[#3ba7ff]">{compatibilityVramState}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 opacity-5">
              <span className="material-symbols-outlined text-[300px]">memory</span>
            </div>
          </article>

          <article className="flex flex-col justify-between rounded-xl border border-[#b1fa50]/10 bg-[#1a1a1a] p-8 md:col-span-5">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="material-symbols-outlined text-3xl text-[#3ba7ff]">insights</span>
                <div className="rounded border border-[#ff7351]/20 bg-[#ff7351]/10 px-2 py-0.5 text-[10px] font-bold text-[#ff7351]">LIVE DATA</div>
              </div>
              <h3 className="font-display text-2xl font-bold uppercase tracking-[-0.04em] text-white">Game Value Tracking</h3>
              <p className="mb-6 mt-2 text-sm text-white/48">Clean historical analysis of unit cost vs market demand via PlayWise Core.</p>
              <div className="mb-5 flex items-end justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30">Scrub anywhere on the graph</p>
                <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: priceDirectionTone }}>
                  {priceDirection}
                </p>
              </div>
            </div>
            <div
              className="relative mt-auto h-56 w-full cursor-crosshair"
              onMouseMove={(event) => handlePriceGraphMove(event.clientX, event.currentTarget.getBoundingClientRect())}
              onClick={(event) => handlePriceGraphMove(event.clientX, event.currentTarget.getBoundingClientRect())}
            >
              <svg className="h-full w-full" viewBox="0 0 200 100">
                <defs>
                  <linearGradient id="grad-blue-home" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#3ba7ff', stopOpacity: 0.2 }} />
                    <stop offset="100%" style={{ stopColor: '#3ba7ff', stopOpacity: 0 }} />
                  </linearGradient>
                </defs>
                <path d={pricePath} fill="none" stroke="#3ba7ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                <path d={areaPath} fill="url(#grad-blue-home)" opacity="0.3" />
                <line x1={priceCursorX} x2={priceCursorX} y1="10" y2="94" stroke="rgba(255,255,255,0.38)" strokeDasharray="2 3" />
                <circle cx={priceCursorX} cy={selectedPriceY} r="5" fill="#3ba7ff" stroke="#ffffff" strokeWidth="2" />
              </svg>
              <div
                className="pointer-events-none absolute rounded-md border border-white/10 bg-[#111]/95 px-3 py-2 text-[11px] font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
                style={{
                  left: `${Math.min(88, Math.max(8, ((priceCursorX - graphMinX) / graphRange) * 100))}%`,
                  top: `${Math.max(10, selectedPriceY - 4)}%`,
                  transform: 'translate(-50%, -100%)'
                }}
              >
                ${selectedPriceValue.toFixed(2)}
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={priceCursorPercent}
                onChange={(event) => setPriceCursorPercent(Number(event.target.value))}
                className="playwise-range playwise-range-blue"
                style={{ ['--range-fill-stop' as string]: priceFillStop }}
                aria-label="Move through price history"
              />
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                <span>Back catalog window</span>
                <span>Live market window</span>
              </div>
            </div>
          </article>

          <article
            id="tournaments"
            className="relative mx-auto h-80 w-full overflow-hidden rounded-xl border border-white/10 bg-[#1a1a1a] md:col-span-8 md:col-start-3"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40"
              style={{ backgroundImage: `url('${spotlightGame?.banner || spotlightGame?.image || ''}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />
            <div className="relative flex h-full flex-col justify-center p-12">
              <div className="mb-4 flex items-center gap-4">
                <span className="bg-[#b1fa50] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#101801]">Live Event</span>
                <span className="text-xs font-bold text-[#3ba7ff]">PLAYWISE UPLINK ACTIVE</span>
              </div>
              <h3 className="font-display text-5xl font-bold uppercase italic tracking-[-0.05em] text-white">Nexus Pro League</h3>
              <p className="mb-8 mt-4 max-w-md text-sm text-white/56">Join the ultimate cross-platform showdown. Compete for the $250k seasonal vault.</p>
              <div className="flex gap-8">
                <div>
                  <div className="font-display text-2xl font-bold text-[#b1fa50]">$250K</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Prize pool</div>
                </div>
                <div>
                  <div className="font-display text-2xl font-bold text-white">4.8k</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Teams</div>
                </div>
              </div>
              <div className="absolute bottom-12 right-12">
                <button
                  type="button"
                  onClick={() => spotlightGame && navigate(`/games/${spotlightGame.slug}`)}
                  className="flex items-center gap-2 rounded bg-white px-8 py-4 text-xs font-bold uppercase tracking-[0.18em] text-black transition-all hover:bg-[#b1fa50]"
                >
                  Enter Portal
                  <span className="material-symbols-outlined text-sm">rocket</span>
                </button>
              </div>
            </div>
          </article>

          <article className="flex flex-col gap-12 rounded-xl border-l-8 border-l-[#3ba7ff] bg-[#151515] p-8 md:col-span-12 md:flex-row md:items-center">
            <div className="md:w-1/2">
              <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.04em] text-white">Scalable Foundation</h3>
              <p className="mt-4 text-lg text-white/56">
                Our <span className="font-bold text-white">PlayWise Obsidian</span> engine scales with your library. From
                10 games to 10,000, our technical architecture keeps discovery, price tracking, and reactions fast.
              </p>
              <div className="mt-8 flex gap-8">
                <div>
                  <div className="font-display text-4xl font-bold text-[#b1fa50]">0.02ms</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Query latency</div>
                </div>
                <div>
                  <div className="font-display text-4xl font-bold text-[#3ba7ff]">99.9%</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Uptime guarantee</div>
                </div>
              </div>
            </div>
            <div className="grid w-full grid-cols-2 gap-4 md:w-1/2">
              {[
                ['database', 'Distributed Core', '#b1fa50'],
                ['hub', 'Sync Protocol', '#3ba7ff'],
                ['security', 'Encrypted Vault', '#ff7351'],
                ['rocket_launch', 'PlayWise Engine', '#b1fa50']
              ].map(([icon, label, color]) => (
                <div key={label} className="flex flex-col items-center justify-center rounded-lg bg-[#222] p-6 text-center">
                  <span className="material-symbols-outlined mb-2" style={{ color }}>{icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white">{label}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="bg-[#0a0a0a] px-4 py-24 sm:px-6 xl:px-8" id="trending">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-12 flex items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-4xl font-bold uppercase tracking-[-0.05em] text-white">
                Trending <span className="italic text-[#3ba7ff]">Now</span>
              </h2>
              <p className="text-white/48">The most analyzed titles on PlayWise this hour.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/games')}
              className="hidden items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#b1fa50] transition-all hover:gap-4 md:flex"
            >
              View All <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {trendingGames.map((game, index) => (
              <TrendingTile key={game.slug} game={game} badgeTone={index % 2 === 0 ? 'primary' : 'secondary'} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#090b09] px-4 py-16 sm:px-6 xl:px-8" id="newsletter">
        <div className="mx-auto max-w-[980px] rounded-2xl border border-white/10 bg-[#121412] p-8 md:p-10">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#b1fa50]">Newsletter Uplink</p>
          <h3 className="font-display text-3xl font-bold uppercase tracking-[-0.04em] text-white">Get weekly PlayWise updates</h3>
          <p className="mt-3 text-sm text-white/60">
            Subscribe for top value picks, tournament reminders, and major price-drop opportunities.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              className="flex-1 rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none"
              placeholder="you@example.com"
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
            />
            <button
              type="button"
              onClick={() => void handleNewsletterSubscribe()}
              className="rounded-lg bg-[#b1fa50] px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-[#0a1400]"
            >
              Subscribe
            </button>
          </div>
          {newsletterStatus.message ? (
            <div
              className={`mt-4 rounded-lg px-3 py-2 text-xs ${
                newsletterStatus.tone === 'good'
                  ? 'bg-[#b1fa50]/15 text-[#b1fa50]'
                  : newsletterStatus.tone === 'bad'
                    ? 'bg-red-500/15 text-red-300'
                    : 'bg-[#ffce72]/15 text-[#ffce72]'
              }`}
            >
              {newsletterStatus.message}
            </div>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden bg-[#0e0e0e] px-4 py-28 sm:px-6 xl:px-8" id="discover">
        <div className="mx-auto mb-16 max-w-[1600px] text-center">
          <h2 className="font-display text-5xl font-bold uppercase tracking-[-0.05em] text-white">
            Discover the <span className="italic text-[#b1fa50]">multiverse</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/48">
            Explore genres using the PlayWise multi-dimensional selector. Seamlessly pivot through playstyles.
          </p>
        </div>
        <div className="mx-auto flex max-w-[1600px] gap-8 overflow-x-auto pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:justify-center">
          <GenreLaneCard
            title="RPG"
            description="Depth, Choice, Progression"
            accent="#b1fa50"
            tiltClass={selectedGenreKey === 'rpg' ? 'rotate-0' : '-rotate-2'}
            icon="swords"
            onClick={() => handleGenreSelect('rpg')}
          />
          <GenreLaneCard
            title="Shooter"
            description="Precision, Speed, Reflex"
            accent="#3ba7ff"
            tiltClass={selectedGenreKey === 'shooter' ? 'rotate-0' : 'rotate-1'}
            icon="target"
            onClick={() => handleGenreSelect('shooter')}
          />
          <GenreLaneCard
            title="Racing"
            description="Momentum, Drift, Control"
            accent="#b1fa50"
            tiltClass={selectedGenreKey === 'racing' ? 'rotate-0' : '-rotate-1'}
            icon="speed"
            onClick={() => handleGenreSelect('racing')}
          />
          <GenreLaneCard
            title="Strategy"
            description="Logic, Planning, Dominance"
            accent="#ff7351"
            tiltClass={selectedGenreKey === 'strategy' ? 'rotate-0' : 'rotate-2'}
            icon="neurology"
            onClick={() => handleGenreSelect('strategy')}
          />
        </div>
      </section>

      </div>
    </>
  )
}
