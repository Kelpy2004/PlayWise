import {
  useEffect, useMemo, useRef, useState,
  type CSSProperties, type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  motion,
  useScroll,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from 'framer-motion'

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
  TournamentRecord,
} from '../types/api'
import type { GameRecord } from '../types/catalog'

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PURE HELPERS                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function nextReaction(current: ReactionKind | null | undefined, target: ReactionKind): ReactionKind | null {
  return current === target ? null : target
}

function buildHardwarePayload(
  hardwareForm: { laptop: string; cpu: string; gpu: string; ram: string },
  inputMode: 'laptop' | 'manual',
): Record<string, unknown> | undefined {
  if (inputMode === 'laptop') {
    return hardwareForm.laptop.trim() ? { laptop: hardwareForm.laptop.trim() } : undefined
  }
  const cpu = hardwareForm.cpu.trim()
  const gpu = hardwareForm.gpu.trim()
  const ram = Number.parseInt(String(hardwareForm.ram || '').trim(), 10)
  if (!cpu || !gpu) return undefined
  return { cpu, gpu, ...(Number.isFinite(ram) && ram > 0 ? { ram } : {}) }
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
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency || 'USD'} ${amount.toFixed(2)}`
  }
}

function timingBadgeAccent(decision?: PriceTimingInsight['decision']): string {
  switch (decision) {
    case 'BUY_NOW': return 'var(--cyan)'
    case 'WAIT_FOR_DROP': return '#ffb800'
    case 'FAIR_PRICE': return '#00d4ff'
    default: return 'rgba(255,255,255,0.5)'
  }
}

function timingDecisionLabel(decision?: PriceTimingInsight['decision']): string {
  return String(decision || 'WATCH_CLOSELY').replaceAll('_', ' ')
}

function formatTimelineLabel(value?: string | null): string {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SMALL SHARED COMPONENTS                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

const ease = [0.16, 1, 0.3, 1] as const

function Icon({ name, size = 20, fill, style, className = '' }: { name: string; size?: number; fill?: boolean; style?: CSSProperties; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : undefined, lineHeight: 1, ...style }}>{name}</span>
}

function Stars() {
  const dots = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i, w: Math.random() * 1.8 + 0.4, x: Math.random() * 100, y: Math.random() * 100,
    d: Math.random() * 6, dur: 2 + Math.random() * 4,
  })), [])
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {dots.map(d => (
        <div key={d.id} style={{
          position: 'absolute', width: d.w, height: d.w, top: `${d.y}%`, left: `${d.x}%`,
          borderRadius: '50%', background: '#fff',
          animation: `twinkle ${d.dur}s ${d.d}s ease-in-out infinite alternate`,
        }} />
      ))}
    </div>
  )
}

function SectionHead({ accent, label, title, sub }: { accent: string; label: string; title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 24, height: 2, borderRadius: 1, background: accent }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: accent }}>{label}</span>
      </div>
      <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4, color: 'var(--ds-text)' }}>{title}</h2>
      <p style={{ fontSize: 14, color: 'var(--ds-muted)' }}>{sub}</p>
    </div>
  )
}

function SideCard({ icon, label, accent, borderTop, children }: { icon: string; label: string; accent: string; borderTop?: boolean; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ borderRadius: 'var(--radius, 16px)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: 16, ...(borderTop ? { borderTop: `2px solid ${accent}35` } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icon name={icon} size={13} style={{ color: accent }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: accent }}>{label}</span>
      </div>
      {children}
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  PRICE CHART (production)                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PriceHistoryChart({ points }: { points: PriceHistoryPoint[] }) {
  if (!points.length) return null

  const [activeIndex, setActiveIndex] = useState(points.length - 1)
  const width = 560
  const height = 248
  const padding = 18
  const axisLabelSpace = 26
  const chartBottom = height - padding - axisLabelSpace
  const { chartPoints, linePath, areaPath, latest } = useMemo(() => {
    const amounts = points.map(p => p.amount)
    const min = Math.min(...amounts)
    const max = Math.max(...amounts)
    const range = Math.max(max - min, 1)

    const nextChartPoints = points.map((point, index) => {
      const x = padding + ((width - (padding * 2)) * index) / Math.max(points.length - 1, 1)
      const y = chartBottom - (((point.amount - min) / range) * (chartBottom - padding))
      return { ...point, x, y }
    })

    const nextLinePath = nextChartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')

    return {
      chartPoints: nextChartPoints,
      linePath: nextLinePath,
      areaPath: `${nextLinePath} L ${nextChartPoints[nextChartPoints.length - 1].x.toFixed(2)} ${chartBottom.toFixed(2)} L ${nextChartPoints[0].x.toFixed(2)} ${chartBottom.toFixed(2)} Z`,
      latest: nextChartPoints[nextChartPoints.length - 1],
      lowest: nextChartPoints.reduce((best, cur) => (cur.amount < best.amount ? cur : best), nextChartPoints[0])
    }
  }, [chartBottom, padding, points, width])

  const activePoint = chartPoints[activeIndex] || latest

  useEffect(() => { setActiveIndex(points.length - 1) }, [points.length])

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width) return
    const relativeX = ((event.clientX - bounds.left) / bounds.width) * width
    let nearestIndex = 0
    let smallestDistance = Number.POSITIVE_INFINITY
    chartPoints.forEach((p, i) => {
      const d = Math.abs(p.x - relativeX)
      if (d < smallestDistance) { smallestDistance = d; nearestIndex = i }
    })
    if (nearestIndex !== activeIndex) setActiveIndex(nearestIndex)
  }

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', minHeight: 200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 9, color: 'var(--muted-solid)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>Hovered</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--ds-text)' }}>{formatCurrencyValue(activePoint.amount, activePoint.currency)}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 9, color: 'var(--muted-solid)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block' }}>{formatDate(activePoint.timestamp)}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--cyan)' }}>{activePoint.store || 'Tracked store'}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }} role="img" aria-label="Game price history chart"
        onPointerMove={handlePointerMove} onPointerLeave={() => setActiveIndex(chartPoints.length - 1)}>
        <defs>
          <linearGradient id="priceGrad" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--cyan)', stopOpacity: 0.2 }} />
            <stop offset="100%" style={{ stopColor: 'var(--cyan)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#priceGrad)" />
        <path d={linePath} fill="none" stroke="var(--cyan)" strokeWidth="2.5" />
        {chartPoints.map((p, i) => (
          <circle key={`${p.timestamp}-${i}`} cx={p.x} cy={p.y} r={p === activePoint ? 5 : 0} fill="var(--cyan)" style={{ transition: 'all 0.2s' }} />
        ))}
      </svg>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  ANIMATION VARIANTS                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

const sectionV = {
  hidden: { opacity: 0, y: 50 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
}
const stagger = { show: { transition: { staggerChildren: 0.1 } } }
const cardV = {
  hidden: { opacity: 0, y: 30, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease } },
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export default function GamePage() {
  const { slug } = useParams()
  const { user, token } = useAuth()
  const localGame = getGameBySlug(slug)
  const [game, setGame] = useState<GameRecord | null>(localGame)
  const [gameLoading, setGameLoading] = useState(!localGame && Boolean(slug))
  const relatedGames = useMemo(() => (localGame ? getRelatedGames(localGame) : []), [localGame])

  /* ── state ── */
  const [catalog, setCatalog] = useState<HardwareCatalog>({ cpus: [], gpus: [], laptops: [], ramOptions: [8, 12, 16, 32] })
  const [inputMode, setInputMode] = useState<'laptop' | 'manual'>('laptop')
  const [hardwareForm, setHardwareForm] = useState({ laptop: '', cpu: '', gpu: '', ram: '16' })
  const [hardwareSuggestions, setHardwareSuggestions] = useState<{
    laptop: HardwareSearchSuggestion[]; cpu: HardwareSearchSuggestion[]; gpu: HardwareSearchSuggestion[]
  }>({ laptop: [], cpu: [], gpu: [] })
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null)
  const [compatibilityStatus, setCompatibilityStatus] = useState({ loading: false, message: '' })
  const [comments, setComments] = useState<CommentRecord[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentForm, setCommentForm] = useState({ username: '', message: '' })
  const [commentBusy, setCommentBusy] = useState(false)
  const [commentStatus, setCommentStatus] = useState({ tone: 'info', message: '' })
  const [gameReactionSummary, setGameReactionSummary] = useState<ReactionSummary>({ gameSlug: slug, likeCount: 0, dislikeCount: 0, userReaction: null })
  const [recommendation, setRecommendation] = useState<RecommendationPreview | null>(null)
  const [recommendationStatus, setRecommendationStatus] = useState({ loading: false, tone: 'info', message: '' })
  const [reactionStatus, setReactionStatus] = useState({ tone: 'info', message: '' })
  const [reactionBusyKey, setReactionBusyKey] = useState<string | null>(null)
  const [prices, setPrices] = useState<PriceSnapshot | null>(null)
  const [pricesStatus, setPricesStatus] = useState({ loading: false, message: '' })
  const [activeNav, setActiveNav] = useState('overview')
  const [priceAlerts, setPriceAlerts] = useState<Array<{ id: string; targetPrice?: number | null; isActive: boolean }>>([])
  const [priceAlertFeedback, setPriceAlertFeedback] = useState({ tone: 'info', message: '' })
  const [tournamentSubscriptions, setTournamentSubscriptions] = useState<Array<{ id: string; scope: 'ALL' | 'GAME'; gameSlug?: string | null; isActive: boolean }>>([])
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([])
  const [tournamentsLoading, setTournamentsLoading] = useState(false)
  const [tournamentPopupOpen, setTournamentPopupOpen] = useState(false)
  const [tournamentFeedback, setTournamentFeedback] = useState({ tone: 'info', message: '' })

  /* ── parallax ── */
  const heroRef = useRef<HTMLDivElement>(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const springX = useSpring(mx, { stiffness: 50, damping: 25 })
  const springY = useSpring(my, { stiffness: 50, damping: 25 })

  function onHeroMove(e: React.MouseEvent) {
    const rect = heroRef.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  /* ── scroll-driven nav highlight ── */
  const { scrollY } = useScroll()
  useEffect(() => {
    const ids = ['overview', 'compat', 'pricing', 'community']
    return scrollY.on('change', () => {
      let cur = 'overview'
      ids.forEach(id => {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 140) cur = id
      })
      setActiveNav(cur)
    })
  }, [scrollY])

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  ALL DATA EFFECTS (unchanged business logic)                           */
  /* ═══════════════════════════════════════════════════════════════════════ */

  useEffect(() => { setGame(localGame); setGameLoading(!localGame && Boolean(slug)) }, [localGame, slug])

  useEffect(() => {
    if (!slug) return undefined
    let ignore = false
    async function loadGameDetails() {
      setGameLoading(true)
      try {
        const response = await api.fetchGameDetails(slug!)
        if (!ignore) { setGame(response); setGameLoading(false) }
      } catch {
        if (!ignore && !localGame) setGame(null)
        if (!ignore) setGameLoading(false)
      }
    }
    void loadGameDetails()
    return () => { ignore = true }
  }, [localGame, slug])

  useEffect(() => { if (game?.slug) void trackEvent({ category: 'games', action: 'game_viewed', label: game.slug }, token) }, [game?.slug, token])

  useEffect(() => {
    let ignore = false
    async function loadHardwareCatalog() {
      try {
        const hw = await api.getHardwareCatalog()
        if (ignore) return
        setCatalog(hw)
        setHardwareForm(c => ({ ...c, ram: c.ram || String(hw.ramOptions?.[2] || 16) }))
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
    async function loadComments() {
      setCommentsLoading(true)
      try {
        const response = await api.fetchComments(game!.slug, token)
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
    if (!game) return undefined
    let ignore = false
    async function loadGameReactions() {
      try {
        const response = await api.fetchGameReactions(game!.slug, token)
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
    async function loadPrices() {
      setPricesStatus({ loading: true, message: '' })
      try {
        const response = await api.fetchPrices(game!.slug)
        if (!ignore) setPrices(response)
      } catch (error) {
        if (!ignore) setPricesStatus({ loading: false, message: error instanceof Error ? error.message : 'Price data is not available right now.' })
      } finally {
        if (!ignore) setPricesStatus(c => ({ ...c, loading: false }))
      }
    }
    loadPrices()
    return () => { ignore = true }
  }, [game])

  useEffect(() => {
    if (!game) { setTournaments([]); return }
    let ignore = false
    async function loadTournaments() {
      setTournamentsLoading(true)
      try {
        const response = await api.fetchTournaments({ game: game!.title, limit: 80 })
        if (!ignore) setTournaments(Array.isArray(response) ? response : [])
      } catch { if (!ignore) setTournaments([]) }
      finally { if (!ignore) setTournamentsLoading(false) }
    }
    void loadTournaments()
    return () => { ignore = true }
  }, [game])

  useEffect(() => {
    if (!token || !game) { setPriceAlerts([]); setTournamentSubscriptions([]); return }
    let ignore = false
    async function loadNotificationSubscriptions() {
      try {
        const [alerts, subs] = await Promise.all([api.fetchPriceAlerts(token!), api.fetchTournamentSubscriptions(token!)])
        if (ignore) return
        setPriceAlerts((alerts || []).map(e => ({ id: e.id, targetPrice: e.targetPrice, isActive: e.isActive })))
        setTournamentSubscriptions((subs || []).map(e => ({ id: e.id, scope: e.scope, gameSlug: e.gameSlug || null, isActive: e.isActive })))
      } catch { if (!ignore) setPriceAlertFeedback({ tone: 'warning', message: 'Could not load your subscriptions right now.' }) }
    }
    void loadNotificationSubscriptions()
    return () => { ignore = true }
  }, [token, game])

  useEffect(() => {
    if (!game || !token) { setTournamentPopupOpen(false); return }
    const localKey = `playwise:tournament-popup-dismissed:${game.slug}`
    const alreadyDismissed = typeof window !== 'undefined' && window.localStorage.getItem(localKey) === '1'
    const alreadySubscribed = tournamentSubscriptions.some(e => e.isActive && (e.scope === 'ALL' || e.gameSlug === game.slug))
    setTournamentPopupOpen(!alreadyDismissed && !alreadySubscribed)
  }, [game, token, tournamentSubscriptions])

  // Hardware suggestion effects
  useEffect(() => {
    if (inputMode !== 'laptop') { setHardwareSuggestions(c => ({ ...c, laptop: [] })); return undefined }
    const q = hardwareForm.laptop.trim()
    if (q.length < 2) { setHardwareSuggestions(c => ({ ...c, laptop: [] })); return undefined }
    let ignore = false
    const tid = window.setTimeout(async () => {
      try { const r = await api.searchHardware('laptop', q); if (!ignore) setHardwareSuggestions(c => ({ ...c, laptop: r })) }
      catch { if (!ignore) setHardwareSuggestions(c => ({ ...c, laptop: [] })) }
    }, 220)
    return () => { ignore = true; window.clearTimeout(tid) }
  }, [hardwareForm.laptop, inputMode])

  useEffect(() => {
    if (inputMode !== 'manual') { setHardwareSuggestions(c => ({ ...c, cpu: [], gpu: [] })); return undefined }
    const q = hardwareForm.cpu.trim()
    if (q.length < 2) { setHardwareSuggestions(c => ({ ...c, cpu: [] })); return undefined }
    let ignore = false
    const tid = window.setTimeout(async () => {
      try { const r = await api.searchHardware('cpu', q); if (!ignore) setHardwareSuggestions(c => ({ ...c, cpu: r })) }
      catch { if (!ignore) setHardwareSuggestions(c => ({ ...c, cpu: [] })) }
    }, 220)
    return () => { ignore = true; window.clearTimeout(tid) }
  }, [hardwareForm.cpu, inputMode])

  useEffect(() => {
    if (inputMode !== 'manual') { setHardwareSuggestions(c => ({ ...c, gpu: [] })); return undefined }
    const q = hardwareForm.gpu.trim()
    if (q.length < 2) { setHardwareSuggestions(c => ({ ...c, gpu: [] })); return undefined }
    let ignore = false
    const tid = window.setTimeout(async () => {
      try { const r = await api.searchHardware('gpu', q); if (!ignore) setHardwareSuggestions(c => ({ ...c, gpu: r })) }
      catch { if (!ignore) setHardwareSuggestions(c => ({ ...c, gpu: [] })) }
    }, 220)
    return () => { ignore = true; window.clearTimeout(tid) }
  }, [hardwareForm.gpu, inputMode])

  const { busySlug: wishlistBusySlug, favoriteSlugSet, status: wishlistStatus, toggleWishlist } = useWishlist(game ? [game] : [])

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  HANDLERS                                                              */
  /* ═══════════════════════════════════════════════════════════════════════ */

  async function handleCompatibilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCompatibilityStatus({ loading: true, message: '' })
    const hardware = buildHardwarePayload(hardwareForm, inputMode)
    if (!hardware) {
      setCompatibility(null)
      setCompatibilityStatus({ loading: false, message: inputMode === 'laptop' ? 'Enter a laptop model before running the check.' : 'Enter CPU and GPU for manual specs before running the check.' })
      return
    }
    try {
      const response = await api.checkCompatibility(game!, hardware)
      setCompatibility(response)
      setCompatibilityStatus({ loading: false, message: '' })
      void trackEvent({ category: 'compatibility', action: 'compatibility_check', label: game!.slug, meta: { inputMode, source: response.source, preset: response.recommendedPreset } }, token)
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
      await api.postComment(game!.slug, { username, message }, token)
      const refreshedComments = await api.fetchComments(game!.slug, token)
      setComments(Array.isArray(refreshedComments) ? refreshedComments : [])
      setCommentForm(c => ({ ...c, message: '', username: user ? c.username : username }))
      setCommentStatus({ tone: 'success', message: 'Comment posted successfully.' })
      void trackEvent({ category: 'engagement', action: 'comment_posted', label: game!.slug }, token)
    } catch (error) {
      setCommentStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not post comment.' })
    } finally { setCommentBusy(false) }
  }

  async function handleGenerateRecommendation() {
    setRecommendationStatus({ loading: true, tone: 'info', message: '' })
    try {
      const response = await api.previewRecommendation({ gameSlug: game!.slug, hardware: buildHardwarePayload(hardwareForm, inputMode), priceSnapshot: prices }, token)
      setRecommendation(response)
      setRecommendationStatus({ loading: false, tone: 'success', message: 'AI recommendation updated.' })
      void trackEvent({ category: 'recommendation', action: 'recommendation_preview_generated', label: game!.slug, meta: { decision: response.decision, confidence: response.confidence } }, token)
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
      void trackEvent({ category: 'engagement', action: 'game_reaction_changed', label: game.slug, meta: { reaction: reaction || 'CLEARED' } }, token)
    } catch (error) {
      setReactionStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not save your game reaction.' })
    } finally { setReactionBusyKey(null) }
  }

  async function handleCommentReaction(commentId: string | undefined, target: ReactionKind) {
    if (!commentId) return
    if (!token) return setReactionStatus({ tone: 'warning', message: 'Log in to like or dislike comments.' })
    const existing = comments.find(c => c.id === commentId)
    const reaction = nextReaction(existing?.userReaction || null, target)
    setReactionBusyKey(commentId)
    try {
      const response = await api.reactToComment(commentId, reaction, token)
      setComments(cur => cur.map(c => c.id === commentId ? { ...c, likeCount: response.likeCount, dislikeCount: response.dislikeCount, userReaction: response.userReaction || null } : c))
      void trackEvent({ category: 'engagement', action: 'comment_reaction_changed', label: commentId, meta: { reaction: reaction || 'CLEARED', gameSlug: game!.slug } }, token)
    } catch (error) {
      setReactionStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Could not save your comment reaction.' })
    } finally { setReactionBusyKey(null) }
  }

  async function handleCreatePriceAlert() {
    if (!token || !game) { setPriceAlertFeedback({ tone: 'warning', message: 'Log in first to create price alerts.' }); return }
    try {
      const created = await api.createPriceAlert({ gameSlug: game.slug, isActive: true }, token)
      setPriceAlerts(c => [{ id: created.id, targetPrice: created.targetPrice, isActive: created.isActive }, ...c])
      setPriceAlertFeedback({ tone: 'success', message: 'Price-drop alerts enabled.' })
    } catch (error) {
      setPriceAlertFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Could not create price alert.' })
    }
  }

  async function handleDeletePriceAlert(id: string) {
    if (!token) return
    try { await api.deletePriceAlert(id, token); setPriceAlerts(c => c.filter(e => e.id !== id)); setPriceAlertFeedback({ tone: 'success', message: 'Price alert removed.' }) }
    catch (error) { setPriceAlertFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Could not remove price alert.' }) }
  }

  async function handleSubscribeTournament(scope: 'ALL' | 'GAME') {
    if (!token || !game) { setTournamentFeedback({ tone: 'warning', message: 'Log in first to subscribe for tournament alerts.' }); return }
    try {
      const created = await api.createTournamentSubscription({ scope, gameSlug: scope === 'GAME' ? game.slug : null, isActive: true }, token)
      setTournamentSubscriptions(c => [{ id: created.id, scope: created.scope, gameSlug: created.gameSlug || null, isActive: created.isActive }, ...c])
      setTournamentPopupOpen(false)
      if (typeof window !== 'undefined') window.localStorage.setItem(`playwise:tournament-popup-dismissed:${game.slug}`, '1')
      setTournamentFeedback({ tone: 'success', message: 'Tournament alerts are enabled.' })
    } catch (error) {
      setTournamentFeedback({ tone: 'error', message: error instanceof Error ? error.message : 'Could not subscribe for tournament alerts.' })
    }
  }

  function handleDismissTournamentPopup() {
    if (game && typeof window !== 'undefined') window.localStorage.setItem(`playwise:tournament-popup-dismissed:${game.slug}`, '1')
    setTournamentPopupOpen(false)
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  LOADING / 404                                                         */
  /* ═══════════════════════════════════════════════════════════════════════ */

  if (!game) {
    if (gameLoading) {
      return (
        <div style={{ background: 'var(--deep)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--ds-text)', marginBottom: 8 }}>Loading game profile...</h1>
            <p style={{ color: 'var(--muted-solid)' }}>PlayWise is pulling the latest details.</p>
          </div>
        </div>
      )
    }
    return (
      <div style={{ background: 'var(--deep)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--ds-text)', marginBottom: 24 }}>This game was not found in the PlayWise catalog.</h1>
          <Link to="/" style={{ display: 'inline-block', padding: '12px 32px', borderRadius: 14, background: 'var(--cyan)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Back to home</Link>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  DERIVED DATA                                                          */
  /* ═══════════════════════════════════════════════════════════════════════ */

  const currentGame = game as GameRecord
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const seoTitle = currentGame?.title ? `${currentGame.title} | PlayWise` : 'Game Details | PlayWise'
  const seoDescription = currentGame?.description || currentGame?.heroTag || 'Compare price history, compatibility, and recommendations for this game on PlayWise.'
  const seoImage = currentGame?.image || currentGame?.banner || null
  const seoUrl = origin && currentGame?.slug ? `${origin}/games/${currentGame.slug}` : undefined
  const seoJsonLd = currentGame ? {
    '@context': 'https://schema.org', '@type': 'VideoGame', name: currentGame.title, description: seoDescription,
    image: seoImage || undefined, genre: (currentGame.genre || currentGame.genres || []).filter(Boolean),
    operatingSystem: (currentGame.supportedPlatforms || currentGame.platform || []).filter(Boolean),
    aggregateRating: typeof currentGame.averageRating === 'number' ? { '@type': 'AggregateRating', ratingValue: currentGame.averageRating, ratingCount: currentGame.externalRatingCount || 1 } : undefined
  } : undefined

  const heroImage = currentGame.banner || currentGame.image || ''
  const platformLabels = (currentGame.supportedPlatforms?.length ? currentGame.supportedPlatforms : currentGame.platform || []).slice(0, 4)
  const isWishlisted = favoriteSlugSet.has(currentGame.slug)

  const currentValueScore = currentGame.valueRating?.score ?? currentGame.averageRating ?? null
  const currentValueAdvice = currentGame.valueRating?.advice || (currentGame.catalogSource === 'igdb' ? 'Live critical signal from IGDB.' : 'Not mapped yet.')
  const currentStabilityLabel = currentGame.bugStatus?.label || (currentGame.catalogSource === 'igdb' ? 'External catalog' : 'Not rated')
  const currentStabilityNote = currentGame.bugStatus?.note || (currentGame.catalogSource === 'igdb' ? 'Profile from the live IGDB catalog.' : 'Stability note pending.')
  const currentHeroTag = currentGame.heroTag || currentGame.description || 'Live game profile loaded into PlayWise.'

  const signals = [
    { icon: 'star', label: 'Value', value: currentValueScore ? `${Number(currentValueScore).toFixed(1)}/10` : 'N/A', note: currentValueAdvice, accent: 'var(--cyan)' },
    { icon: 'verified', label: 'Stability', value: currentStabilityLabel, note: currentStabilityNote, accent: '#00d4ff' },
    { icon: 'group', label: 'Best For', value: currentGame.playerTypes?.bestFor?.join(', ') || 'Single Player', note: currentGame.playerTypes?.notIdealFor?.join(', ') || 'Built for focused sessions', accent: '#00e676' },
    { icon: 'category', label: 'Genre', value: currentGame.genre.slice(0, 2).join(', ') || 'Game', note: currentHeroTag, accent: '#ffb800' },
    { icon: 'schedule', label: 'Playtime', value: currentGame.timeCommitment?.mainStory || 'Ongoing', note: currentGame.timeCommitment?.mainPlusSide || currentGame.timeCommitment?.completionist || 'Depends on playstyle', accent: '#ff2d78' },
  ]

  const quickLinks = [
    ...(currentGame.storeLinks || []),
    ...(currentGame.trailer ? [{ label: currentGame.trailer.title || 'Watch trailer', url: currentGame.trailer.url }] : []),
    ...(currentGame.officialSite ? [{ label: 'Official site', url: currentGame.officialSite }] : [])
  ].filter((e, i, arr) => arr.findIndex(x => x.url === e.url) === i)

  const visibleTournaments = tournaments.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()).slice(0, 4)

  const sideInsightTitle = currentGame.optimizationGuide?.[0]?.tier ? `${currentGame.optimizationGuide[0].tier} setup tweaks` : 'Performance Tweaks'
  const sideInsightNote = currentGame.optimizationGuide?.[0]?.note || currentStabilityNote

  const bestDealPrice = prices?.bestDeal?.currentPrice || (currentGame.downloadUrl ? 'Free' : null)

  /* ═══════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                */
  /* ═══════════════════════════════════════════════════════════════════════ */

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} image={seoImage} url={seoUrl} type="article" jsonLd={seoJsonLd} />

      <div style={{ background: 'var(--deep)', minHeight: '100vh', fontFamily: "'Outfit', system-ui, sans-serif", color: 'var(--ds-text)', overflowX: 'hidden' }}>

        {/* ── Tournament Popup ── */}
        {tournamentPopupOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 16 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              style={{ position: 'relative', width: '100%', maxWidth: 480, borderRadius: 20, border: '1px solid var(--card-border)', background: 'var(--card-bg)', padding: 28, boxShadow: '0 30px 70px rgba(0,0,0,0.5)' }}>
              <button type="button" onClick={handleDismissTournamentPopup} style={{ position: 'absolute', right: 12, top: 12, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--card-border)', background: 'none', cursor: 'pointer', color: 'var(--ds-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={16} />
              </button>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--cyan)' }}>Tournament Alerts</span>
              <h4 style={{ fontSize: 22, fontWeight: 900, margin: '8px 0', color: 'var(--ds-text)' }}>Stay updated for live events</h4>
              <p style={{ fontSize: 14, color: 'var(--ds-muted)', marginBottom: 20 }}>Get notified when tournaments for <strong style={{ color: 'var(--ds-text)' }}>{currentGame.title}</strong> go live.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => void handleSubscribeTournament('GAME')}
                  style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'var(--cyan)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                  This game
                </motion.button>
                <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => void handleSubscribeTournament('ALL')}
                  style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.04)', color: 'var(--ds-text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
                  All tournaments
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  HERO — gradient + stars (no background image)               */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div ref={heroRef} onMouseMove={onHeroMove}
          style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Gradient sky */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `
              radial-gradient(ellipse 70% 50% at 25% 30%, rgba(0,212,255,0.12), transparent),
              radial-gradient(ellipse 60% 40% at 75% 60%, rgba(59,167,255,0.08), transparent),
              radial-gradient(ellipse 50% 50% at 50% 90%, rgba(255,45,120,0.05), transparent),
              linear-gradient(180deg, #06060f 0%, #080818 40%, #0a0a20 70%, var(--deep) 100%)
            `,
          }} />

          {/* Animated orbs — parallax-reactive */}
          <motion.div style={{
            position: 'absolute', top: '5%', right: '10%', width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,212,255,0.14), transparent 70%)',
            filter: 'blur(90px)', x: springX, y: springY,
            animation: 'orbDrift 12s ease-in-out infinite alternate', pointerEvents: 'none',
          }} />
          <motion.div style={{
            position: 'absolute', bottom: '8%', left: '8%', width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,167,255,0.1), transparent 70%)',
            filter: 'blur(80px)',
            animation: 'orbDrift 15s ease-in-out infinite alternate-reverse', pointerEvents: 'none',
          }} />
          <motion.div style={{
            position: 'absolute', top: '50%', left: '50%', width: 350, height: 350, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,45,120,0.06), transparent 70%)',
            filter: 'blur(70px)', transform: 'translate(-50%, -50%)',
            animation: 'orbDrift 18s ease-in-out infinite alternate', pointerEvents: 'none',
          }} />

          <Stars />

          {/* Subtle grid lines */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.025,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }} />

          {/* Hero content — vertically centered */}
          <div style={{
            position: 'relative', zIndex: 10, margin: 'auto 0',
            padding: '6rem clamp(1.5rem, 5vw, 5rem) 5rem',
            maxWidth: 1400, width: '100%', marginInline: 'auto',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '4rem', alignItems: 'center' }}>

              {/* Left — Game info */}
              <div>
                {/* Eyebrow */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.5, ease }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <span style={{ width: 28, height: 2, borderRadius: 1, background: 'var(--cyan)' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--cyan)' }}>PlayWise // Game Intel</span>
                </motion.div>

                {/* Chips */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5, ease }}
                  style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', background: 'var(--cyan-dim)', border: '1px solid rgba(0,212,255,0.2)', color: 'var(--cyan)' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--cyan)', boxShadow: '0 0 6px var(--cyan)' }} />
                    {currentGame.bugStatus?.label || currentGame.demandLevel || 'Featured'}
                  </span>
                  {currentGame.year && <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{currentGame.year}</span>}
                  {platformLabels.map(p => (
                    <span key={p} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>{p}</span>
                  ))}
                </motion.div>

                {/* Title */}
                <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.7, ease }}
                  style={{ fontSize: 'clamp(3.5rem, 7vw, 6.5rem)', fontWeight: 900, lineHeight: 0.9, letterSpacing: '-0.04em', marginBottom: 18 }}>
                  {currentGame.title}
                </motion.h1>

                {/* Genre tags */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5, ease }}
                  style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                  {currentGame.genre.map(g => (
                    <span key={g} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-dim)' }}>{g}</span>
                  ))}
                </motion.div>

                {/* Description */}
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5, ease }}
                  style={{ fontSize: 15, lineHeight: 1.75, color: 'var(--text-dim)', maxWidth: 520, marginBottom: 32 }}>
                  {currentGame.description}
                </motion.p>

                {/* Action row */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5, ease }}
                  style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <motion.button whileHover={{ y: -2, boxShadow: '0 0 32px rgba(0,212,255,0.35)' }} whileTap={{ scale: 0.97 }}
                    onClick={() => void toggleWishlist(currentGame)} disabled={wishlistBusySlug === currentGame.slug}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 26px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700,
                      background: isWishlisted ? 'rgba(0,212,255,0.15)' : 'var(--cyan)', color: '#fff',
                      boxShadow: '0 0 24px rgba(0,212,255,0.2)', transition: 'background 0.3s, color 0.3s',
                      ...(isWishlisted ? { border: '1px solid rgba(0,212,255,0.3)' } : {}) }}>
                    <Icon name={isWishlisted ? 'bookmark_added' : 'bookmark_add'} size={17} fill={isWishlisted} />
                    {wishlistBusySlug === currentGame.slug ? 'Saving...' : isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                  </motion.button>

                  {quickLinks.slice(0, 2).map(link => (
                    <motion.a key={link.url} href={link.url} target="_blank" rel="noreferrer" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                      style={{ padding: '13px 26px', borderRadius: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)', textDecoration: 'none' }}>
                      {link.label}
                    </motion.a>
                  ))}

                  {/* Reactions */}
                  <div style={{ marginLeft: 'auto', display: 'flex', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(16px)' }}>
                    <button onClick={() => void handleGameReaction('LIKE')} disabled={reactionBusyKey === 'game'}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', color: gameReactionSummary.userReaction === 'LIKE' ? 'var(--cyan)' : 'var(--muted)', fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, transition: 'color 0.2s' }}>
                      <Icon name="thumb_up" size={15} fill={gameReactionSummary.userReaction === 'LIKE'} /> {gameReactionSummary.likeCount || 0}
                    </button>
                    <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />
                    <button onClick={() => void handleGameReaction('DISLIKE')} disabled={reactionBusyKey === 'game'}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', color: gameReactionSummary.userReaction === 'DISLIKE' ? '#ff2d78' : 'var(--muted)', fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, transition: 'color 0.2s' }}>
                      <Icon name="thumb_down" size={15} fill={gameReactionSummary.userReaction === 'DISLIKE'} /> {gameReactionSummary.dislikeCount || 0}
                    </button>
                  </div>
                </motion.div>
                {reactionStatus.message && <p style={{ fontSize: 11, color: reactionStatus.tone === 'error' ? '#ff7351' : 'var(--cyan)', marginTop: 10 }}>{reactionStatus.message}</p>}
                {wishlistStatus.message && <p style={{ fontSize: 11, color: 'var(--cyan)', marginTop: 6 }}>{wishlistStatus.message}</p>}
              </div>

              {/* Right — Floating poster card */}
              <motion.div initial={{ opacity: 0, y: 60, rotateY: -8 }} animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ delay: 0.35, duration: 0.9, ease }} style={{ perspective: 800 }}>
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
                  style={{
                    borderRadius: 22, overflow: 'hidden', position: 'relative',
                    border: '1px solid rgba(0,212,255,0.12)',
                    boxShadow: '0 30px 70px rgba(0,0,0,0.5), 0 0 50px rgba(0,212,255,0.08)',
                    background: 'var(--card)',
                  }}>
                  <div style={{ height: 220, background: heroImage ? `url('${heroImage}') center/cover` : 'var(--panel)' }} />
                  <div style={{ padding: '20px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--cyan)' }}>Best Deal</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 900, color: 'var(--cyan)' }}>{bestDealPrice || '...'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Rating', value: currentValueScore ? `${Number(currentValueScore).toFixed(1)} / 10` : 'N/A' },
                        { label: 'Platform', value: platformLabels[0] || 'PC' },
                        { label: 'Players', value: currentGame.playerTypes?.bestFor?.[0] || 'Single Player' },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--muted)' }}>{row.label}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* Bottom fade into content */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(transparent, var(--deep))', pointerEvents: 'none' }} />
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  STICKY NAV                                                   */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'center', padding: '10px 16px' }}>
          <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8, duration: 0.5, ease }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 6px', borderRadius: 18, background: 'rgba(17,17,38,0.85)', border: '1px solid var(--border)', backdropFilter: 'blur(20px) saturate(1.6)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {[
              { id: 'overview', label: 'Overview', icon: 'dashboard' },
              { id: 'compat', label: 'Compat', icon: 'memory' },
              { id: 'pricing', label: 'Pricing', icon: 'payments' },
              { id: 'community', label: 'Community', icon: 'forum' },
            ].map(n => (
              <a key={n.id} href={`#${n.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textDecoration: 'none', transition: 'all 0.25s',
                  ...(activeNav === n.id ? { background: 'var(--cyan)', color: '#fff', boxShadow: '0 0 16px rgba(0,212,255,0.3)' } : { color: 'var(--muted-solid)' }),
                }}>
                <Icon name={n.icon} size={14} /> {n.label}
              </a>
            ))}
          </motion.nav>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  MAIN CONTENT GRID                                            */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '3rem clamp(1.5rem, 5vw, 5rem)', display: 'grid', gridTemplateColumns: '1fr 320px', gap: '3.5rem' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4.5rem' }}>

            {/* ── SIGNALS ── */}
            <motion.section id="overview" variants={sectionV} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}>
              <SectionHead accent="var(--cyan)" label="Game Signals" title="Decision Intelligence" sub="Five key signals to decide before you buy." />
              <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                {signals.map((s, i) => (
                  <motion.div key={i} variants={cardV} whileHover={{ y: -4, boxShadow: `0 16px 48px rgba(0,0,0,0.25), 0 0 20px ${s.accent}18` }}
                    style={{ padding: 20, borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--card-border)', borderTop: `2px solid ${s.accent}55`, cursor: 'default', transition: 'box-shadow 0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${s.accent}18` }}>
                        <Icon name={s.icon} size={16} style={{ color: s.accent }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: s.accent }}>{s.label}</span>
                    </div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 900, marginBottom: 6, color: 'var(--text)' }}>{s.value}</p>
                    <p style={{ fontSize: 11, lineHeight: 1.55, color: 'var(--text-dim)' }}>{s.note}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>

            {/* ── HARDWARE COMPAT ── */}
            <motion.section id="compat" variants={sectionV} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}>
              <SectionHead accent="var(--cyan)" label="Hardware Lab" title="Compatibility Checker" sub="Real benchmarks predict your performance tier." />
              <motion.div variants={cardV} initial="hidden" whileInView="show" viewport={{ once: true }}
                style={{ borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.025, pointerEvents: 'none' }}>
                  <Icon name="memory" size={200} style={{ color: 'var(--cyan)' }} />
                </div>

                {/* Tabs */}
                <div style={{ display: 'inline-flex', borderRadius: 12, padding: 4, background: 'var(--metric-bg)', border: '1px solid var(--card-border)', marginBottom: 24, position: 'relative', zIndex: 2 }}>
                  {(['laptop', 'manual'] as const).map(m => (
                    <button key={m} onClick={() => setInputMode(m)}
                      style={{ padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'all 0.25s',
                        background: inputMode === m ? 'var(--cyan)' : 'transparent', color: inputMode === m ? '#fff' : 'var(--muted-solid)' }}>
                      {m === 'laptop' ? 'Laptop' : 'Manual Specs'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCompatibilitySubmit} style={{ position: 'relative', zIndex: 2 }}>
                  <AnimatePresence mode="wait">
                    {inputMode === 'laptop' ? (
                      <motion.div key="laptop" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3, ease }}>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--cyan)', marginBottom: 8 }}>Laptop Model</label>
                        <div style={{ position: 'relative' }}>
                          <Icon name="search" size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-solid)' }} />
                          <input placeholder="e.g. HP Victus i5 12450H RTX 3050 16GB" list="pw-laptop-suggestions" value={hardwareForm.laptop}
                            onChange={e => setHardwareForm(c => ({ ...c, laptop: e.target.value }))}
                            style={{ width: '100%', padding: '14px 14px 14px 40px', borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--ds-text)', fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: 'none' }} />
                          <datalist id="pw-laptop-suggestions">
                            {hardwareSuggestions.laptop.map(item => <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>{item.label}</option>)}
                            {catalog.laptops.slice(0, 120).map(item => <option key={`cat-l-${item.id || item.model}`} value={item.model}>{item.brand} {item.model}</option>)}
                          </datalist>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="manual" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3, ease }}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--cyan)', marginBottom: 8 }}>CPU</label>
                          <input placeholder="Intel Core i5-12450H" list="pw-cpu-suggestions" value={hardwareForm.cpu}
                            onChange={e => setHardwareForm(c => ({ ...c, cpu: e.target.value }))}
                            style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--ds-text)', fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: 'none' }} />
                          <datalist id="pw-cpu-suggestions">
                            {hardwareSuggestions.cpu.map(item => <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>{item.label}</option>)}
                            {catalog.cpus.slice(0, 120).map(item => <option key={`cat-c-${item.id || item.name}`} value={item.name} />)}
                          </datalist>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--cyan)', marginBottom: 8 }}>GPU</label>
                          <input placeholder="NVIDIA RTX 3050" list="pw-gpu-suggestions" value={hardwareForm.gpu}
                            onChange={e => setHardwareForm(c => ({ ...c, gpu: e.target.value }))}
                            style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--ds-text)', fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: 'none' }} />
                          <datalist id="pw-gpu-suggestions">
                            {hardwareSuggestions.gpu.map(item => <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>{item.label}</option>)}
                            {catalog.gpus.slice(0, 120).map(item => <option key={`cat-g-${item.id || item.name}`} value={item.name} />)}
                          </datalist>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--cyan)', marginBottom: 8 }}>RAM (GB)</label>
                          <input type="number" min={4} step={2} list="pw-ram-options" value={hardwareForm.ram}
                            onChange={e => setHardwareForm(c => ({ ...c, ram: e.target.value }))}
                            style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--input-bg)', color: 'var(--ds-text)', fontFamily: "'Outfit', sans-serif", fontSize: 14, outline: 'none' }} />
                          <datalist id="pw-ram-options">{catalog.ramOptions.map(r => <option key={`ram-${r}`} value={r} />)}</datalist>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button type="submit" disabled={compatibilityStatus.loading} whileHover={{ y: -2, boxShadow: '0 0 28px rgba(0,212,255,0.3)' }} whileTap={{ scale: 0.97 }}
                    style={{ marginTop: 24, padding: '12px 28px', borderRadius: 12, border: 'none', background: 'var(--cyan)', color: '#fff', fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 20px rgba(0,212,255,0.15)' }}>
                    {compatibilityStatus.loading ? 'Checking...' : 'Run Compatibility Check'}
                  </motion.button>
                </form>

                {compatibilityStatus.message && <p style={{ fontSize: 12, color: '#ff7351', marginTop: 14 }}>{compatibilityStatus.message}</p>}

                {compatibility && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ delay: 0.2, duration: 0.4 }}
                    style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ padding: 16, borderRadius: 12, background: 'var(--metric-bg)', border: '1px solid var(--card-border)' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--cyan)', marginBottom: 4 }}>Can It Run?</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--ds-text)' }}>{compatibility.canRun}</p>
                      <p style={{ fontSize: 10, color: 'var(--muted-solid)', marginTop: 4 }}>Source: {compatibility.source}</p>
                    </div>
                    <div style={{ padding: 16, borderRadius: 12, background: 'var(--metric-bg)', border: '1px solid var(--card-border)' }}>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--cyan)', marginBottom: 4 }}>Preset</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--ds-text)' }}>{compatibility.recommendedPreset}</p>
                      {compatibility.warning && <p style={{ fontSize: 10, color: 'var(--muted-solid)', marginTop: 4 }}>{compatibility.warning}</p>}
                    </div>
                    {compatibility.fps && (
                      <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {[
                          { preset: 'Low', fps: compatibility.fps.low, c: 'var(--muted)' },
                          { preset: 'Medium', fps: compatibility.fps.medium, c: '#3ba7ff' },
                          { preset: 'High', fps: compatibility.fps.high, c: 'var(--cyan)' },
                        ].map(f => (
                          <motion.div key={f.preset} whileHover={{ y: -2 }}
                            style={{ padding: 16, borderRadius: 12, background: 'var(--metric-bg)', border: '1px solid var(--card-border)', borderTop: `2px solid ${f.c}55`, textAlign: 'center' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: f.c }}>{f.preset}</p>
                            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: '4px 0 2px' }}>{f.fps}</p>
                            <p style={{ fontSize: 9, color: 'var(--muted)' }}>FPS avg</p>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </motion.section>

            {/* ── PRICING ── */}
            <motion.section id="pricing" variants={sectionV} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}>
              <SectionHead accent="var(--cyan)" label="Price Intelligence" title={currentGame.downloadUrl ? 'Official Free Sources' : 'Price & Buying Analysis'} sub="Live store data, price history, and AI timing signals." />

              {currentGame.downloadUrl ? (
                <motion.div variants={cardV} style={{ borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: 40, textAlign: 'center' }}>
                  <Icon name="download" size={40} style={{ color: 'var(--cyan)', marginBottom: 12 }} />
                  <p style={{ color: 'var(--ds-muted)', marginBottom: 20, maxWidth: 400, marginInline: 'auto' }}>This title is free/open-source. PlayWise links directly to official downloads.</p>
                  <motion.a href={currentGame.downloadUrl} target="_blank" rel="noreferrer" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                    style={{ display: 'inline-block', padding: '12px 32px', borderRadius: 14, background: 'var(--cyan)', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                    Download Now
                  </motion.a>
                </motion.div>
              ) : pricesStatus.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3].map(i => <div key={i} style={{ height: 64, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--card-border)' }} />)}
                </div>
              ) : prices ? (
                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

                  {/* Stores */}
                  <motion.div variants={cardV} style={{ borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                      <Icon name="storefront" size={14} style={{ color: 'var(--cyan)' }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--cyan)' }}>Live Stores</span>
                    </div>
                    {(prices.stores || []).map(store => (
                      <motion.a key={store.store} href={store.url || '#'} target="_blank" rel="noreferrer" whileHover={{ y: -2 }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, background: 'var(--metric-bg)', border: '1px solid var(--card-border)', marginBottom: 8, cursor: 'pointer', textDecoration: 'none' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ds-text)' }}>{store.store}</span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 900, color: 'var(--cyan)' }}>{store.currentPrice || 'View'}</span>
                          {store.cut ? <span style={{ display: 'block', fontSize: 9, color: 'var(--cyan)' }}>{store.cut}% off</span> : null}
                        </div>
                      </motion.a>
                    ))}
                    {(!prices.stores || prices.stores.length === 0) && <p style={{ fontSize: 12, color: 'var(--muted-solid)' }}>No active stores.</p>}
                  </motion.div>

                  {/* Chart */}
                  <motion.div variants={cardV} style={{ borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="show_chart" size={14} style={{ color: 'var(--cyan)' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--cyan)' }}>Price History</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 8, color: 'var(--muted-solid)', textTransform: 'uppercase' }}>Low</p>
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>{prices.historicalLow?.price || 'N/A'}</p>
                      </div>
                    </div>
                    {prices.history?.available && prices.history.points.length > 1 ? (
                      <PriceHistoryChart points={prices.history.points} />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 16 }}>
                        <Icon name="monitoring" size={28} style={{ color: 'var(--muted-solid)', marginBottom: 8 }} />
                        <p style={{ fontSize: 11, color: 'var(--muted-solid)' }}>Not enough price history data yet.</p>
                      </div>
                    )}
                  </motion.div>

                  {/* AI Signal */}
                  <motion.div variants={cardV} style={{ borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: 20, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="auto_awesome" size={14} style={{ color: 'var(--cyan)' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--cyan)' }}>AI Signal</span>
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--cyan-dim)', color: 'var(--cyan)' }}>AI</span>
                    </div>
                    <div style={{ padding: 14, borderRadius: 12, background: `${timingBadgeAccent(prices.timing?.decision)}12`, border: `1px solid ${timingBadgeAccent(prices.timing?.decision)}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div>
                        <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', opacity: 0.6, color: timingBadgeAccent(prices.timing?.decision) }}>Signal</p>
                        <p style={{ fontSize: 16, fontWeight: 900, color: timingBadgeAccent(prices.timing?.decision) }}>{timingDecisionLabel(prices.timing?.decision)}</p>
                      </div>
                      <Icon name="shopping_cart_checkout" size={22} fill style={{ color: timingBadgeAccent(prices.timing?.decision) }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div style={{ padding: 10, borderRadius: 8, background: 'var(--metric-bg)', textAlign: 'center' }}>
                        <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-solid)' }}>Confidence</p>
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 900, color: 'var(--cyan)' }}>{Math.round((prices.timing?.confidence || 0) * 100)}%</p>
                      </div>
                      <div style={{ padding: 10, borderRadius: 8, background: 'var(--metric-bg)', textAlign: 'center' }}>
                        <p style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-solid)' }}>Drop Prob.</p>
                        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 900, color: 'var(--cyan)' }}>{Math.round((prices.timing?.dropProbability || 0) * 100)}%</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--ds-muted)', marginBottom: 14, flex: 1 }}>{prices.timing?.summary || 'PlayWise uses price history to decide if now is the right time to buy.'}</p>
                    {recommendationStatus.message && <p style={{ fontSize: 10, color: recommendationStatus.tone === 'error' ? '#ff7351' : 'var(--cyan)', marginBottom: 8 }}>{recommendationStatus.message}</p>}
                    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => void handleGenerateRecommendation()} disabled={recommendationStatus.loading}
                      style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1px solid var(--card-border)', background: 'var(--metric-bg)', color: 'var(--ds-text)', fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}>
                      {recommendationStatus.loading ? 'Updating...' : 'Refresh AI Signal'}
                    </motion.button>
                  </motion.div>
                </motion.div>
              ) : pricesStatus.message ? (
                <p style={{ fontSize: 13, color: 'var(--muted-solid)' }}>{pricesStatus.message}</p>
              ) : null}
            </motion.section>

            {/* ── COMMUNITY ── */}
            <motion.section id="community" variants={sectionV} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}>
              <SectionHead accent="var(--magenta)" label="Community" title="Player Discussion" sub="Share your take — help others decide." />

              {commentStatus.message && <p style={{ fontSize: 12, padding: '8px 12px', borderRadius: 10, marginBottom: 12, background: commentStatus.tone === 'error' ? 'rgba(255,115,81,0.1)' : commentStatus.tone === 'success' ? 'rgba(0,212,255,0.1)' : 'rgba(0,212,255,0.1)', color: commentStatus.tone === 'error' ? '#ff7351' : commentStatus.tone === 'success' ? 'var(--cyan)' : 'var(--cyan)' }}>{commentStatus.message}</p>}

              {/* Comment form */}
              <motion.form onSubmit={handleCommentSubmit} variants={cardV} initial="hidden" whileInView="show" viewport={{ once: true }}
                style={{ borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--card-border)', padding: 22, marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--metric-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'var(--magenta)', flexShrink: 0 }}>
                    {(user?.username || commentForm.username || 'G').slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    {!user && (
                      <input placeholder="Your name" value={commentForm.username} onChange={e => setCommentForm(c => ({ ...c, username: e.target.value }))} required
                        style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', padding: '8px 0', fontSize: 14, color: 'var(--text)', outline: 'none', marginBottom: 10, fontFamily: 'var(--font)' }} />
                    )}
                    <textarea placeholder={user ? `Share your experience as ${user.username}...` : 'Share your experience…'} rows={2} value={commentForm.message}
                      onChange={e => setCommentForm(c => ({ ...c, message: e.target.value }))} required
                      style={{ width: '100%', background: 'none', border: 'none', resize: 'none', fontSize: 14, color: 'var(--text)', outline: 'none', fontFamily: 'var(--font)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Icon name="image" size={16} /></button>
                        <button type="button" style={{ padding: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}><Icon name="sentiment_satisfied" size={16} /></button>
                      </div>
                      <motion.button type="submit" disabled={commentBusy} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
                        style={{ padding: '8px 22px', borderRadius: 12, border: 'none', background: 'var(--magenta)', color: '#fff', fontFamily: 'var(--font)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {commentBusy ? 'Posting...' : 'Post'}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.form>

              {/* Comments */}
              <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {commentsLoading && <p style={{ fontSize: 13, color: 'var(--muted-solid)' }}>Loading comments...</p>}
                {!commentsLoading && comments.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted-solid)' }}>No comments yet. Be the first.</p>}
                {comments.map(comment => (
                  <motion.div key={comment.id || `${comment.username}-${comment.createdAt}`} variants={cardV}
                    style={{ borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--card-border)', padding: 22 }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--metric-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--cyan)', flexShrink: 0 }}>
                        {comment.username[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{comment.username}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{formatDate(comment.createdAt)}</span>
                        </div>
                        <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text-dim)', marginBottom: 10 }}>{comment.message}</p>
                        <div style={{ display: 'flex', gap: 14 }}>
                          <button onClick={() => void handleCommentReaction(comment.id, 'LIKE')} disabled={reactionBusyKey === comment.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', color: comment.userReaction === 'LIKE' ? 'var(--cyan)' : 'var(--muted)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)' }}>
                            <Icon name="thumb_up" size={14} fill={comment.userReaction === 'LIKE'} /> {comment.likeCount || 0}
                          </button>
                          <button onClick={() => void handleCommentReaction(comment.id, 'DISLIKE')} disabled={reactionBusyKey === comment.id}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', color: comment.userReaction === 'DISLIKE' ? '#ff2d78' : 'var(--muted)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)' }}>
                            <Icon name="thumb_down" size={14} fill={comment.userReaction === 'DISLIKE'} /> {comment.dislikeCount || 0}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>
          </div>

          {/* ═══ SIDEBAR ═══ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 80, height: 'fit-content' }}>

            {/* Patch Notes */}
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease }}
              style={{ borderRadius: 16, background: 'var(--card-bg)', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
              <div style={{ height: 90, background: heroImage ? `url('${heroImage}') center/cover` : 'var(--panel)', opacity: 0.35 }} />
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--cyan-dim)', color: 'var(--cyan)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Patch v1.0.4</span>
                  <span style={{ fontSize: 9, color: 'var(--muted-solid)', alignSelf: 'center' }}>2h ago</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ds-text)', marginBottom: 4 }}>{sideInsightTitle}</p>
                <p style={{ fontSize: 11, color: 'var(--ds-muted)', marginBottom: 10, lineHeight: 1.5 }}>{sideInsightNote}</p>
                <button style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--cyan)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Outfit', sans-serif" }}>
                  Read notes <Icon name="arrow_forward" size={12} />
                </button>
              </div>
            </motion.div>

            {/* Similar Games */}
            <SideCard icon="sports_esports" label="Similar Games" accent="var(--cyan)">
              {relatedGames.slice(0, 4).map(g => (
                <Link key={g.slug} to={`/games/${g.slug}`} style={{ textDecoration: 'none' }}>
                  <motion.div whileHover={{ x: 4 }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--metric-bg)', border: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {g.image ? <img src={g.image} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="videogame_asset" size={14} style={{ color: 'var(--muted-solid)' }} />}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ds-text)' }}>{g.title}</p>
                      <p style={{ fontSize: 10, color: 'var(--muted-solid)' }}>{g.genre[0] || 'Game'}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
              {relatedGames.length === 0 && <p style={{ fontSize: 11, color: 'var(--muted-solid)' }}>No similar games found.</p>}
            </SideCard>

            {/* Price Alerts */}
            <SideCard icon="notifications_active" label="Price Alerts" accent="var(--cyan)" borderTop>
              <p style={{ fontSize: 11, color: 'var(--ds-muted)', marginBottom: 10 }}>Get emailed when the price drops.</p>
              <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => void handleCreatePriceAlert()}
                style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: 'none', background: 'var(--cyan)', color: '#fff', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Enable Alerts
              </motion.button>
              {priceAlertFeedback.message && <p style={{ fontSize: 10, marginTop: 8, color: priceAlertFeedback.tone === 'error' ? '#ff7351' : 'var(--cyan)' }}>{priceAlertFeedback.message}</p>}
              {priceAlerts.filter(e => e.isActive).slice(0, 4).map(entry => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'rgba(0,0,0,0.2)', marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: 'var(--ds-muted)' }}>Alert active</span>
                  <button onClick={() => void handleDeletePriceAlert(entry.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ff7351', fontSize: 11, fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>Remove</button>
                </div>
              ))}
            </SideCard>

            {/* Tournaments */}
            <SideCard icon="emoji_events" label="Tournaments" accent="var(--cyan)" borderTop>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => void handleSubscribeTournament('GAME')}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: 'var(--cyan)', color: '#fff', fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>This Game</motion.button>
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => void handleSubscribeTournament('ALL')}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--metric-bg)', color: 'var(--ds-text)', fontFamily: "'Outfit', sans-serif", fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>All Events</motion.button>
              </div>
              {tournamentFeedback.message && <p style={{ fontSize: 10, marginBottom: 8, color: tournamentFeedback.tone === 'error' ? '#ff7351' : 'var(--cyan)' }}>{tournamentFeedback.message}</p>}
              {tournamentsLoading && <p style={{ fontSize: 11, color: 'var(--muted-solid)' }}>Loading events...</p>}
              {!tournamentsLoading && !visibleTournaments.length && <p style={{ fontSize: 11, color: 'var(--muted-solid)' }}>No tournaments yet.</p>}
              {visibleTournaments.map(t => (
                <div key={t.id || t.slug} style={{ padding: 12, borderRadius: 10, background: 'var(--metric-bg)', border: '1px solid var(--card-border)', marginBottom: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ds-text)', marginBottom: 2 }}>{t.title}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--muted-solid)' }}>{formatDate(t.startsAt)}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: t.status === 'LIVE_NOW' ? 'rgba(255,45,120,0.1)' : 'var(--cyan-dim)',
                      color: t.status === 'LIVE_NOW' ? 'var(--magenta)' : 'var(--cyan)',
                      textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.status.replaceAll('_', ' ')}</span>
                  </div>
                  {typeof t.metadata?.registrationUrl === 'string' && t.metadata.registrationUrl && (
                    <a href={t.metadata.registrationUrl} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-block', marginTop: 6, padding: '4px 10px', borderRadius: 6, background: 'var(--cyan)', color: '#fff', fontSize: 9, fontWeight: 700, textDecoration: 'none' }}>Register</a>
                  )}
                </div>
              ))}
              <Link to={`/tournaments?game=${currentGame.slug}`} style={{ display: 'block', marginTop: 8, fontSize: 10, fontWeight: 700, color: 'var(--cyan)', textDecoration: 'none' }}>View all events</Link>
            </SideCard>

            {/* Quick Links */}
            <SideCard icon="link" label="Quick Links" accent="var(--muted-solid)">
              {quickLinks.length ? quickLinks.slice(0, 4).map(l => (
                <motion.a key={l.url} href={l.url} target="_blank" rel="noreferrer" whileHover={{ x: 4 }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, borderRadius: 10, cursor: 'pointer', color: 'var(--ds-muted)', fontSize: 13, textDecoration: 'none' }}>
                  {l.label} <Icon name="open_in_new" size={13} style={{ opacity: 0.4 }} />
                </motion.a>
              )) : <p style={{ fontSize: 11, color: 'var(--muted-solid)' }}>More links coming soon.</p>}
            </SideCard>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  FOOTER                                                       */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <footer style={{ maxWidth: 1400, margin: '0 auto', padding: '4rem clamp(1.5rem, 5vw, 5rem)', borderTop: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center', marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, color: 'var(--ds-text)' }}>Follow {currentGame.title} on Social</h3>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {[{ i: 'share', c: 'var(--cyan)' }, { i: 'forum', c: 'var(--cyan)' }, { i: 'smart_display', c: 'var(--magenta)' }].map(s => (
                <motion.a key={s.i} href="#" whileHover={{ y: -3 }}
                  style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--metric-bg)', border: '1px solid var(--card-border)', color: 'var(--muted-solid)', textDecoration: 'none' }}>
                  <Icon name={s.i} size={18} />
                </motion.a>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, marginBottom: 40 }}>
            {[
              { h: 'PlayWise', c: 'var(--cyan)', links: [{ label: 'Store', to: '/' }, { label: 'Connect', to: '/' }, { label: 'About', to: '/' }, { label: 'Support', to: '/' }] },
              { h: 'Platforms', c: 'var(--cyan)', links: (platformLabels.length ? platformLabels : ['PC', 'PlayStation', 'Xbox']).map(p => ({ label: p, to: '#' })) },
              { h: 'Partners', c: 'var(--amber)', links: [{ label: 'Nvidia', to: '#' }, { label: 'Intel', to: '#' }, { label: 'MSI', to: '#' }, { label: 'Blacknut', to: '#' }] },
            ].map(col => (
              <div key={col.h}>
                <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: col.c, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${col.c}30` }}>{col.h}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {col.links.map(l => <Link key={l.label} to={l.to} style={{ fontSize: 13, color: 'var(--muted-solid)', textDecoration: 'none' }}>{l.label}</Link>)}
                </div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted-solid)' }}>
            {currentGame.title.toUpperCase()} TM & (c) {new Date().getFullYear()} PlayWise Entertainment. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  )
}
