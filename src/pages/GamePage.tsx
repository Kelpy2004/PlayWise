import { useEffect, useMemo, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getGameBySlug, getRelatedGames } from '../lib/catalog'
import { trackEvent } from '../lib/telemetry'
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
  SavedHardwareProfile
} from '../types/api'
import type { GameRecord, StructuredRatings } from '../types/catalog'

function toneBadgeClass(tone?: string): string {
  if (tone === 'good') return 'text-bg-success'
  if (tone === 'warn') return 'text-bg-warning'
  if (tone === 'bad') return 'text-bg-danger'
  return 'text-bg-info'
}

function reactionButtonClass(active: boolean): string {
  return active ? 'btn btn-dark rounded-pill' : 'btn btn-outline-dark rounded-pill'
}

function nextReaction(current: ReactionKind | null | undefined, target: ReactionKind): ReactionKind | null {
  return current === target ? null : target
}

function buildHardwarePayload(
  inputMode: 'laptop' | 'manual',
  hardwareForm: { laptop: string; cpu: string; gpu: string; ram: string }
): Record<string, unknown> | undefined {
  if (inputMode === 'laptop') {
    return hardwareForm.laptop.trim() ? { laptop: hardwareForm.laptop.trim() } : undefined
  }

  if (!hardwareForm.cpu.trim() && !hardwareForm.gpu.trim() && !hardwareForm.ram.trim()) {
    return undefined
  }

  return {
    cpu: hardwareForm.cpu.trim(),
    gpu: hardwareForm.gpu.trim(),
    ram: Number(hardwareForm.ram) || undefined
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
      return 'text-bg-success'
    case 'WAIT_FOR_DROP':
      return 'text-bg-warning'
    case 'FAIR_PRICE':
      return 'text-bg-info'
    default:
      return 'text-bg-secondary'
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
  const { chartPoints, timelineTicks, linePath, areaPath, latest, lowest } = useMemo(() => {
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
      timelineTicks: buildTimelineTicks(nextChartPoints),
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
    <div className="price-chart-shell">
      <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <strong className="d-block">Price history</strong>
          <small className="text-secondary-emphasis">
            Pattern view of the tracked price changes PlayWise is using for timing.
          </small>
        </div>
        <div className="text-end text-secondary-emphasis small">
          <div>Start: {formatDate(chartPoints[0]?.timestamp)}</div>
          <div>Latest: {formatDate(latest?.timestamp)}</div>
        </div>
      </div>

      <div className="price-chart-inspector">
        <div>
          <small className="text-secondary-emphasis d-block">Hovered checkpoint</small>
          <strong>{formatCurrencyValue(activePoint.amount, activePoint.currency)}</strong>
        </div>
        <div className="text-end">
          <div>{formatDate(activePoint.timestamp)}</div>
          <small className="text-secondary-emphasis">
            {activePoint.store || 'Tracked store'}
            {typeof activePoint.cut === 'number' ? ` / ${activePoint.cut}% off` : ''}
          </small>
        </div>
      </div>

      <div className="price-chart-stage">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="price-chart"
          role="img"
          aria-label="Game price history chart"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(chartPoints.length - 1)}
        >
          <defs>
            <linearGradient id="playwisePriceFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 95, 109, 0.36)" />
              <stop offset="100%" stopColor="rgba(255, 95, 109, 0)" />
            </linearGradient>
          </defs>
          <line x1={padding} y1={chartBottom} x2={width - padding} y2={chartBottom} className="price-chart-axis" />
          <line x1={padding} y1={padding} x2={padding} y2={chartBottom} className="price-chart-axis" />
          <line x1={activePoint.x} y1={padding} x2={activePoint.x} y2={chartBottom} className="price-chart-guide" />
          <path d={areaPath} fill="url(#playwisePriceFill)" />
          <path d={linePath} className="price-chart-line" />
          {timelineTicks.map((tick) => (
            <g key={tick.key}>
              <line x1={tick.x} y1={chartBottom} x2={tick.x} y2={chartBottom + 6} className="price-chart-tick-mark" />
              <text x={tick.x} y={chartBottom + 18} textAnchor="middle" className="price-chart-tick-label">
                {tick.label}
              </text>
            </g>
          ))}
          {chartPoints.map((point, index) => (
            <g key={`${point.timestamp}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={point === activePoint ? 7.5 : 4.5}
                className={point === activePoint ? 'price-chart-dot-active-ring' : 'price-chart-hit-area'}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={point === activePoint ? 5.2 : point === latest ? 4.5 : point === lowest ? 4.2 : 3}
                className={
                  point === activePoint
                    ? 'price-chart-dot-active'
                    : point === latest
                      ? 'price-chart-dot-latest'
                      : point === lowest
                        ? 'price-chart-dot-low'
                        : 'price-chart-dot'
                }
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="price-chart-legend">
        <span>
          <strong>Low:</strong> {formatCurrencyValue(lowest.amount, lowest.currency)}
        </span>
        <span>
          <strong>Latest:</strong> {formatCurrencyValue(latest.amount, latest.currency)}
        </span>
      </div>
    </div>
  )
}

function RatingGrid({ ratings }: { ratings?: StructuredRatings }) {
  const ratingEntries = Object.entries(ratings || {})

  if (!ratingEntries.length) {
    return (
      <div className="summary-card mb-4">
        <strong className="d-block mb-2">Deep PlayWise breakdown is still being mapped</strong>
        <p className="mb-0 text-secondary-emphasis">
          This page is using live catalog data, but the hand-tuned story, gameplay, and optimization subscores are not available for this title yet.
        </p>
      </div>
    )
  }

  return (
    <div className="row g-4 mb-4">
      {ratingEntries.map(([label, value]) => (
        <div key={label} className="col-md-6 col-xl-4">
          <div className="rating-card h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong className="text-capitalize">{label}</strong>
              <span>{Number(value).toFixed(1)} / 10</span>
            </div>
            <div className="progress rounded-pill" role="progressbar" aria-valuenow={value * 10} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-bar" style={{ width: `${value * 10}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`skeleton-block ${className}`.trim()} aria-hidden="true" />
}

function PriceSkeleton() {
  return (
    <div className="d-flex flex-column gap-3" aria-hidden="true">
      <p className="text-secondary-emphasis mb-0">Checking live store prices...</p>

      <div className="summary-card price-skeleton-card">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonBlock className="skeleton-line skeleton-line-short" />
        <SkeletonBlock className="skeleton-line skeleton-line-medium" />
      </div>

      <div className="summary-card price-skeleton-card">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonBlock className="skeleton-line skeleton-line-short" />
        <SkeletonBlock className="skeleton-line skeleton-line-shorter" />
      </div>

      {[1, 2, 3].map((entry) => (
        <div key={entry} className="store-row store-row-skeleton">
          <div>
            <SkeletonBlock className="skeleton-line skeleton-line-medium" />
            <SkeletonBlock className="skeleton-line skeleton-line-short" />
          </div>
          <SkeletonBlock className="skeleton-pill" />
        </div>
      ))}
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
  }>({
    laptop: [],
    cpu: [],
    gpu: []
  })
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
  const [savedProfiles, setSavedProfiles] = useState<SavedHardwareProfile[]>([])
  const [profileLabel, setProfileLabel] = useState('')
  const [profileStatus, setProfileStatus] = useState({ tone: 'info', message: '' })
  const [profileBusy, setProfileBusy] = useState(false)
  const [recommendation, setRecommendation] = useState<RecommendationPreview | null>(null)
  const [recommendationStatus, setRecommendationStatus] = useState({ loading: false, tone: 'info', message: '' })
  const [reactionStatus, setReactionStatus] = useState({ tone: 'info', message: '' })
  const [reactionBusyKey, setReactionBusyKey] = useState<string | null>(null)
  const [prices, setPrices] = useState<PriceSnapshot | null>(null)
  const [pricesStatus, setPricesStatus] = useState({ loading: false, message: '' })

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
        if (!ignore && !localGame) {
          setGame(null)
        }
        if (!ignore) {
          setGameLoading(false)
        }
      }
    }

    void loadGameDetails()

    return () => {
      ignore = true
    }
  }, [localGame, slug])

  useEffect(() => {
    if (!game?.slug) return
    void trackEvent(
      {
        category: 'games',
        action: 'game_viewed',
        label: game.slug
      },
      token
    )
  }, [game?.slug, token])

  useEffect(() => {
    let ignore = false

    async function loadHardwareCatalog() {
      try {
        const hardware = await api.getHardwareCatalog()
        if (ignore) return
        setCatalog(hardware)
        setHardwareForm((current) => ({
          laptop: current.laptop,
          cpu: current.cpu,
          gpu: current.gpu,
          ram: current.ram || String(hardware.ramOptions?.[2] || 16)
        }))
      } catch {
        if (!ignore) {
          setCompatibilityStatus({ loading: false, message: 'Hardware catalog could not be loaded right now.' })
        }
      }
    }

    loadHardwareCatalog()

    return () => {
      ignore = true
    }
  }, [slug])

  useEffect(() => {
    if (!game) return undefined
    let ignore = false
    const activeGame = game

    async function loadComments() {
      setCommentsLoading(true)
      try {
        const response = await api.fetchComments(activeGame.slug, token)
        if (!ignore) {
          setComments(Array.isArray(response) ? response : [])
        }
      } catch (error) {
        if (!ignore) {
          setCommentStatus({
            tone: 'danger',
            message: error instanceof Error ? error.message : 'Could not load comments.'
          })
        }
      } finally {
        if (!ignore) {
          setCommentsLoading(false)
        }
      }
    }

    loadComments()

    return () => {
      ignore = true
    }
  }, [game, token])

  useEffect(() => {
    if (!token) {
      setSavedProfiles([])
      return undefined
    }

    let ignore = false
    const activeToken = token

    async function loadUserSignals() {
      try {
        const profiles = await api.fetchSavedHardwareProfiles(activeToken)

        if (!ignore) {
          setSavedProfiles(profiles)
        }
      } catch (error) {
        if (!ignore) {
          const message = error instanceof Error ? error.message : 'Could not load your saved hardware profiles.'
          setProfileStatus({ tone: 'danger', message })
        }
      }
    }

    loadUserSignals()

    return () => {
      ignore = true
    }
  }, [token])

  useEffect(() => {
    setRecommendation(null)
    setRecommendationStatus({ loading: false, tone: 'info', message: '' })
  }, [game?.slug, inputMode, hardwareForm.laptop, hardwareForm.cpu, hardwareForm.gpu, hardwareForm.ram, prices?.bestDeal?.currentPrice])

  useEffect(() => {
    if (!game) return undefined
    let ignore = false
    const activeGame = game

    async function loadGameReactions() {
      try {
        const response = await api.fetchGameReactions(activeGame.slug, token)
        if (!ignore) {
          setGameReactionSummary(response)
        }
      } catch (error) {
        if (!ignore) {
          setReactionStatus({
            tone: 'danger',
            message: error instanceof Error ? error.message : 'Could not load reactions.'
          })
        }
      }
    }

    loadGameReactions()

    return () => {
      ignore = true
    }
  }, [game, token])

  useEffect(() => {
    if (!game || game.downloadUrl) return undefined
    let ignore = false
    const activeGame = game

    async function loadPrices() {
      setPricesStatus({ loading: true, message: '' })
      try {
        const response = await api.fetchPrices(activeGame.slug)
        if (!ignore) {
          setPrices(response)
        }
      } catch (error) {
        if (!ignore) {
          setPricesStatus({
            loading: false,
            message: error instanceof Error ? error.message : 'Price data is not available right now.'
          })
        }
      } finally {
        if (!ignore) {
          setPricesStatus((current) => ({ ...current, loading: false }))
        }
      }
    }

    loadPrices()

    return () => {
      ignore = true
    }
  }, [game])

  useEffect(() => {
    if (inputMode !== 'laptop') return undefined

    const query = hardwareForm.laptop.trim()
    if (query.length < 2) {
      setHardwareSuggestions((current) => ({ ...current, laptop: [] }))
      return undefined
    }

    let ignore = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.searchHardware('laptop', query)
        if (!ignore) {
          setHardwareSuggestions((current) => ({ ...current, laptop: response }))
        }
      } catch {
        if (!ignore) {
          setHardwareSuggestions((current) => ({ ...current, laptop: [] }))
        }
      }
    }, 220)

    return () => {
      ignore = true
      window.clearTimeout(timeoutId)
    }
  }, [hardwareForm.laptop, inputMode])

  useEffect(() => {
    if (inputMode !== 'manual') return undefined

    const query = hardwareForm.cpu.trim()
    if (query.length < 2) {
      setHardwareSuggestions((current) => ({ ...current, cpu: [] }))
      return undefined
    }

    let ignore = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.searchHardware('cpu', query)
        if (!ignore) {
          setHardwareSuggestions((current) => ({ ...current, cpu: response }))
        }
      } catch {
        if (!ignore) {
          setHardwareSuggestions((current) => ({ ...current, cpu: [] }))
        }
      }
    }, 220)

    return () => {
      ignore = true
      window.clearTimeout(timeoutId)
    }
  }, [hardwareForm.cpu, inputMode])

  useEffect(() => {
    if (inputMode !== 'manual') return undefined

    const query = hardwareForm.gpu.trim()
    if (query.length < 2) {
      setHardwareSuggestions((current) => ({ ...current, gpu: [] }))
      return undefined
    }

    let ignore = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.searchHardware('gpu', query)
        if (!ignore) {
          setHardwareSuggestions((current) => ({ ...current, gpu: response }))
        }
      } catch {
        if (!ignore) {
          setHardwareSuggestions((current) => ({ ...current, gpu: [] }))
        }
      }
    }, 220)

    return () => {
      ignore = true
      window.clearTimeout(timeoutId)
    }
  }, [hardwareForm.gpu, inputMode])

  if (!game) {
    if (gameLoading) {
      return (
        <section className="container py-5">
          <div className="hero-panel p-5 text-center">
            <h1 className="h3 mb-3">Loading game profile…</h1>
            <p className="text-secondary-emphasis mb-0">
              PlayWise is pulling the latest details for this title.
            </p>
          </div>
        </section>
      )
    }

    return (
      <section className="container py-5">
        <div className="hero-panel p-5 text-center">
          <h1 className="h3 mb-3">This game was not found in the PlayWise catalog.</h1>
          <Link to="/" className="btn btn-brand rounded-pill px-4">
            Back to home
          </Link>
        </div>
      </section>
    )
  }

  const currentGame = game as GameRecord
  const currentHeroTag =
    currentGame.heroTag ||
    currentGame.description ||
    'Live game profile loaded into PlayWise.'
  const currentValueScore = currentGame.valueRating?.score ?? currentGame.averageRating ?? null
  const currentValueAdvice =
    currentGame.valueRating?.advice ||
    (currentGame.catalogSource === 'igdb'
      ? 'PlayWise is using the live critical signal from IGDB for this title.'
      : 'Value guidance has not been mapped yet for this title.')
  const currentStabilityLabel =
    currentGame.bugStatus?.label ||
    (currentGame.catalogSource === 'igdb' ? 'External catalog profile' : 'Not rated yet')
  const currentStabilityNote =
    currentGame.bugStatus?.note ||
    (currentGame.catalogSource === 'igdb'
      ? 'This profile is coming from the live IGDB catalog, so deeper PlayWise-specific technical notes may still be pending.'
      : 'A deeper stability note has not been added yet.')
  const currentStory =
    currentGame.story ||
    currentGame.description ||
    'PlayWise has the game profile live, but a longer story summary has not been added yet.'
  const currentHighlights = currentGame.gallery?.length
    ? currentGame.gallery
    : [
        currentGame.catalogSource === 'igdb'
          ? 'Live external metadata is active for this title.'
          : 'More highlights will appear here as this profile is expanded.'
      ]

  async function handleCompatibilitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCompatibilityStatus({ loading: true, message: '' })

    const hardware =
      inputMode === 'laptop'
        ? { laptop: hardwareForm.laptop }
        : { cpu: hardwareForm.cpu, gpu: hardwareForm.gpu, ram: Number(hardwareForm.ram) }

    try {
      const response = await api.checkCompatibility(currentGame, hardware)
      setCompatibility(response)
      setCompatibilityStatus({ loading: false, message: '' })
      void trackEvent(
        {
          category: 'compatibility',
          action: 'compatibility_check',
          label: currentGame.slug,
          meta: { inputMode, source: response.source, preset: response.recommendedPreset }
        },
        token
      )
    } catch (error) {
      setCompatibility(null)
      setCompatibilityStatus({
        loading: false,
        message: error instanceof Error ? error.message : 'Compatibility check failed.'
      })
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCommentStatus({ tone: 'info', message: '' })
    const message = commentForm.message.trim()
    const username = user?.username || commentForm.username.trim()

    if (!message) {
      setCommentStatus({ tone: 'warning', message: 'Write a comment before posting.' })
      return
    }

    if (!username) {
      setCommentStatus({ tone: 'warning', message: 'Add your name before posting.' })
      return
    }

    setCommentBusy(true)

    try {
      await api.postComment(
        currentGame.slug,
        {
          username,
          message
        },
        token
      )

      const refreshedComments = await api.fetchComments(currentGame.slug, token)
      setComments(Array.isArray(refreshedComments) ? refreshedComments : [])
      setCommentForm((current) => ({ ...current, message: '', username: user ? current.username : username }))
      setCommentStatus({ tone: 'success', message: 'Comment posted successfully.' })
      void trackEvent(
        {
          category: 'engagement',
          action: 'comment_posted',
          label: currentGame.slug
        },
        token
      )
    } catch (error) {
      setCommentStatus({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not post comment.'
      })
    } finally {
      setCommentBusy(false)
    }
  }

  async function handleSaveCurrentProfile() {
    if (!token) {
      setProfileStatus({ tone: 'warning', message: 'Log in to save your hardware profiles.' })
      return
    }

    const label =
      profileLabel.trim() ||
      (inputMode === 'laptop'
        ? hardwareForm.laptop.trim()
        : `${hardwareForm.cpu.trim() || 'CPU'} / ${hardwareForm.gpu.trim() || 'GPU'}`)

    if (!label) {
      setProfileStatus({ tone: 'warning', message: 'Enter hardware first so PlayWise can save a profile label.' })
      return
    }

    const payload =
      inputMode === 'laptop'
        ? {
            label,
            kind: 'LAPTOP' as const,
            laptopModel: hardwareForm.laptop.trim(),
            cpuName: null,
            gpuName: null,
            ram: Number(hardwareForm.ram) || null,
            isDefault: savedProfiles.length === 0
          }
        : {
            label,
            kind: 'MANUAL' as const,
            laptopModel: null,
            cpuName: hardwareForm.cpu.trim(),
            gpuName: hardwareForm.gpu.trim(),
            ram: Number(hardwareForm.ram) || null,
            isDefault: savedProfiles.length === 0
          }

    setProfileBusy(true)

    try {
      const created = await api.createSavedHardwareProfile(payload, token)
      setSavedProfiles((current) => [created, ...current])
      setProfileLabel('')
      setProfileStatus({ tone: 'success', message: 'Hardware profile saved to your account.' })
      void trackEvent(
        {
          category: 'compatibility',
          action: 'hardware_profile_saved',
          label: created.label,
          meta: { kind: created.kind }
        },
        token
      )
    } catch (error) {
      setProfileStatus({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not save your hardware profile.'
      })
    } finally {
      setProfileBusy(false)
    }
  }

  function handleApplyProfile(profile: SavedHardwareProfile) {
    if (profile.kind === 'LAPTOP') {
      setInputMode('laptop')
      setHardwareForm((current) => ({
        ...current,
        laptop: profile.laptopModel || '',
        ram: String(profile.ram || current.ram || 16)
      }))
      return
    }

    setInputMode('manual')
    setHardwareForm((current) => ({
      ...current,
      cpu: profile.cpuName || '',
      gpu: profile.gpuName || '',
      ram: String(profile.ram || current.ram || 16)
    }))
  }

  async function handleGenerateRecommendation() {
    setRecommendationStatus({ loading: true, tone: 'info', message: '' })

    try {
      const response = await api.previewRecommendation(
        {
          gameSlug: currentGame.slug,
          hardware: buildHardwarePayload(inputMode, hardwareForm),
          priceSnapshot: prices
        },
        token
      )

      setRecommendation(response)
      setRecommendationStatus({ loading: false, tone: 'success', message: 'AI recommendation updated.' })
      void trackEvent(
        {
          category: 'recommendation',
          action: 'recommendation_preview_generated',
          label: currentGame.slug,
          meta: { decision: response.decision, confidence: response.confidence }
        },
        token
      )
    } catch (error) {
      setRecommendation(null)
      setRecommendationStatus({
        loading: false,
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not generate a recommendation.'
      })
    }
  }

  async function handleGameReaction(target: ReactionKind) {
    if (!game) return
    if (!token) {
      setReactionStatus({ tone: 'warning', message: 'Log in to like or dislike games.' })
      return
    }

    const reaction = nextReaction(gameReactionSummary.userReaction || null, target)
    setReactionBusyKey('game')

    try {
      const response = await api.reactToGame(game.slug, reaction, token)
      setGameReactionSummary(response)
      setReactionStatus({ tone: 'success', message: 'Your game reaction was saved.' })
      void trackEvent(
        {
          category: 'engagement',
          action: 'game_reaction_changed',
          label: game.slug,
          meta: { reaction: reaction || 'CLEARED' }
        },
        token
      )
    } catch (error) {
      setReactionStatus({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not save your game reaction.'
      })
    } finally {
      setReactionBusyKey(null)
    }
  }

  async function handleCommentReaction(commentId: string | undefined, target: ReactionKind) {
    if (!commentId) return
    if (!token) {
      setReactionStatus({ tone: 'warning', message: 'Log in to like or dislike comments.' })
      return
    }

    const existing = comments.find((comment) => comment.id === commentId)
    const reaction = nextReaction(existing?.userReaction || null, target)
    setReactionBusyKey(commentId)

    try {
      const response = await api.reactToComment(commentId, reaction, token)
      setComments((current) =>
        current.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                likeCount: response.likeCount,
                dislikeCount: response.dislikeCount,
                userReaction: response.userReaction || null
              }
            : comment
        )
      )
      setReactionStatus({ tone: 'success', message: 'Your comment reaction was saved.' })
      void trackEvent(
        {
          category: 'engagement',
          action: 'comment_reaction_changed',
          label: commentId,
          meta: { reaction: reaction || 'CLEARED', gameSlug: currentGame.slug }
        },
        token
      )
    } catch (error) {
      setReactionStatus({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not save your comment reaction.'
      })
    } finally {
      setReactionBusyKey(null)
    }
  }

  return (
    <section className="py-5">
      <div className="container">
        <div className="hero-panel overflow-hidden mb-4">
          <div className="row g-0">
            <div className="col-lg-7 p-4 p-lg-5">
              <div className="d-flex flex-wrap gap-2 mb-3">
                {currentGame.year ? <span className="badge rounded-pill text-bg-light">{currentGame.year}</span> : null}
                <span className={`badge rounded-pill ${toneBadgeClass(currentGame.bugStatus?.tone || currentGame.demandTone || 'blue')}`}>
                  {currentGame.bugStatus?.label || currentGame.demandLevel || 'Featured'}
                </span>
                {currentGame.openSource ? <span className="badge rounded-pill text-bg-dark">Open Source</span> : null}
              </div>
              <h1 className="display-6 mb-3">{currentGame.title}</h1>
              <p className="lead text-secondary-emphasis mb-3">{currentHeroTag}</p>
              <p className="text-secondary-emphasis mb-4">{currentGame.description}</p>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {currentGame.genre.map((genre) => (
                  <span key={genre} className="badge rounded-pill text-bg-soft">
                    {genre}
                  </span>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-3">
                {currentGame.storeLinks?.map((link) => (
                  <a key={link.url} className="btn btn-outline-dark rounded-pill" href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
                {!currentGame.storeLinks?.length && currentGame.officialSite ? (
                  <a className="btn btn-outline-dark rounded-pill" href={currentGame.officialSite} target="_blank" rel="noreferrer">
                    Visit official site
                  </a>
                ) : null}
                {currentGame.downloadUrl ? (
                  <a className="btn btn-brand rounded-pill" href={currentGame.downloadUrl} target="_blank" rel="noreferrer">
                    Download
                  </a>
                ) : null}
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center mt-4">
                <button
                  type="button"
                  className={reactionButtonClass(gameReactionSummary.userReaction === 'LIKE')}
                  onClick={() => void handleGameReaction('LIKE')}
                  disabled={reactionBusyKey === 'game'}
                >
                  Like {gameReactionSummary.likeCount || 0}
                </button>
                <button
                  type="button"
                  className={reactionButtonClass(gameReactionSummary.userReaction === 'DISLIKE')}
                  onClick={() => void handleGameReaction('DISLIKE')}
                  disabled={reactionBusyKey === 'game'}
                >
                  Dislike {gameReactionSummary.dislikeCount || 0}
                </button>
                <small className="text-secondary-emphasis">
                  {user ? 'Your reaction is stored with your account.' : 'Log in to react. Counts are visible to everyone.'}
                </small>
              </div>
              {reactionStatus.message ? (
                <div className={`alert alert-${reactionStatus.tone} rounded-4 mt-3 mb-0 py-2 px-3`}>
                  {reactionStatus.message}
                </div>
              ) : null}
            </div>
            <div className="col-lg-5 hero-art-shell">
              <div
                className="hero-art h-100"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(8, 17, 31, 0.2), rgba(8, 17, 31, 0.75)), url('${currentGame.banner || currentGame.image || ''}')`
                }}
              />
            </div>
          </div>
        </div>

        <RatingGrid ratings={currentGame.structuredRatings} />

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">Overview</p>
              <h2 className="h3 mb-3">What PlayWise says about this game.</h2>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Value rating</strong>
                    <p className="mb-1">{currentValueScore ? `${currentValueScore} / 10` : 'N/A'}</p>
                    <small className="text-secondary-emphasis">{currentValueAdvice}</small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Stability</strong>
                    <p className="mb-1">{currentStabilityLabel}</p>
                    <small className="text-secondary-emphasis">{currentStabilityNote}</small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Best for</strong>
                    <p className="mb-1">{currentGame.playerTypes?.bestFor?.join(', ') || 'N/A'}</p>
                    <small className="text-secondary-emphasis">
                      Less ideal for: {currentGame.playerTypes?.notIdealFor?.join(', ') || 'Not specified'}
                    </small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Time commitment</strong>
                    <p className="mb-1">Main story: {currentGame.timeCommitment?.mainStory || 'Not mapped yet'}</p>
                    <small className="text-secondary-emphasis">
                      Side content: {currentGame.timeCommitment?.mainPlusSide || 'Not mapped yet'} / Completionist: {currentGame.timeCommitment?.completionist || 'Not mapped yet'}
                    </small>
                  </div>
                </div>
              </div>
            </div>

            <div className="feature-card mb-4">
              <div className="d-flex flex-wrap justify-content-between gap-3 mb-4">
                <div>
                  <p className="eyebrow text-uppercase mb-2">Compatibility checker</p>
                  <h2 className="h3 mb-0">Check how this game should run on your hardware.</h2>
                </div>
                <div className="btn-group rounded-pill" role="group" aria-label="Input mode">
                  <button type="button" className={`btn ${inputMode === 'laptop' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setInputMode('laptop')}>
                    Laptop preset
                  </button>
                  <button type="button" className={`btn ${inputMode === 'manual' ? 'btn-dark' : 'btn-outline-dark'}`} onClick={() => setInputMode('manual')}>
                    Manual specs
                  </button>
                </div>
              </div>

              <form onSubmit={handleCompatibilitySubmit}>
                {inputMode === 'laptop' ? (
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Type any laptop model or full spec string</label>
                    <input
                      className="form-control form-control-lg rounded-4"
                      list="playwise-laptop-suggestions"
                      placeholder="Example: HP Victus i5 12450H RTX 3050 16GB"
                      value={hardwareForm.laptop}
                      onChange={(event) => setHardwareForm((current) => ({ ...current, laptop: event.target.value }))}
                    />
                    <datalist id="playwise-laptop-suggestions">
                      {hardwareSuggestions.laptop.map((item) => (
                        <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>
                          {item.label}
                        </option>
                      ))}
                    </datalist>
                    <div className="form-text">
                      PlayWise will try to match the closest laptop preset first, then infer CPU, GPU, and RAM from whatever you typed.
                    </div>
                    {hardwareSuggestions.laptop[0]?.meta ? (
                      <div className="form-text text-secondary-emphasis">Best match: {hardwareSuggestions.laptop[0].meta}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">CPU</label>
                      <input
                        className="form-control form-control-lg rounded-4"
                        list="playwise-cpu-suggestions"
                        placeholder="Example: Ryzen 7 7840HS"
                        value={hardwareForm.cpu}
                        onChange={(event) => setHardwareForm((current) => ({ ...current, cpu: event.target.value }))}
                      />
                      <datalist id="playwise-cpu-suggestions">
                        {hardwareSuggestions.cpu.map((item) => (
                          <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>
                            {item.label}
                          </option>
                        ))}
                      </datalist>
                      {hardwareSuggestions.cpu[0]?.meta ? (
                        <div className="form-text text-secondary-emphasis">Best CPU match: {hardwareSuggestions.cpu[0].meta}</div>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">GPU</label>
                      <input
                        className="form-control form-control-lg rounded-4"
                        list="playwise-gpu-suggestions"
                        placeholder="Example: RTX 4060 Laptop GPU"
                        value={hardwareForm.gpu}
                        onChange={(event) => setHardwareForm((current) => ({ ...current, gpu: event.target.value }))}
                      />
                      <datalist id="playwise-gpu-suggestions">
                        {hardwareSuggestions.gpu.map((item) => (
                          <option key={`${item.kind}-${item.matchValue || item.label}`} value={item.value} label={item.meta || item.label}>
                            {item.label}
                          </option>
                        ))}
                      </datalist>
                      {hardwareSuggestions.gpu[0]?.meta ? (
                        <div className="form-text text-secondary-emphasis">Best GPU match: {hardwareSuggestions.gpu[0].meta}</div>
                      ) : null}
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">RAM</label>
                      <input
                        type="number"
                        min={4}
                        max={128}
                        className="form-control form-control-lg rounded-4"
                        placeholder="16"
                        value={hardwareForm.ram}
                        onChange={(event) => setHardwareForm((current) => ({ ...current, ram: event.target.value }))}
                      />
                      <div className="form-text text-secondary-emphasis">
                        Known quick values: {catalog.ramOptions.slice(0, 6).join(', ')} GB
                      </div>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn btn-brand btn-lg rounded-pill px-4 mt-4" disabled={compatibilityStatus.loading}>
                  {compatibilityStatus.loading ? 'Checking...' : 'Run compatibility check'}
                </button>
              </form>

              {compatibilityStatus.message ? <div className="alert alert-danger rounded-4 mt-4 mb-0">{compatibilityStatus.message}</div> : null}

              {compatibility ? (
                <div className="row g-3 mt-4">
                  <div className="col-md-6">
                    <div className="summary-card h-100">
                      <strong>Can it run?</strong>
                      <p className="mb-1">{compatibility.canRun}</p>
                      <small className="text-secondary-emphasis">Source: {compatibility.source}</small>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="summary-card h-100">
                      <strong>Recommended preset</strong>
                      <p className="mb-1">{compatibility.recommendedPreset}</p>
                      <small className="text-secondary-emphasis">{compatibility.warning}</small>
                    </div>
                  </div>
                  <div className="col-md-4"><div className="summary-card h-100"><strong>Low</strong><p className="mb-0">{compatibility.fps?.low}</p></div></div>
                  <div className="col-md-4"><div className="summary-card h-100"><strong>Medium</strong><p className="mb-0">{compatibility.fps?.medium}</p></div></div>
                  <div className="col-md-4"><div className="summary-card h-100"><strong>High</strong><p className="mb-0">{compatibility.fps?.high}</p></div></div>
                  {compatibility.details?.length ? (
                    <div className="col-12">
                      <div className="summary-card h-100">
                        <strong className="d-block mb-2">How PlayWise matched your hardware</strong>
                        <ul className="mb-0 ps-3">
                          {compatibility.details.map((detail) => (
                            <li key={detail} className="text-secondary-emphasis">
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="summary-card mt-4">
                <div className="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-3">
                  <div>
                    <strong className="d-block">Saved hardware profiles</strong>
                    <small className="text-secondary-emphasis">
                      Keep reusable laptop/manual setups on your account and bring them back in one click.
                    </small>
                  </div>
                  <span className="badge rounded-pill text-bg-light">{savedProfiles.length} saved</span>
                </div>

                {savedProfiles.length ? (
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {savedProfiles.slice(0, 6).map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className="btn btn-outline-dark rounded-pill"
                        onClick={() => handleApplyProfile(profile)}
                      >
                        {profile.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary-emphasis mb-3">
                    {user
                      ? 'You have not saved a hardware profile yet.'
                      : 'Log in if you want PlayWise to remember your usual hardware setup.'}
                  </p>
                )}

                <div className="row g-3 align-items-end">
                  <div className="col-md-8">
                    <label className="form-label fw-semibold">Profile label</label>
                    <input
                      className="form-control rounded-4"
                      placeholder={inputMode === 'laptop' ? 'My main laptop' : 'My gaming PC'}
                      value={profileLabel}
                      onChange={(event) => setProfileLabel(event.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <button
                      type="button"
                      className="btn btn-brand w-100 rounded-pill"
                      onClick={() => void handleSaveCurrentProfile()}
                      disabled={profileBusy}
                    >
                      {profileBusy ? 'Saving...' : 'Save this setup'}
                    </button>
                  </div>
                </div>
                {profileStatus.message ? (
                  <div className={`alert alert-${profileStatus.tone} rounded-4 mt-3 mb-0 py-2 px-3`}>
                    {profileStatus.message}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">Optimization guide</p>
              <h2 className="h3 mb-3">Suggested settings tiers.</h2>
              <div className="row g-3">
                {currentGame.optimizationGuide?.map((entry) => (
                  <div key={entry.tier} className="col-md-6">
                    <div className="summary-card h-100">
                      <strong>{entry.tier}</strong>
                      <p className="mb-1">{entry.settings}</p>
                      <small className="d-block text-secondary-emphasis mb-2">{entry.note}</small>
                      <span className="badge rounded-pill text-bg-light">{entry.fps}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="feature-card">
              <div className="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-4">
                <div>
                  <p className="eyebrow text-uppercase mb-2">Comments</p>
                  <h2 className="h3 mb-0">What players are saying.</h2>
                </div>
                <div className="d-flex flex-column gap-2">
                  {commentStatus.message ? <div className={`alert alert-${commentStatus.tone} mb-0 py-2 px-3 rounded-4`}>{commentStatus.message}</div> : null}
                  {reactionStatus.message ? <div className={`alert alert-${reactionStatus.tone} mb-0 py-2 px-3 rounded-4`}>{reactionStatus.message}</div> : null}
                </div>
              </div>

              <form className="row g-3 mb-4" onSubmit={handleCommentSubmit}>
                {!user ? (
                  <div className="col-md-4">
                    <input
                      className="form-control form-control-lg rounded-4"
                      placeholder="Your name"
                      value={commentForm.username}
                      onChange={(event) => setCommentForm((current) => ({ ...current, username: event.target.value }))}
                      disabled={commentBusy}
                      required
                    />
                  </div>
                ) : null}
                <div className={user ? 'col-12' : 'col-md-8'}>
                  <textarea
                    rows={3}
                    className="form-control form-control-lg rounded-4"
                    placeholder={user ? `Comment as ${user.username}` : 'Share your take'}
                    value={commentForm.message}
                    onChange={(event) => setCommentForm((current) => ({ ...current, message: event.target.value }))}
                    disabled={commentBusy}
                    required
                  />
                </div>
                <div className="col-12">
                  <button type="submit" className="btn btn-brand rounded-pill px-4" disabled={commentBusy}>
                    {commentBusy ? 'Posting...' : 'Post comment'}
                  </button>
                </div>
              </form>

              <div className="d-flex flex-column gap-3">
                {commentsLoading ? <p className="text-secondary-emphasis mb-0">Loading comments...</p> : null}
                {!commentsLoading && !comments.length ? <div className="summary-card">No comments yet. Be the first to leave one.</div> : null}
                {comments.map((comment) => (
                  <article key={comment.id || `${comment.username}-${comment.createdAt}`} className="comment-card">
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <strong>{comment.username}</strong>
                      <span className="text-secondary-emphasis">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="mb-0 mt-2 text-secondary-emphasis">{comment.message}</p>
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <button
                        type="button"
                        className={reactionButtonClass(comment.userReaction === 'LIKE')}
                        onClick={() => void handleCommentReaction(comment.id, 'LIKE')}
                        disabled={reactionBusyKey === comment.id}
                      >
                        Like {comment.likeCount || 0}
                      </button>
                      <button
                        type="button"
                        className={reactionButtonClass(comment.userReaction === 'DISLIKE')}
                        onClick={() => void handleCommentReaction(comment.id, 'DISLIKE')}
                        disabled={reactionBusyKey === comment.id}
                      >
                        Dislike {comment.dislikeCount || 0}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">AI recommendation</p>
              <h2 className="h4 mb-3">Ask PlayWise for a buy-now or wait verdict.</h2>
              <p className="text-secondary-emphasis mb-3">
                This combines hardware fit, live price context, and the timing pattern above to decide whether buying now
                is smart or a better discount is likely worth waiting for.
              </p>
              <button
                type="button"
                className="btn btn-brand rounded-pill px-4 mb-3"
                onClick={() => void handleGenerateRecommendation()}
                disabled={recommendationStatus.loading}
              >
                {recommendationStatus.loading ? 'Thinking...' : 'Generate recommendation'}
              </button>
              {recommendation ? (
                <div className="d-flex flex-column gap-3">
                  <div className="summary-card">
                    <strong>{recommendation.decision.replaceAll('_', ' ')}</strong>
                    <p className="mb-1">{recommendation.summary}</p>
                    <small className="text-secondary-emphasis">
                      Confidence: {Math.round(recommendation.confidence * 100)}%
                    </small>
                  </div>
                  <div className="summary-card">
                    <strong className="d-block mb-2">Why PlayWise suggests this</strong>
                    <ul className="mb-0 ps-3">
                      {recommendation.reasons.map((reason) => (
                        <li key={reason} className="text-secondary-emphasis">
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {recommendation.alternativeSlug ? (
                    <Link to={`/games/${recommendation.alternativeSlug}`} className="btn btn-outline-dark rounded-pill">
                      Open suggested alternative
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="text-secondary-emphasis mb-0">
                  Use the button above after entering your hardware if you want a more tailored recommendation.
                </p>
              )}
              {recommendationStatus.message && !recommendationStatus.loading ? (
                <div className={`alert alert-${recommendationStatus.tone} rounded-4 mt-3 mb-0 py-2 px-3`}>
                  {recommendationStatus.message}
                </div>
              ) : null}
            </div>

            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">{currentGame.downloadUrl ? 'Download links' : 'Price tracker'}</p>
              <h2 className="h4 mb-3">{currentGame.downloadUrl ? 'Official free sources' : 'Live store status'}</h2>

              {currentGame.downloadUrl ? (
                <div className="d-flex flex-column gap-3">
                  <p className="text-secondary-emphasis mb-0">
                    This title is free/open-source, so PlayWise links directly to official downloads instead of live store pricing.
                  </p>
                  <a className="btn btn-brand rounded-pill" href={currentGame.downloadUrl} target="_blank" rel="noreferrer">Download now</a>
                  {currentGame.officialSite ? (
                    <a className="btn btn-outline-dark rounded-pill" href={currentGame.officialSite} target="_blank" rel="noreferrer">Visit official site</a>
                  ) : null}
                </div>
              ) : pricesStatus.loading ? (
                <PriceSkeleton />
              ) : prices ? (
                <div className="d-flex flex-column gap-3">
                  <p className="text-secondary-emphasis mb-0">{prices.message}</p>

                  {prices.timing ? (
                    <div className="summary-card timing-summary-card">
                      <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                        <div>
                          <strong className="d-block">PlayWise timing model</strong>
                          <p className="mb-1">{prices.timing.summary}</p>
                          <small className="text-secondary-emphasis">
                            Confidence {Math.round(prices.timing.confidence * 100)}% / Drop chance {Math.round(prices.timing.dropProbability * 100)}%
                          </small>
                        </div>
                        <span className={`badge rounded-pill ${timingBadgeClass(prices.timing.decision)}`}>
                          {timingDecisionLabel(prices.timing.decision)}
                        </span>
                      </div>

                      <div className="timing-metric-grid">
                        <div className="timing-metric">
                          <span>Next likely dip</span>
                          <strong>{prices.timing.forecastWindowDays ? `~${prices.timing.forecastWindowDays} days` : 'Watch pattern'}</strong>
                        </div>
                        <div className="timing-metric">
                          <span>Distance from low</span>
                          <strong>
                            {typeof prices.timing.stats.currentVsLowPct === 'number'
                              ? `${Math.round(prices.timing.stats.currentVsLowPct)}%`
                              : 'Unknown'}
                          </strong>
                        </div>
                        <div className="timing-metric">
                          <span>Sale rhythm</span>
                          <strong>
                            {typeof prices.timing.stats.saleCycleDays === 'number'
                              ? `${Math.round(prices.timing.stats.saleCycleDays)} day cycle`
                              : 'Still learning'}
                          </strong>
                        </div>
                      </div>

                      <ul className="timing-reason-list mb-0">
                        {prices.timing.reasons.slice(0, 3).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {prices.history?.available && prices.history.points.length > 1 ? (
                    <PriceHistoryChart points={prices.history.points} />
                  ) : (
                    <div className="summary-card">
                      <strong>Price history graph</strong>
                      <p className="mb-1">PlayWise does not have enough tracked price changes yet to draw a meaningful pattern graph.</p>
                      <small className="text-secondary-emphasis">
                        Once enough historical price points are available, this area will show the ups-and-downs automatically.
                      </small>
                    </div>
                  )}

                  <div className="row g-3">
                    {prices.bestDeal ? (
                      <div className="col-md-6">
                        <div className="summary-card h-100">
                          <strong>Best current deal</strong>
                          <p className="mb-1">{prices.bestDeal.store} / {prices.bestDeal.currentPrice}</p>
                          <small className="text-secondary-emphasis">
                            Regular: {prices.bestDeal.regularPrice || 'N/A'} / Discount: {prices.bestDeal.cut ?? 'N/A'}%
                          </small>
                        </div>
                      </div>
                    ) : null}
                    {prices.historicalLow ? (
                      <div className="col-md-6">
                        <div className="summary-card h-100">
                          <strong>Historical low</strong>
                          <p className="mb-1">{prices.historicalLow.store} / {prices.historicalLow.price}</p>
                          <small className="text-secondary-emphasis">Seen on {formatDate(prices.historicalLow.timestamp)}</small>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {(prices.stores || []).map((store) => (
                    <a key={store.store} className="store-row" href={store.url || '#'} target="_blank" rel="noreferrer">
                      <div>
                        <strong>{store.store}</strong>
                        <span>{store.currentPrice || store.note || 'Use store link'}</span>
                      </div>
                      <span>{store.cut ? `${store.cut}% off` : 'View'}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-secondary-emphasis mb-0">{pricesStatus.message || 'Price data is not available right now.'}</p>
              )}
            </div>

            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">Story setup</p>
              <h2 className="h4 mb-3">Why people play it.</h2>
              <p className="text-secondary-emphasis mb-3">{currentStory}</p>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                {currentHighlights.map((item) => (
                  <li key={item} className="summary-card">{item}</li>
                ))}
              </ul>
            </div>

            <div className="feature-card">
              <p className="eyebrow text-uppercase mb-2">Similar games</p>
              <h2 className="h4 mb-3">Keep exploring nearby picks.</h2>
              <div className="d-flex flex-column gap-3">
                {relatedGames.map((relatedGame) => (
                  <Link key={relatedGame.slug} to={`/games/${relatedGame.slug}`} className="store-row">
                    <div>
                      <strong>{relatedGame.title}</strong>
                      <span>{relatedGame.heroTag}</span>
                    </div>
                    <span>Open</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
