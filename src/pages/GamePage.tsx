import { useEffect, useMemo, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useWishlist } from '../hooks/useWishlist'
import { api } from '../lib/api'
import { getGameBySlug, getRelatedGames } from '../lib/catalog'
import { trackEvent } from '../lib/telemetry'
import Seo from '../components/Seo'
import type {
  CommentRecord,
  CompatibilityResult,
  HardwareCatalog,
  HardwareSearchSuggestion,
  PriceHistoryPoint,
  PriceSnapshot,
  PriceTimingInsight,
  ReactionKind,
  ReactionSummary,
  RecommendationPreview,
  TournamentRecord
} from '../types/api'
import type { GameRecord } from '../types/catalog'

function reactionButtonClass(active: boolean): string {
  return [
    'inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.16em] transition-all font-["Inter"] backdrop-blur-md cursor-pointer',
    active
      ? 'bg-[#b1fa50]/10 text-[#b1fa50] shadow-[0_0_30px_rgba(177,250,80,0.15)] border border-[#b1fa50]/20'
      : 'bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white border border-white/15'
  ].join(' ')
}

function nextReaction(current: ReactionKind | null | undefined, target: ReactionKind): ReactionKind | null {
  return current === target ? null : target
}

function buildHardwarePayload(
  hardwareForm: { laptop: string; cpu: string; gpu: string; ram: string },
  inputMode: 'laptop' | 'manual'
): Record<string, unknown> | undefined {
  if (inputMode === 'laptop') {
    return hardwareForm.laptop.trim() ? { laptop: hardwareForm.laptop.trim() } : undefined
  }

  const cpu = hardwareForm.cpu.trim()
  const gpu = hardwareForm.gpu.trim()
  const ram = Number.parseInt(String(hardwareForm.ram || '').trim(), 10)

  if (!cpu || !gpu) {
    return undefined
  }

  return {
    cpu,
    gpu,
    ...(Number.isFinite(ram) && ram > 0 ? { ram } : {})
  }
}

function formatDate(value?: string | null): string {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

function formatCurrencyValue(amount?: number | null, currency?: string | null): string {
  if (amount == null || Number.isNaN(amount)) return 'Unknown'

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2
    }).format(amount)
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`
  }
}

function timingBadgeClass(decision?: PriceTimingInsight['decision']): string {
  switch (decision) {
    case 'BUY_NOW':
      return 'border border-[#b1fa50]/15 bg-[#b1fa50]/10 text-[#b1fa50] shadow-[0_0_30px_rgba(177,250,80,0.15)]'
    case 'WAIT_FOR_DROP':
      return 'border border-[#ffce72]/15 bg-[#ffce72]/10 text-[#ffce72] shadow-[0_0_30px_rgba(255,206,114,0.15)]'
    case 'FAIR_PRICE':
      return 'border border-[#51a0ff]/15 bg-[#51a0ff]/10 text-[#51a0ff] shadow-[0_0_30px_rgba(81,160,255,0.15)]'
    default:
      return 'border border-white/15 bg-white/[0.04] text-white/72'
  }
}

function timingDecisionLabel(decision?: PriceTimingInsight['decision']): string {
  return String(decision || 'WATCH_CLOSELY').replaceAll('_', ' ')
}

function formatTimelineLabel(value?: string | null): string {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit'
  })
}

function buildTimelineTicks(points: Array<PriceHistoryPoint & { x: number }>) {
  const rawTicks: Array<{ key: string; label: string; x: number; timestamp: string }> = []
  const seen = new Set<string>()

  points.forEach((point) => {
    const parsed = new Date(point.timestamp)
    if (Number.isNaN(parsed.getTime())) return
    const key = `${parsed.getFullYear()}-${parsed.getMonth()}`
    if (seen.has(key)) return
    seen.add(key)
    rawTicks.push({
      key,
      label: formatTimelineLabel(point.timestamp),
      x: point.x,
      timestamp: point.timestamp
    })
  })

  if (!rawTicks.length) return []

  const selected = rawTicks.length <= 5
    ? rawTicks
    : Array.from({ length: 5 }, (_, index) => {
        const target = Math.round((index * (rawTicks.length - 1)) / 4)
        return rawTicks[target]
      })

  return selected.filter((tick, index, array) => index === 0 || tick.key !== array[index - 1].key)
}

function PriceHistoryChart({ points }: { points: PriceHistoryPoint[] }) {
  if (!points.length) return null

  const [activeIndex, setActiveIndex] = useState(points.length - 1)
  const width = 560
  const height = 248
  const padding = 18
  const axisLabelSpace = 26
  const chartBottom = height - padding - axisLabelSpace
  const { chartPoints, linePath, areaPath, latest } = useMemo(() => {
    const amounts = points.map((point) => point.amount)
    const min = Math.min(...amounts)
    const max = Math.max(...amounts)
    const range = Math.max(max - min, 1)

    const nextChartPoints = points.map((point, index) => {
      const x = padding + ((width - (padding * 2)) * index) / Math.max(points.length - 1, 1)
      const y = chartBottom - (((point.amount - min) / range) * (chartBottom - padding))
      return { ...point, x, y }
    })

    const nextLinePath = nextChartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ')

    return {
      chartPoints: nextChartPoints,
      linePath: nextLinePath,
      areaPath: `${nextLinePath} L ${nextChartPoints[nextChartPoints.length - 1].x.toFixed(2)} ${chartBottom.toFixed(2)} L ${nextChartPoints[0].x.toFixed(2)} ${chartBottom.toFixed(2)} Z`,
      latest: nextChartPoints[nextChartPoints.length - 1],
      lowest: nextChartPoints.reduce((best, current) => (current.amount < best.amount ? current : best), nextChartPoints[0])
    }
  }, [chartBottom, padding, points, width])

  const activePoint = chartPoints[activeIndex] || latest

  useEffect(() => {
    setActiveIndex(points.length - 1)
  }, [points.length])

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width) return

    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width
    let nearestIndex = 0
    let smallestDistance = Number.POSITIVE_INFINITY

    chartPoints.forEach((point, index) => {
      const distance = Math.abs(point.x - relativeX)
      if (distance < smallestDistance) {
        smallestDistance = distance
        nearestIndex = index
      }
    })

    if (nearestIndex !== activeIndex) {
      setActiveIndex(nearestIndex)
    }
  }

  return (
    <div className="flex-1 relative w-full h-full min-h-[200px]">
      <div className="flex justify-between items-center mb-2">
        <div className="text-left">
           <span className="text-[10px] text-gray-500 uppercase tracking-tighter block">Hovered Checkpoint</span>
           <span className="text-white font-bold">{formatCurrencyValue(activePoint.amount, activePoint.currency)}</span>
        </div>
        <div className="text-right">
           <span className="text-[10px] text-gray-500 uppercase tracking-tighter block">{formatDate(activePoint.timestamp)}</span>
           <span className="text-primary font-bold">{activePoint.store || 'Tracked store'}</span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
        role="img"
        aria-label="Game price history chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setActiveIndex(chartPoints.length - 1)}
      >
        <defs>
          <linearGradient id="grad2" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#b1fa50", stopOpacity: 1 }}></stop>
            <stop offset="100%" style={{ stopColor: "#b1fa50", stopOpacity: 0 }}></stop>
          </linearGradient>
        </defs>
        <path d={areaPath} className="opacity-10" fill="url(#grad2)" />
        <path d={linePath} fill="none" stroke="#b1fa50" strokeWidth="3" />
        {chartPoints.map((point, index) => (
          <circle
            key={`${point.timestamp}-${index}`}
            cx={point.x}
            cy={point.y}
            r={point === activePoint ? 6 : 0}
            fill="#b1fa50"
            className="transition-all duration-200"
          />
        ))}
      </svg>
    </div>
  )
}

function PriceSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse" aria-hidden="true">
      <div className="h-16 bg-white/5 rounded-xl border border-white/5 w-full"></div>
      <div className="h-16 bg-white/5 rounded-xl border border-white/5 w-full"></div>
      <div className="h-16 bg-white/5 rounded-xl border border-white/5 w-full"></div>
    </div>
  )
}

export default function GamePage() {
  const { slug } = useParams()
  const { user, token } = useAuth()
  const localGame = getGameBySlug(slug)
  const [game, setGame] = useState<GameRecord | null>(localGame)
  const [gameLoading, setGameLoading] = useState(!localGame && Boolean(slug))
  const relatedGames = useMemo(() => (localGame ? getRelatedGames(localGame) : []), [localGame])

  const [catalog, setCatalog] = useState<HardwareCatalog>({ cpus: [], gpus: [], laptops: [], ramOptions: [8, 12, 16, 32] })
  const [inputMode, setInputMode] = useState<'laptop' | 'manual'>('laptop')
  const [hardwareForm, setHardwareForm] = useState({ laptop: '', cpu: '', gpu: '', ram: '16' })
  const [hardwareSuggestions, setHardwareSuggestions] = useState<{
    laptop: HardwareSearchSuggestion[]
    cpu: HardwareSearchSuggestion[]
    gpu: HardwareSearchSuggestion[]
  }>({ laptop: [], cpu: [], gpu: [] })
  
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null)
  const [compatibilityStatus, setCompatibilityStatus] = useState({ loading: false, message: '' })
  
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentForm, setCommentForm] = useState({ username: '', message: '' })
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentStatus, setCommentStatus] = useState({ tone: 'info', message: '' })
  
  const [gameReactionSummary, setGameReactionSummary] = useState<ReactionSummary>({
    gameSlug: slug,
    likeCount: 0,
    dislikeCount: 0,
    userReaction: null
  })
  
  const [recommendation, setRecommendation] = useState<RecommendationPreview | null>(null)
  const [recommendationStatus, setRecommendationStatus] = useState({ loading: false, tone: 'info', message: '' })
  const [reactionStatus, setReactionStatus] = useState({ tone: 'info', message: '' })
  const [reactionBusyKey, setReactionBusyKey] = useState<string | null>(null)
  
  const [prices, setPrices] = useState<PriceSnapshot | null>(null)
  const [pricesStatus, setPricesStatus] = useState({ loading: false, message: '' })
  const [activeSection, setActiveSection] = useState('overview')
  const [priceAlerts, setPriceAlerts] = useState<Array<{ id: string; targetPrice?: number | null; isActive: boolean }>>([])
  const [priceAlertFeedback, setPriceAlertFeedback] = useState({ tone: 'info', message: '' })
  const [tournamentSubscriptions, setTournamentSubscriptions] = useState<Array<{ id: string; scope: 'ALL' | 'GAME'; gameSlug?: string | null; isActive: boolean }>>([])
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([])
  const [tournamentsLoading, setTournamentsLoading] = useState(false)
  const [tournamentPopupOpen, setTournamentPopupOpen] = useState(false)
  const [tournamentFeedback, setTournamentFeedback] = useState({ tone: 'info', message: '' })

  useEffect(() => {
    setGame(localGame)
    setGameLoading(!localGame && Boolean(slug))
  }, [localGame, slug])

  useEffect(() => {
    if (!slug) return undefined
    let ignore = false
    const activeSlug = slug

    async function loadGameDetails() {
      setGameLoading(true)
      try {
        const response = await api.fetchGameDetails(activeSlug)
        if (!ignore) {
          setGame(response)
          setGameLoading(false)
        }
      } catch {
        if (!ignore && !localGame) setGame(null)
        if (!ignore) setGameLoading(false)
      }
    }
    void loadGameDetails()
    return () => { ignore = true }
  }, [localGame, slug])

  useEffect(() => {
    if (!game?.slug) return
    void trackEvent({ category: 'games', action: 'game_viewed', label: game.slug }, token)
  }, [game?.slug, token])

  useEffect(() => {
    let ignore = false
    async function loadHardwareCatalog() {
      try {
        const hardware = await api.getHardwareCatalog()
        if (ignore) return
        setCatalog(hardware)
        setHardwareForm((current) => ({
          ...current,
          ram: current.ram || String(hardware.ramOptions?.[2] || 16)
        }))
      } catch {
        if (!ignore) setCompatibilityStatus({ loading: false, message: 'Hardware catalog could not be loaded right now.' })
      }
    }
    loadHardwareCatalog()
    return () => { ignore = true }
  }, [slug])

  useEffect(() => {
    if (!game) return undefined
    let ignore = false
    const activeGame = game

    async function loadComments() {
      setCommentsLoading(true)
      try {
        const response = await api.fetchComments(activeGame.slug, token)
        if (!ignore) setComments(Array.isArray(response) ? response : [])
      } catch (error) {
        if (!ignore) setCommentStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not load comments.' })
      } finally {
        if (!ignore) setCommentsLoading(false)
      }
    }
    loadComments()
    return () => { ignore = true }
  }, [game, token])

  useEffect(() => {
    setRecommendation(null)
    setRecommendationStatus({ loading: false, tone: 'info', message: '' })
  }, [game?.slug, inputMode, hardwareForm.laptop, hardwareForm.cpu, hardwareForm.gpu, hardwareForm.ram, prices?.bestDeal?.currentPrice])

  useEffect(() => {
    const sections = ['overview', 'compatibility', 'price-tech', 'community']
    function handleScroll() {
      let current = 'overview'
      sections.forEach((sectionId) => {
        const element = document.getElementById(sectionId)
        if (!element) return
        const bounds = element.getBoundingClientRect()
        if (bounds.top <= 180) current = sectionId
      })
      setActiveSection(current)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => { window.removeEventListener('scroll', handleScroll) }
  }, [game?.slug])

  useEffect(() => {
    if (!game) return undefined
    let ignore = false
    const activeGame = game
    async function loadGameReactions() {
      try {
        const response = await api.fetchGameReactions(activeGame.slug, token)
        if (!ignore) setGameReactionSummary(response)
      } catch (error) {
        if (!ignore) setReactionStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not load reactions.' })
      }
    }
    loadGameReactions()
    return () => { ignore = true }
  }, [game, token])

  useEffect(() => {
    if (!game || game.downloadUrl) return undefined
    let ignore = false
    const activeGame = game
    async function loadPrices() {
      setPricesStatus({ loading: true, message: '' })
      try {
        const response = await api.fetchPrices(activeGame.slug)
        if (!ignore) setPrices(response)
      } catch (error) {
        if (!ignore) setPricesStatus({ loading: false, message: error instanceof Error ? error.message : 'Price data is not available right now.' })
      } finally {
        if (!ignore) setPricesStatus((current) => ({ ...current, loading: false }))
      }
    }
    loadPrices()
    return () => { ignore = true }
  }, [game])

  useEffect(() => {
    if (!game) {
      setTournaments([])
      return
    }

    let ignore = false
    async function loadTournaments() {
      setTournamentsLoading(true)
      try {
        const response = await api.fetchTournaments({
          game: game.title,
          limit: 80
        })
        if (!ignore) {
          setTournaments(Array.isArray(response) ? response : [])
        }
      } catch {
        if (!ignore) setTournaments([])
      } finally {
        if (!ignore) setTournamentsLoading(false)
      }
    }

    void loadTournaments()
    return () => {
      ignore = true
    }
  }, [game])

  useEffect(() => {
    if (!token || !game) {
      setPriceAlerts([])
      setTournamentSubscriptions([])
      return
    }

    let ignore = false
    async function loadNotificationSubscriptions() {
      try {
        const [alerts, subscriptions] = await Promise.all([
          api.fetchPriceAlerts(token),
          api.fetchTournamentSubscriptions(token)
        ])

        if (ignore) return
        setPriceAlerts((alerts || []).map((entry) => ({ id: entry.id, targetPrice: entry.targetPrice, isActive: entry.isActive })))
        setTournamentSubscriptions((subscriptions || []).map((entry) => ({
          id: entry.id,
          scope: entry.scope,
          gameSlug: entry.gameSlug || null,
          isActive: entry.isActive
        })))
      } catch {
        if (!ignore) {
          setPriceAlertFeedback({ tone: 'warning', message: 'Could not load your subscriptions right now.' })
        }
      }
    }

    void loadNotificationSubscriptions()
    return () => { ignore = true }
  }, [token, game])

  useEffect(() => {
    if (!game || !token) {
      setTournamentPopupOpen(false)
      return
    }

    const localKey = `playwise:tournament-popup-dismissed:${game.slug}`
    const alreadyDismissed = typeof window !== 'undefined' && window.localStorage.getItem(localKey) === '1'
    const alreadySubscribed = tournamentSubscriptions.some(
      (entry) => entry.isActive && (entry.scope === 'ALL' || entry.gameSlug === game.slug)
    )

    setTournamentPopupOpen(!alreadyDismissed && !alreadySubscribed)
  }, [game, token, tournamentSubscriptions])

  useEffect(() => {
    if (inputMode !== 'laptop') {
      setHardwareSuggestions((current) => ({ ...current, laptop: [] }))
      return undefined
    }

    const query = hardwareForm.laptop.trim()
    if (query.length < 2) {
      setHardwareSuggestions((current) => ({ ...current, laptop: [] }))
      return undefined
    }
    let ignore = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.searchHardware('laptop', query)
        if (!ignore) setHardwareSuggestions((current) => ({ ...current, laptop: response }))
      } catch {
        if (!ignore) setHardwareSuggestions((current) => ({ ...current, laptop: [] }))
      }
    }, 220)
    return () => { ignore = true; window.clearTimeout(timeoutId) }
  }, [hardwareForm.laptop, inputMode])

  useEffect(() => {
    if (inputMode !== 'manual') {
      setHardwareSuggestions((current) => ({ ...current, cpu: [], gpu: [] }))
      return undefined
    }

    const query = hardwareForm.cpu.trim()
    if (query.length < 2) {
      setHardwareSuggestions((current) => ({ ...current, cpu: [] }))
      return undefined
    }
    let ignore = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.searchHardware('cpu', query)
        if (!ignore) setHardwareSuggestions((current) => ({ ...current, cpu: response }))
      } catch {
        if (!ignore) setHardwareSuggestions((current) => ({ ...current, cpu: [] }))
      }
    }, 220)
    return () => { ignore = true; window.clearTimeout(timeoutId) }
  }, [hardwareForm.cpu, inputMode])

  useEffect(() => {
    if (inputMode !== 'manual') {
      setHardwareSuggestions((current) => ({ ...current, gpu: [] }))
      return undefined
    }

    const query = hardwareForm.gpu.trim()
    if (query.length < 2) {
      setHardwareSuggestions((current) => ({ ...current, gpu: [] }))
      return undefined
    }
    let ignore = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.searchHardware('gpu', query)
        if (!ignore) setHardwareSuggestions((current) => ({ ...current, gpu: response }))
      } catch {
        if (!ignore) setHardwareSuggestions((current) => ({ ...current, gpu: [] }))
      }
    }, 220)
    return () => { ignore = true; window.clearTimeout(timeoutId) }
  }, [hardwareForm.gpu, inputMode])

  const {
    busySlug: wishlistBusySlug,
    favoriteSlugSet,
    status: wishlistStatus,
    toggleWishlist
  } = useWishlist(game ? [game] : [])

  if (!game) {
    if (gameLoading) {
      return (
        <div className="bg-[#0e0e0e] min-h-screen text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-headline font-bold text-white mb-3">Loading game profile…</h1>
            <p className="text-gray-500 font-body">PlayWise is pulling the latest details for this title.</p>
          </div>
        </div>
      )
    }
    return (
      <div className="bg-[#0e0e0e] min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-headline font-bold text-white mb-6">This game was not found in the PlayWise catalog.</h1>
          <Link to="/" className="bg-primary text-[#0e0e0e] px-8 py-3 rounded-full font-bold font-headline hover:scale-105 transition-all">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  const currentGame = game as GameRecord
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const seoTitle = currentGame?.title ? `${currentGame.title} | PlayWise` : 'Game Details | PlayWise'
  const seoDescription =
    currentGame?.description ||
    (currentGame?.heroTag ? `${currentGame.heroTag} with compatibility checks, pricing, and tournament alerts.` : '') ||
    'Compare price history, compatibility, and recommendations for this game on PlayWise.'
  const seoImage = currentGame?.image || currentGame?.banner || null
  const seoUrl = origin && currentGame?.slug ? `${origin}/games/${currentGame.slug}` : undefined
  const seoJsonLd = currentGame
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: currentGame.title,
        description: seoDescription,
        image: seoImage || undefined,
        genre: (currentGame.genre || currentGame.genres || []).filter(Boolean),
        operatingSystem: (currentGame.supportedPlatforms || currentGame.platform || []).filter(Boolean),
        aggregateRating:
          typeof currentGame.averageRating === 'number'
            ? {
                '@type': 'AggregateRating',
                ratingValue: currentGame.averageRating,
                ratingCount: currentGame.externalRatingCount || 1
              }
            : undefined
      }
    : undefined
  const currentHeroTag = currentGame.heroTag || currentGame.description || 'Live game profile loaded into PlayWise.'
  const currentValueScore = currentGame.valueRating?.score ?? currentGame.averageRating ?? null
  const currentValueAdvice = currentGame.valueRating?.advice || (currentGame.catalogSource === 'igdb' ? 'PlayWise is using the live critical signal from IGDB for this title.' : 'Value guidance has not been mapped yet for this title.')
  const currentStabilityLabel = currentGame.bugStatus?.label || (currentGame.catalogSource === 'igdb' ? 'External catalog profile' : 'Not rated yet')
  const currentStabilityNote = currentGame.bugStatus?.note || (currentGame.catalogSource === 'igdb' ? 'This profile is coming from the live IGDB catalog, so deeper PlayWise-specific technical notes may still be pending.' : 'A deeper stability note has not been added yet.')
  const isWishlisted = favoriteSlugSet.has(currentGame.slug)
  const heroImage = currentGame.banner || currentGame.image || ''
  const platformLabels = (currentGame.supportedPlatforms?.length ? currentGame.supportedPlatforms : currentGame.platform || []).slice(0, 4)
  const headlineParts = currentGame.title.trim().split(/\s+/)
  const headlineAccent = headlineParts.length > 1 ? headlineParts.pop() || '' : ''
  const headlineBase = headlineParts.join(' ')
  const quickLinks = [
    ...(currentGame.storeLinks || []),
    ...(currentGame.trailer ? [{ label: currentGame.trailer.title || 'Watch trailer', url: currentGame.trailer.url }] : []),
    ...(currentGame.officialSite ? [{ label: 'Official site', url: currentGame.officialSite }] : [])
  ].filter((entry, index, collection) => collection.findIndex((item) => item.url === entry.url) === index)
  const visibleTournaments = tournaments
    .sort((left, right) => {
      const leftTime = new Date(left.startsAt).getTime()
      const rightTime = new Date(right.startsAt).getTime()
      return leftTime - rightTime
    })
    .slice(0, 4)
  const priceDecisionLabel = recommendation?.decision.replaceAll('_', ' ') || prices?.timing?.decision?.replaceAll('_', ' ') || 'WATCH CLOSELY'
  
  const decisionMetrics = [
    { label: 'Value rating', value: currentValueScore ? `${Number(currentValueScore).toFixed(1)}/10` : 'N/A', note: currentValueAdvice, accent: '#b1fa50' },
    { label: 'Stability', value: currentStabilityLabel, note: currentStabilityNote, accent: '#51a0ff' },
    { label: 'Capabilities', value: currentGame.playerTypes?.bestFor?.join(', ') || 'Single Player', note: currentGame.playerTypes?.notIdealFor?.join(', ') || 'Built for focused sessions', accent: '#00edba' },
    { label: 'Genre', value: currentGame.genre.slice(0, 2).join(', ') || 'Game', note: currentHeroTag, accent: '#a4ec43' },
    { label: 'Time commitment', value: currentGame.timeCommitment?.mainStory || 'Main Story', note: currentGame.timeCommitment?.mainPlusSide || currentGame.timeCommitment?.completionist || 'Longer sessions depend on playstyle', accent: '#b1fa50' }
  ]
  const sideInsightTitle = currentGame.optimizationGuide?.[0]?.tier ? `${currentGame.optimizationGuide[0].tier} setup tweaks` : 'Performance Tweaks'
  const sideInsightNote = currentGame.optimizationGuide?.[0]?.note || currentStabilityNote

  async function handleCompatibilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCompatibilityStatus({ loading: true, message: '' })

    const hardware = buildHardwarePayload(hardwareForm, inputMode)

    if (!hardware) {
      setCompatibility(null)
      setCompatibilityStatus({
        loading: false,
        message:
          inputMode === 'laptop'
            ? 'Enter a laptop model before running the check.'
            : 'Enter CPU and GPU for manual specs before running the check.'
      })
      return
    }

    try {
      const response = await api.checkCompatibility(currentGame, hardware)
      setCompatibility(response)
      setCompatibilityStatus({ loading: false, message: '' })
      void trackEvent({ category: 'compatibility', action: 'compatibility_check', label: currentGame.slug, meta: { inputMode, source: response.source, preset: response.recommendedPreset } }, token)
    } catch (error) {
      setCompatibility(null)
      setCompatibilityStatus({ loading: false, message: error instanceof Error ? error.message : 'Compatibility check failed.' })
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCommentStatus({ tone: 'info', message: '' })
    const message = commentForm.message.trim()
    const username = user?.username || commentForm.username.trim()

    if (!message) return setCommentStatus({ tone: 'warning', message: 'Write a comment before posting.' })
    if (!username) return setCommentStatus({ tone: 'warning', message: 'Add your name before posting.' })

    setCommentBusy(true)

    try {
      await api.postComment(currentGame.slug, { username, message }, token)
      const refreshedComments = await api.fetchComments(currentGame.slug, token)
      setComments(Array.isArray(refreshedComments) ? refreshedComments : [])
      setCommentForm((current) => ({ ...current, message: '', username: user ? current.username : username }))
      setCommentStatus({ tone: 'success', message: 'Comment posted successfully.' })
      void trackEvent({ category: 'engagement', action: 'comment_posted', label: currentGame.slug }, token)
    } catch (error) {
      setCommentStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not post comment.' })
    } finally {
      setCommentBusy(false)
    }
  }

  async function handleGenerateRecommendation() {
    setRecommendationStatus({ loading: true, tone: 'info', message: '' })
    try {
        const response = await api.previewRecommendation({ gameSlug: currentGame.slug, hardware: buildHardwarePayload(hardwareForm, inputMode), priceSnapshot: prices }, token)
      setRecommendation(response)
      setRecommendationStatus({ loading: false, tone: 'success', message: 'AI recommendation updated.' })
      void trackEvent({ category: 'recommendation', action: 'recommendation_preview_generated', label: currentGame.slug, meta: { decision: response.decision, confidence: response.confidence } }, token)
    } catch (error) {
      setRecommendation(null)
      setRecommendationStatus({ loading: false, tone: 'error', message: error instanceof Error ? error.message : 'Could not generate a recommendation.' })
    }
  }

  async function handleGameReaction(target: ReactionKind) {
    if (!game) return
    if (!token) return setReactionStatus({ tone: 'warning', message: 'Log in to like or dislike games.' })

    const reaction = nextReaction(gameReactionSummary.userReaction || null, target)
    setReactionBusyKey('game')

    try {
      const response = await api.reactToGame(game.slug, reaction, token)
      setGameReactionSummary(response)
      setReactionStatus({ tone: 'success', message: 'Your game reaction was saved.' })
      void trackEvent({ category: 'engagement', action: 'game_reaction_changed', label: game.slug, meta: { reaction: reaction || 'CLEARED' } }, token)
    } catch (error) {
      setReactionStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not save your game reaction.' })
    } finally {
      setReactionBusyKey(null)
    }
  }

  async function handleCommentReaction(commentId: string | undefined, target: ReactionKind) {
    if (!commentId) return
    if (!token) return setReactionStatus({ tone: 'warning', message: 'Log in to like or dislike comments.' })

    const existing = comments.find((comment) => comment.id === commentId)
    const reaction = nextReaction(existing?.userReaction || null, target)
    setReactionBusyKey(commentId)

    try {
      const response = await api.reactToComment(commentId, reaction, token)
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId
            ? { ...comment, likeCount: response.likeCount, dislikeCount: response.dislikeCount, userReaction: response.userReaction || null }
            : comment
        )
      )
      setReactionStatus({ tone: 'success', message: 'Your comment reaction was saved.' })
      void trackEvent({ category: 'engagement', action: 'comment_reaction_changed', label: commentId, meta: { reaction: reaction || 'CLEARED', gameSlug: currentGame.slug } }, token)
    } catch (error) {
      setReactionStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not save your comment reaction.' })
    } finally {
      setReactionBusyKey(null)
    }
  }

  async function handleCreatePriceAlert() {
    if (!token || !game) {
      setPriceAlertFeedback({ tone: 'warning', message: 'Log in first to create price alerts.' })
      return
    }

    try {
      const created = await api.createPriceAlert(
        {
          gameSlug: game.slug,
          isActive: true
        },
        token
      )
      setPriceAlerts((current) => [{ id: created.id, targetPrice: created.targetPrice, isActive: created.isActive }, ...current])
      setPriceAlertFeedback({ tone: 'success', message: 'Price-drop alerts enabled. We will email you when price goes down.' })
    } catch (error) {
      setPriceAlertFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Could not create price alert.' })
    }
  }

  async function handleDeletePriceAlert(id: string) {
    if (!token) return
    try {
      await api.deletePriceAlert(id, token)
      setPriceAlerts((current) => current.filter((entry) => entry.id !== id))
      setPriceAlertFeedback({ tone: 'success', message: 'Price alert removed.' })
    } catch (error) {
      setPriceAlertFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Could not remove price alert.' })
    }
  }

  async function handleSubscribeTournament(scope: 'ALL' | 'GAME') {
    if (!token || !game) {
      setTournamentFeedback({ tone: 'warning', message: 'Log in first to subscribe for tournament alerts.' })
      return
    }

    try {
      const created = await api.createTournamentSubscription(
        {
          scope,
          gameSlug: scope === 'GAME' ? game.slug : null,
          isActive: true
        },
        token
      )
      setTournamentSubscriptions((current) => [
        { id: created.id, scope: created.scope, gameSlug: created.gameSlug || null, isActive: created.isActive },
        ...current
      ])
      setTournamentPopupOpen(false)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`playwise:tournament-popup-dismissed:${game.slug}`, '1')
      }
      setTournamentFeedback({ tone: 'success', message: 'Tournament alerts are enabled.' })
    } catch (error) {
      setTournamentFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Could not subscribe for tournament alerts.' })
    }
  }

  function handleDismissTournamentPopup() {
    if (game && typeof window !== 'undefined') {
      window.localStorage.setItem(`playwise:tournament-popup-dismissed:${game.slug}`, '1')
    }
    setTournamentPopupOpen(false)
  }

  const alertStyles = {
    info: 'bg-[#51a0ff]/10 border border-[#51a0ff]/20 text-[#51a0ff]',
    success: 'bg-[#b1fa50]/10 border border-[#b1fa50]/20 text-[#b1fa50]',
    warning: 'bg-[#ffce72]/10 border border-[#ffce72]/20 text-[#ffce72]',
    error: 'bg-red-500/10 border border-red-500/20 text-red-400',
    danger: 'bg-red-500/10 border border-red-500/20 text-red-400',
  }

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        image={seoImage}
        url={seoUrl}
        type="article"
        jsonLd={seoJsonLd}
      />
      <div className="bg-[#0e0e0e] text-white font-body overflow-x-hidden relative min-h-screen">
      <style>{`
        html { scroll-behavior: smooth; }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        @keyframes zoom-slow { 0% { transform: scale(1); } 100% { transform: scale(1.1); } }
        .animate-zoom-slow { animation: zoom-slow 10s linear infinite alternate; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {tournamentPopupOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#111] p-6 shadow-2xl">
            <button
              type="button"
              onClick={handleDismissTournamentPopup}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 hover:text-white"
              aria-label="Close tournament alert popup"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#b1fa50]">Tournament Alerts</p>
            <h4 className="mb-2 text-2xl font-black text-white">Stay updated for live events</h4>
            <p className="mb-5 text-sm text-white/70">
              Get email notifications when tournaments for <strong>{currentGame.title}</strong> are about to start or go live.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSubscribeTournament('GAME')}
                className="rounded-lg bg-[#b1fa50] px-4 py-2 text-sm font-black text-[#081003]"
              >
                Set alert for this game
              </button>
              <button
                type="button"
                onClick={() => void handleSubscribeTournament('ALL')}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white"
              >
                Alert for all tournaments
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Neon Background Blurs */}
      <div className="fixed rounded-full blur-[120px] -z-10 opacity-15 pointer-events-none w-[600px] h-[600px] bg-primary -top-[10%] -left-[10%]"></div>
      <div className="fixed rounded-full blur-[120px] -z-10 opacity-15 pointer-events-none w-[800px] h-[800px] bg-tertiary-container bottom-[10%] -right-[10%]"></div>
      <div className="fixed rounded-full blur-[120px] -z-10 opacity-15 pointer-events-none w-[500px] h-[500px] bg-[#6366f1] top-[40%] left-[30%]"></div>

      {/* Right Side Navigation (Sticky) */}
      <aside className="hidden xl:flex h-screen w-64 fixed right-0 top-0 bg-[#131313]/90 backdrop-blur-md flex-col py-6 z-40 border-l border-white/5 pt-24">
        <div className="px-6 mb-8 text-right">
          <h2 className="text-primary font-black uppercase tracking-widest text-xs">Game Detail</h2>
          <p className="text-gray-500 text-[10px]">PlayWise Analysis</p>
        </div>
        <div className="flex flex-col gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: 'dashboard' },
            { id: 'compatibility', label: 'Compatibility', icon: 'memory' },
            { id: 'price-tech', label: 'Price & Buying', icon: 'payments' },
            { id: 'community', label: 'Community', icon: 'forum' }
          ].map((item) => (
            <a 
              key={item.id}
              href={`#${item.id}`}
              className={`flex items-center justify-end gap-4 px-6 py-3 transition-all duration-300 font-headline ${activeSection === item.id ? 'text-primary border-r-4 border-primary bg-primary/10' : 'text-gray-500 hover:text-gray-200'}`}
            >
              {item.label} <span className="material-symbols-outlined">{item.icon}</span>
            </a>
          ))}
        </div>
        <div className="mt-auto px-6 space-y-3">
          {wishlistStatus.message && <div className={`text-[10px] text-center px-2 py-1 rounded ${alertStyles[wishlistStatus.tone as keyof typeof alertStyles]}`}>{wishlistStatus.message}</div>}
          <button 
            onClick={() => void toggleWishlist(currentGame)}
            disabled={wishlistBusySlug === currentGame.slug}
            className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${isWishlisted ? 'bg-primary text-[#0e0e0e]' : 'bg-surface-container-highest text-white hover:bg-primary hover:text-[#0e0e0e]'}`}
          >
            {wishlistBusySlug === currentGame.slug ? 'Saving...' : isWishlisted ? 'In Wishlist' : 'Add to Wishlist'}
          </button>
        </div>
      </aside>

      <main className="xl:mr-64 pt-20 pb-32" id="overview">
        {/* Cinematic Hero Section */}
        <section className="relative h-[800px] w-full overflow-hidden">
          <div className="absolute inset-0 z-0">
            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: heroImage ? `url('${heroImage}')` : 'none' }}></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0e0e0e]/50 to-[#0e0e0e]"></div>
          </div>
          <div className="relative z-10 h-full flex flex-col justify-end px-8 pb-12 md:px-16">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-primary text-[#1b3000] px-3 py-1 rounded text-xs font-bold font-label uppercase tracking-widest">{currentGame.bugStatus?.label || currentGame.demandLevel || 'Featured'}</span>
              {currentGame.year && <span className="text-white/60 font-label text-sm">Release: {currentGame.year}</span>}
              <div className="flex items-center gap-1 ml-4 bg-black/40 backdrop-blur-md rounded-full px-3 py-1 border border-white/10">
                <button onClick={() => void handleGameReaction('LIKE')} disabled={reactionBusyKey === 'game'} className={`transition-colors flex items-center gap-1 text-xs ${gameReactionSummary.userReaction === 'LIKE' ? 'text-primary' : 'hover:text-primary'}`}>
                  <span className="material-symbols-outlined text-sm">thumb_up</span> {gameReactionSummary.likeCount || 0}
                </button>
                <div className="w-px h-3 bg-white/20 mx-1"></div>
                <button onClick={() => void handleGameReaction('DISLIKE')} disabled={reactionBusyKey === 'game'} className={`transition-colors flex items-center gap-1 text-xs ${gameReactionSummary.userReaction === 'DISLIKE' ? 'text-red-400' : 'hover:text-red-400'}`}>
                  <span className="material-symbols-outlined text-sm">thumb_down</span> {gameReactionSummary.dislikeCount || 0}
                </button>
              </div>
            </div>
            
            {platformLabels.length > 0 && (
               <div className="mb-2">
                 <span className="text-primary text-xs font-bold font-label uppercase tracking-widest">Available on: {platformLabels.join(', ')}</span>
               </div>
            )}
            
            <h1 className="text-6xl md:text-8xl font-headline font-bold text-white mb-4 tracking-tighter max-w-4xl">
              {headlineBase} {headlineAccent && <span className="text-primary">{headlineAccent}</span>}
            </h1>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {currentGame.genre.map((g: string) => (
                <span key={g} className="px-3 py-1 bg-white/10 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-gray-300">{g}</span>
              ))}
            </div>
            
            <p className="text-gray-300 text-lg md:text-xl max-w-2xl mb-8 leading-relaxed">
              {currentGame.description}
            </p>
            
            {reactionStatus.message && (
               <div className={`text-xs px-3 py-2 w-fit rounded-lg ${alertStyles[reactionStatus.tone as keyof typeof alertStyles]}`}>
                 {reactionStatus.message}
               </div>
            )}
          </div>
        </section>

        {/* Main Content Layout */}
        <div className="px-8 md:px-16 mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
          
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-16">
            
            {/* Decision Intelligence Dashboard */}
            <section id="performance">
              <h3 className="text-2xl font-headline font-bold mb-6 flex items-center gap-3">
                <span className="w-2 h-8 bg-primary rounded-full"></span>
                Decision Intelligence
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {decisionMetrics.map((item, index) => (
                   <div key={index} className="bg-[#131313]/80 backdrop-blur-sm p-6 rounded-xl border-l-4 border-t border-b border-r border-white/5" style={{ borderLeftColor: item.accent }}>
                     <p className="text-gray-500 text-[10px] font-label font-bold uppercase tracking-widest mb-2" style={{ color: item.accent }}>{item.label}</p>
                     <h4 className="text-xl font-headline font-bold text-white mb-2 leading-tight">{item.value}</h4>
                     <p className="text-xs text-gray-500 font-body leading-relaxed">{item.note}</p>
                   </div>
                ))}
              </div>
            </section>

            {/* Compatibility Checker */}
            <section className="bg-[#262626]/80 backdrop-blur-md p-8 rounded-2xl relative overflow-hidden border border-white/5 shadow-2xl isolate" id="compatibility">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-[120px]">memory</span>
              </div>
              <h3 className="text-2xl font-headline font-bold mb-4">Hardware Compatibility</h3>
              <p className="text-gray-400 mb-8 max-w-md">Check how this game should run on your hardware. We analyze thousands of real-world benchmarks to predict your performance.</p>
              
              <form onSubmit={handleCompatibilitySubmit} className="relative z-20 pointer-events-auto">
                <div className="mb-5 inline-flex rounded-xl border border-white/10 bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setInputMode('laptop')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
                      inputMode === 'laptop' ? 'bg-primary text-[#0e0e0e]' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Laptop
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
                      inputMode === 'manual' ? 'bg-primary text-[#0e0e0e]' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Manual Specs
                  </button>
                </div>

                <div className="flex flex-col gap-4 items-start">
                  {inputMode === 'laptop' ? (
                    <div className="flex-1 w-full space-y-2">
                      <label className="text-[10px] font-label font-bold text-secondary uppercase tracking-widest px-1">Search Your Model</label>
                      <div className="relative w-full">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">search</span>
                        <input 
                            className="w-full bg-[#000000] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:ring-2 focus:ring-secondary transition-all outline-none text-sm" 
                            placeholder="Example: HP Victus i5 12450H RTX 3050 16GB" 
                            list="playwise-laptop-suggestions"
                            value={hardwareForm.laptop}
                            onChange={(e) => setHardwareForm(c => ({ ...c, laptop: e.target.value }))}
                        />
                        <datalist id="playwise-laptop-suggestions">
                            {hardwareSuggestions.laptop.map((item) => (
                              <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>{item.label}</option>
                            ))}
                            {catalog.laptops.slice(0, 120).map((item) => (
                              <option key={`catalog-laptop-${item.id || item.model}`} value={item.model}>
                                {item.brand} {item.model}
                              </option>
                            ))}
                        </datalist>
                      </div>
                      {hardwareSuggestions.laptop[0]?.meta && <div className="text-xs text-primary font-body mt-1">Best match: {hardwareSuggestions.laptop[0].meta}</div>}
                    </div>
                  ) : (
                    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-label font-bold text-secondary uppercase tracking-widest px-1">CPU</label>
                        <input
                          className="w-full bg-[#000000] border border-white/10 rounded-xl py-3.5 px-4 text-white focus:ring-2 focus:ring-secondary transition-all outline-none text-sm"
                          placeholder="Example: Intel Core i5-12450H"
                          list="playwise-cpu-suggestions"
                          value={hardwareForm.cpu}
                          onChange={(e) => setHardwareForm((c) => ({ ...c, cpu: e.target.value }))}
                        />
                        <datalist id="playwise-cpu-suggestions">
                          {hardwareSuggestions.cpu.map((item) => (
                            <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>{item.label}</option>
                          ))}
                          {catalog.cpus.slice(0, 120).map((item) => (
                            <option key={`catalog-cpu-${item.id || item.name}`} value={item.name} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-label font-bold text-secondary uppercase tracking-widest px-1">GPU</label>
                        <input
                          className="w-full bg-[#000000] border border-white/10 rounded-xl py-3.5 px-4 text-white focus:ring-2 focus:ring-secondary transition-all outline-none text-sm"
                          placeholder="Example: NVIDIA RTX 3050"
                          list="playwise-gpu-suggestions"
                          value={hardwareForm.gpu}
                          onChange={(e) => setHardwareForm((c) => ({ ...c, gpu: e.target.value }))}
                        />
                        <datalist id="playwise-gpu-suggestions">
                          {hardwareSuggestions.gpu.map((item) => (
                            <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>{item.label}</option>
                          ))}
                          {catalog.gpus.slice(0, 120).map((item) => (
                            <option key={`catalog-gpu-${item.id || item.name}`} value={item.name} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-label font-bold text-secondary uppercase tracking-widest px-1">RAM (GB)</label>
                        <input
                          className="w-full bg-[#000000] border border-white/10 rounded-xl py-3.5 px-4 text-white focus:ring-2 focus:ring-secondary transition-all outline-none text-sm"
                          type="number"
                          min={4}
                          step={2}
                          list="playwise-ram-options"
                          value={hardwareForm.ram}
                          onChange={(e) => setHardwareForm((c) => ({ ...c, ram: e.target.value }))}
                        />
                        <datalist id="playwise-ram-options">
                          {catalog.ramOptions.map((ram) => (
                            <option key={`ram-${ram}`} value={ram} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={compatibilityStatus.loading} className="bg-primary text-[#0e0e0e] px-8 py-4 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all w-full md:w-auto shrink-0">
                    {compatibilityStatus.loading ? 'Checking...' : 'Run Check'}
                  </button>
                </div>
              </form>

              {compatibilityStatus.message && <div className={`mt-4 px-4 py-3 rounded-xl ${alertStyles.error}`}>{compatibilityStatus.message}</div>}

              {compatibility && (
                 <div className="mt-8 border-t border-white/5 pt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1a1a1a] rounded-xl p-6">
                       <strong className="block mb-1 text-primary">Can it run?</strong>
                       <p className="mb-1 text-white">{compatibility.canRun}</p>
                       <small className="text-gray-500 text-xs">Source: {compatibility.source}</small>
                    </div>
                    <div className="bg-[#1a1a1a] rounded-xl p-6">
                       <strong className="block mb-1 text-secondary">Recommended preset</strong>
                       <p className="mb-1 text-white">{compatibility.recommendedPreset}</p>
                       <small className="text-gray-500 text-xs">{compatibility.warning || 'Optimized for 60fps'}</small>
                    </div>
                    {compatibility.fps && (
                       <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-4">
                          <div className="bg-[#1a1a1a] rounded-xl p-4 text-center"><strong className="block text-gray-400 text-xs uppercase">Low</strong><p className="text-lg font-bold text-white mb-0">{compatibility.fps.low}</p></div>
                          <div className="bg-[#1a1a1a] rounded-xl p-4 text-center"><strong className="block text-primary text-xs uppercase">Medium</strong><p className="text-lg font-bold text-white mb-0">{compatibility.fps.medium}</p></div>
                          <div className="bg-[#1a1a1a] rounded-xl p-4 text-center"><strong className="block text-tertiary text-xs uppercase">High</strong><p className="text-lg font-bold text-white mb-0">{compatibility.fps.high}</p></div>
                       </div>
                    )}
                 </div>
              )}
            </section>

            {/* Price Analysis Hub */}
            <section className="space-y-6" id="price-tech">
              <h3 className="text-2xl font-headline font-bold flex items-center gap-3">
                <span className="w-2 h-8 bg-secondary rounded-full"></span>
                {currentGame.downloadUrl ? 'Official free sources' : 'Price & Buying Analysis'}
              </h3>
              
              {currentGame.downloadUrl ? (
                 <div className="bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 text-center py-12">
                   <span className="material-symbols-outlined text-4xl text-primary mb-4">download</span>
                   <p className="text-gray-400 mb-6 max-w-md mx-auto">This title is free/open-source, so PlayWise links directly to official downloads instead of live store pricing.</p>
                   <a href={currentGame.downloadUrl} target="_blank" rel="noreferrer" className="inline-block bg-primary text-[#0e0e0e] px-8 py-3 rounded-full font-bold font-headline hover:scale-105 transition-all">Download Now</a>
                 </div>
              ) : pricesStatus.loading ? (
                 <PriceSkeleton />
              ) : prices ? (
                 <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                   <div className="md:col-span-4 bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 h-full flex flex-col">
                     <h4 className="text-sm font-headline font-bold text-gray-500 uppercase mb-6 tracking-widest">Live Stores</h4>
                     <div className="space-y-3 flex-1">
                       {(prices.stores || []).map((store) => (
                         <a key={store.store} href={store.url || '#'} target="_blank" rel="noreferrer" className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded-xl border border-white/5 hover:border-primary/30 transition-all group">
                           <div className="flex items-center gap-3">
                             <span className="material-symbols-outlined text-gray-500 group-hover:text-primary transition-colors">storefront</span>
                             <span className="font-label text-sm text-white">{store.store}</span>
                           </div>
                           <div className="text-right flex flex-col">
                             <span className="text-white font-bold text-sm">{store.currentPrice || 'View'}</span>
                             {store.cut ? <span className="text-[10px] text-primary">{store.cut}% off</span> : null}
                           </div>
                         </a>
                       ))}
                       {(!prices.stores || prices.stores.length === 0) && <p className="text-sm text-gray-500">No active store links found.</p>}
                     </div>
                   </div>

                   <div className="md:col-span-4 bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 flex flex-col h-full min-h-[250px]">
                     <div className="flex justify-between items-center mb-4">
                       <h4 className="text-sm font-headline font-bold text-gray-500 uppercase tracking-widest">Price History</h4>
                       <div className="text-right">
                         <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Low</p>
                         <p className="text-primary font-bold">{prices.historicalLow?.price || 'N/A'}</p>
                       </div>
                     </div>
                     {prices.history?.available && prices.history.points.length > 1 ? (
                        <PriceHistoryChart points={prices.history.points} />
                     ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                           <span className="material-symbols-outlined text-gray-600 text-3xl mb-2">monitoring</span>
                           <p className="text-xs text-gray-500">Not enough tracked price changes yet to draw a meaningful pattern graph.</p>
                        </div>
                     )}
                   </div>

                   <div className="md:col-span-4 bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 flex flex-col h-full">
                     <div className="flex items-center justify-between mb-4">
                       <h4 className="text-xs font-headline font-bold text-gray-500 uppercase tracking-widest">Timing Signal</h4>
                       <span className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">AI</span>
                     </div>
                     <div className={`p-3 rounded-xl flex items-center justify-between shadow-lg mb-4 ${timingBadgeClass(prices.timing?.decision)}`}>
                       <div>
                         <p className="text-[9px] font-bold uppercase opacity-80">Signal</p>
                         <h5 className="font-black text-lg leading-tight">{timingDecisionLabel(prices.timing?.decision)}</h5>
                       </div>
                       <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart_checkout</span>
                     </div>
                     <div className="space-y-3 pt-3 border-t border-white/5 flex-1">
                       <div className="grid grid-cols-2 gap-2">
                         <div className="bg-white/5 p-2 rounded-lg text-center">
                           <p className="text-[8px] text-gray-500 uppercase">Confidence</p>
                           <p className="text-primary font-black text-sm">{Math.round((prices.timing?.confidence || 0) * 100)}%</p>
                         </div>
                         <div className="bg-white/5 p-2 rounded-lg text-center">
                           <p className="text-[8px] text-gray-500 uppercase">Drop Prob.</p>
                           <p className="text-white font-black text-sm">{Math.round((prices.timing?.dropProbability || 0) * 100)}%</p>
                         </div>
                       </div>
                       <p className="text-[10px] text-gray-400 leading-tight">{prices.timing?.summary || 'PlayWise uses price history to decide if now is the right time to buy.'}</p>
                     </div>
                     <button onClick={() => void handleGenerateRecommendation()} disabled={recommendationStatus.loading} className="mt-4 w-full text-xs font-bold text-white bg-white/5 hover:bg-white/10 py-2 rounded-lg transition-colors border border-white/10">
                        {recommendationStatus.loading ? 'Updating...' : 'Refresh AI Signal'}
                     </button>
                   </div>
                 </div>
              ) : (
                 <div className="text-gray-500 text-sm">Price data is not available right now.</div>
              )}
            </section>

            {/* Community Section */}
            <section id="community">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h3 className="text-3xl font-headline font-bold">What Players Are Saying</h3>
                  <p className="text-gray-500 text-sm mt-1">Join the conversation and leave a live comment.</p>
                </div>
                <span className="text-primary text-sm font-label font-bold">Live Feed</span>
              </div>
              
              <div className="space-y-8">
                {commentStatus.message && <div className={`px-4 py-3 rounded-xl text-sm ${alertStyles[commentStatus.tone as keyof typeof alertStyles]}`}>{commentStatus.message}</div>}
                
                <form className="flex gap-4" onSubmit={handleCommentSubmit}>
                  <div className="w-12 h-12 rounded-full border-2 border-primary/30 overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/5 font-bold text-primary">
                    {(user?.username || commentForm.username || 'G').slice(0, 1)}
                  </div>
                  <div className="flex-1 bg-[#131313]/80 backdrop-blur-sm rounded-2xl p-4 border border-white/5 shadow-inner">
                    {!user && (
                       <input 
                         type="text" 
                         placeholder="Your Name" 
                         className="w-full bg-transparent border-b border-white/10 focus:border-primary focus:ring-0 text-white mb-3 pb-2 px-0 text-sm outline-none transition-colors"
                         value={commentForm.username}
                         onChange={e => setCommentForm(c => ({...c, username: e.target.value}))}
                         required
                       />
                    )}
                    <textarea 
                      className="w-full bg-transparent border-none focus:ring-0 text-white resize-none h-16 placeholder:text-gray-600 outline-none text-sm" 
                      placeholder={user ? `Share your experience as ${user.username}...` : "Share your experience with this game..."}
                      value={commentForm.message}
                      onChange={e => setCommentForm(c => ({...c, message: e.target.value}))}
                      required
                    ></textarea>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                      <div className="flex gap-2">
                        <button type="button" className="p-2 text-gray-500 hover:text-white transition-colors"><span className="material-symbols-outlined text-sm">image</span></button>
                        <button type="button" className="p-2 text-gray-500 hover:text-white transition-colors"><span className="material-symbols-outlined text-sm">sentiment_satisfied</span></button>
                      </div>
                      <button type="submit" disabled={commentBusy} className="bg-primary text-[#0e0e0e] font-black text-xs px-6 py-2 rounded-lg uppercase tracking-widest hover:scale-105 transition-transform disabled:opacity-50">
                        {commentBusy ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="space-y-6">
                  {commentsLoading ? <p className="text-gray-500 text-sm">Loading comments...</p> : null}
                  {!commentsLoading && comments.length === 0 ? <p className="text-gray-500 text-sm">No comments yet. Be the first to leave one.</p> : null}
                  
                  {comments.map((comment) => (
                    <div key={comment.id || `${comment.username}-${comment.createdAt}`} className="flex gap-4 group">
                      <div className="w-12 h-12 rounded-full bg-[#262626] flex items-center justify-center font-bold text-secondary text-lg border border-white/10 flex-shrink-0">
                        {comment.username.slice(0, 1)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-white text-sm">{comment.username}</span>
                          <span className="text-[10px] text-gray-500 uppercase">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-3">{comment.message}</p>
                        <div className="flex items-center gap-4">
                          <button onClick={() => void handleCommentReaction(comment.id, 'LIKE')} disabled={reactionBusyKey === comment.id} className={`flex items-center gap-1.5 text-xs transition-colors ${comment.userReaction === 'LIKE' ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}>
                            <span className="material-symbols-outlined text-sm">thumb_up</span> {comment.likeCount || 0}
                          </button>
                          <button onClick={() => void handleCommentReaction(comment.id, 'DISLIKE')} disabled={reactionBusyKey === comment.id} className={`flex items-center gap-1.5 text-xs transition-colors ${comment.userReaction === 'DISLIKE' ? 'text-red-400' : 'text-gray-500 hover:text-red-400'}`}>
                            <span className="material-symbols-outlined text-sm">thumb_down</span> {comment.dislikeCount || 0}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>

          {/* Right Column Sticky */}
          <aside className="lg:col-span-4 space-y-8 h-fit lg:sticky lg:top-24">
            
            {/* Box 1: Latest News / Patch Notes */}
            <div className="bg-[#1a1a1a]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-white/5 shadow-xl">
              <img alt="Update insight" className="w-full h-32 object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-500 cursor-pointer" src={heroImage || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80"}/>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Patch V1.0.4</span>
                  <span className="text-gray-600 text-[10px]">• 2 hours ago</span>
                </div>
                <h4 className="text-white font-bold mb-2 text-base">{sideInsightTitle}</h4>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">{sideInsightNote}</p>
                <button className="text-primary text-[10px] font-bold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all cursor-pointer">
                  Read Patch Notes <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Box 2: Similar Games */}
            <div className="bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl">
              <h4 className="text-xs font-headline font-bold text-gray-500 uppercase tracking-widest mb-6">Similar Games</h4>
              <div className="space-y-4">
                {relatedGames.slice(0, 4).map((relatedGame) => (
                  <Link key={relatedGame.slug} to={`/games/${relatedGame.slug}`} className="flex items-center gap-4 group p-2 rounded-xl hover:bg-white/5 transition-all">
                    <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                      {relatedGame.image ? (
                        <img src={relatedGame.image} alt={relatedGame.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      ) : (
                        <span className="material-symbols-outlined text-gray-500">videogame_asset</span>
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-white group-hover:text-primary transition-colors truncate">{relatedGame.title}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-tight truncate">{relatedGame.genre[0] || 'Game'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl space-y-4">
              <h4 className="text-xs font-headline font-bold text-gray-500 uppercase tracking-widest">Price Alerts</h4>
              <p className="text-xs text-gray-400">Enable this and we email you whenever the game price drops.</p>
              <button
                type="button"
                onClick={() => void handleCreatePriceAlert()}
                className="w-full rounded-lg bg-[#b1fa50] px-3 py-2 text-xs font-black text-[#091100]"
              >
                Enable price-drop alerts
              </button>
              {priceAlertFeedback.message ? (
                <div className={`text-xs px-2.5 py-2 rounded ${alertStyles[priceAlertFeedback.tone as keyof typeof alertStyles] || alertStyles.info}`}>
                  {priceAlertFeedback.message}
                </div>
              ) : null}
              <div className="space-y-2">
                {priceAlerts.filter((entry) => entry.isActive).slice(0, 4).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <div className="text-xs text-white/80">
                      Price drop alert is active
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeletePriceAlert(entry.id)}
                      className="text-[11px] font-bold text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {!priceAlerts.filter((entry) => entry.isActive).length ? <p className="text-xs text-gray-500">No active alerts yet.</p> : null}
              </div>
            </div>

            <div className="bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl space-y-3">
              <h4 className="text-xs font-headline font-bold text-gray-500 uppercase tracking-widest">Tournament Notifications</h4>
              <p className="text-xs text-gray-400">Subscribe for starting-soon and live-now tournament emails.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSubscribeTournament('GAME')}
                  className="flex-1 rounded-lg bg-[#b1fa50] px-3 py-2 text-xs font-black text-[#091100]"
                >
                  This Game
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubscribeTournament('ALL')}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white"
                >
                  All Events
                </button>
              </div>
              {tournamentFeedback.message ? (
                <div className={`text-xs px-2.5 py-2 rounded ${alertStyles[tournamentFeedback.tone as keyof typeof alertStyles] || alertStyles.info}`}>
                  {tournamentFeedback.message}
                </div>
              ) : null}
              <div className="mt-3 border-t border-white/10 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Events for this game</p>
                  <Link to={`/tournaments?game=${currentGame.slug}`} className="text-[11px] font-bold text-[#b1fa50] hover:text-[#c8ff7b]">
                    View all events
                  </Link>
                </div>
                {tournamentsLoading ? <p className="text-xs text-white/50">Loading events...</p> : null}
                {!tournamentsLoading && !visibleTournaments.length ? (
                  <p className="text-xs text-white/50">No tournaments found for this game yet.</p>
                ) : null}
                {visibleTournaments.map((entry) => (
                  <div key={entry.id || entry.slug} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <p className="text-xs font-bold text-white">{entry.title}</p>
                    <p className="text-[11px] text-white/60">
                      {entry.status.replaceAll('_', ' ')} • {formatDate(entry.startsAt)}
                    </p>
                    {typeof entry.metadata?.registrationUrl === 'string' && entry.metadata.registrationUrl ? (
                      <a
                        href={entry.metadata.registrationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex rounded-md bg-[#b1fa50] px-2.5 py-1 text-[10px] font-black text-[#081003]"
                      >
                        Register now
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* Box 3: Quick Links */}
            <div className="bg-[#131313]/80 backdrop-blur-sm p-6 rounded-2xl border border-white/5 shadow-xl">
              <h4 className="text-xs font-headline font-bold text-gray-500 uppercase tracking-widest mb-4">Quick Links</h4>
              <div className="space-y-2">
                {quickLinks.length ? quickLinks.slice(0, 4).map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5 group">
                    <span className="truncate mr-4">{link.label}</span>
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                  </a>
                )) : <p className="text-xs text-gray-500">More links coming soon.</p>}
              </div>
            </div>
            
          </aside>

        </div>
      </main>
      
      {/* AAA Publisher Style Footer */}
      <footer className="px-8 md:px-16 py-16 border-t border-white/5 bg-[#050505] mt-12 xl:mr-64 relative z-10">
        <div className="max-w-7xl mx-auto">
          
          {/* Social Header */}
          <div className="flex flex-col items-center justify-center mb-16 pb-12 border-b border-white/5">
            <h3 className="text-white font-headline font-bold text-xl md:text-2xl mb-6 uppercase tracking-widest text-center">
              Follow {currentGame.title} On Social
            </h3>
            <div className="flex gap-4">
              <a href="#" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-primary hover:text-[#0a0a0a] hover:scale-110 transition-all border border-white/10">
                <span className="material-symbols-outlined">share</span>
              </a>
              <a href="#" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-[#51a0ff] hover:text-[#0a0a0a] hover:scale-110 transition-all border border-white/10">
                <span className="material-symbols-outlined">forum</span>
              </a>
              <a href="#" className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-[#ff7351] hover:text-[#0a0a0a] hover:scale-110 transition-all border border-white/10">
                <span className="material-symbols-outlined">smart_display</span>
              </a>
            </div>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12 mb-16">
            <div>
              <h4 className="text-white font-headline font-bold mb-4 uppercase tracking-widest text-xs border-l-2 border-primary pl-3">PlayWise</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Store</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">PlayWise Connect</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">About us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">News</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Support</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Contact us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Privacy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Terms of Use</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Legal information</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Set cookies</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-headline font-bold mb-4 uppercase tracking-widest text-xs border-l-2 border-tertiary pl-3">Platforms</h4>
              <ul className="space-y-3">
                {/* Dynamically loads the current game's platforms, defaults to standard if empty */}
                {(platformLabels.length > 0 ? platformLabels : ['Xbox Series X|S', 'PlayStation®5', 'PC']).map(p => (
                  <li key={p}><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">{p}</a></li>
                ))}
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body mt-2 inline-block text-primary">PlayWise Connect</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-headline font-bold mb-4 uppercase tracking-widest text-xs border-l-2 border-[#a4ec43] pl-3">Partners</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Lucasfilm Games</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Nvidia GeForce RTX</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Nvidia GeForce Now</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Intel</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">MSI</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors text-sm font-body">Blacknut</a></li>
              </ul>
            </div>
          </div>

          {/* Copyright & Legal */}
          <div className="flex flex-col items-center text-center pt-8 border-t border-white/5">
            <div className="flex items-center gap-2 mb-4 opacity-50 grayscale">
              <div className="w-8 h-8 bg-white/10 flex items-center justify-center rounded">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chess_pawn</span>
              </div>
              <span className="text-sm font-bold text-white font-headline">PlayWise</span>
            </div>
            <p className="text-gray-600 text-[10px] uppercase tracking-[0.15em] leading-relaxed max-w-4xl mx-auto">
              {currentGame.title.toUpperCase()} © & TM {new Date().getFullYear()} Lucasfilm Ltd. All Rights Reserved. Developed by Partner Studios. PlayWise TM & © {new Date().getFullYear()} PlayWise Entertainment. All Rights Reserved. Benchmark data verified via PlayWise API.
            </p>
          </div>

        </div>
      </footer>
      </div>
    </>
  )
}
