import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getGameBySlug, getRelatedGames } from '../lib/catalog'

function toneBadgeClass(tone) {
  if (tone === 'good') return 'text-bg-success'
  if (tone === 'warn') return 'text-bg-warning'
  if (tone === 'bad') return 'text-bg-danger'
  return 'text-bg-info'
}

function formatDate(value) {
  if (!value) return 'Unknown'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString()
}

function RatingGrid({ ratings }) {
  return (
    <div className="row g-4 mb-4">
      {Object.entries(ratings || {}).map(([label, value]) => (
        <div key={label} className="col-md-6 col-xl-4">
          <div className="rating-card h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong className="text-capitalize">{label}</strong>
              <span>{Number(value).toFixed(1)} / 10</span>
            </div>
            <div className="progress rounded-pill" role="progressbar" aria-valuenow={value * 10} aria-valuemin="0" aria-valuemax="100">
              <div className="progress-bar" style={{ width: `${value * 10}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function SkeletonBlock({ className = '' }) {
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
  const game = getGameBySlug(slug)
  const relatedGames = game ? getRelatedGames(game) : []

  const [catalog, setCatalog] = useState({ cpus: [], gpus: [], laptops: [], ramOptions: [8, 12, 16, 32] })
  const [inputMode, setInputMode] = useState('laptop')
  const [hardwareForm, setHardwareForm] = useState({ laptop: '', cpu: '', gpu: '', ram: '16' })
  const [compatibility, setCompatibility] = useState(null)
  const [compatibilityStatus, setCompatibilityStatus] = useState({ loading: false, message: '' })
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentForm, setCommentForm] = useState({ username: '', message: '' })
  const [commentStatus, setCommentStatus] = useState({ tone: 'info', message: '' })
  const [prices, setPrices] = useState(null)
  const [pricesStatus, setPricesStatus] = useState({ loading: false, message: '' })

  useEffect(() => {
    let ignore = false

    async function loadHardwareCatalog() {
      try {
        const hardware = await api.getHardwareCatalog()
        if (ignore) return
        setCatalog(hardware)
        setHardwareForm((current) => ({
          laptop: current.laptop || hardware.laptops?.[0]?.model || '',
          cpu: current.cpu || hardware.cpus?.[0]?.name || '',
          gpu: current.gpu || hardware.gpus?.[0]?.name || '',
          ram: current.ram || String(hardware.ramOptions?.[2] || 16)
        }))
      } catch (_) {
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

    async function loadComments() {
      setCommentsLoading(true)
      try {
        const response = await api.fetchComments(game.slug)
        if (!ignore) {
          setComments(Array.isArray(response) ? response : [])
        }
      } catch (error) {
        if (!ignore) {
          setCommentStatus({ tone: 'danger', message: error.message })
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
  }, [game])

  useEffect(() => {
    if (!game || game.downloadUrl) return undefined
    let ignore = false

    async function loadPrices() {
      setPricesStatus({ loading: true, message: '' })
      try {
        const response = await api.fetchPrices(game.slug)
        if (!ignore) {
          setPrices(response)
        }
      } catch (error) {
        if (!ignore) {
          setPricesStatus({ loading: false, message: error.message })
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

  if (!game) {
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

  async function handleCompatibilitySubmit(event) {
    event.preventDefault()
    setCompatibilityStatus({ loading: true, message: '' })

    const hardware =
      inputMode === 'laptop'
        ? { laptop: hardwareForm.laptop }
        : { cpu: hardwareForm.cpu, gpu: hardwareForm.gpu, ram: Number(hardwareForm.ram) }

    try {
      const response = await api.checkCompatibility(game, hardware)
      setCompatibility(response)
      setCompatibilityStatus({ loading: false, message: '' })
    } catch (error) {
      setCompatibility(null)
      setCompatibilityStatus({ loading: false, message: error.message })
    }
  }

  async function handleCommentSubmit(event) {
    event.preventDefault()
    setCommentStatus({ tone: 'info', message: '' })

    try {
      const response = await api.postComment(
        game.slug,
        {
          username: user ? undefined : commentForm.username,
          message: commentForm.message
        },
        token
      )

      setComments((current) => [response, ...current])
      setCommentForm((current) => ({ ...current, message: '', username: user ? current.username : '' }))
      setCommentStatus({ tone: 'success', message: 'Comment posted successfully.' })
    } catch (error) {
      setCommentStatus({ tone: 'danger', message: error.message })
    }
  }

  return (
    <section className="py-5">
      <div className="container">
        <div className="hero-panel overflow-hidden mb-4">
          <div className="row g-0">
            <div className="col-lg-7 p-4 p-lg-5">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="badge rounded-pill text-bg-light">{game.year}</span>
                <span className={`badge rounded-pill ${toneBadgeClass(game.bugStatus?.tone || game.demandTone || 'blue')}`}>
                  {game.bugStatus?.label || game.demandLevel || 'Featured'}
                </span>
                {game.openSource ? <span className="badge rounded-pill text-bg-dark">Open Source</span> : null}
              </div>
              <h1 className="display-6 mb-3">{game.title}</h1>
              <p className="lead text-secondary-emphasis mb-3">{game.heroTag}</p>
              <p className="text-secondary-emphasis mb-4">{game.description}</p>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {game.genre.map((genre) => (
                  <span key={genre} className="badge rounded-pill text-bg-soft">
                    {genre}
                  </span>
                ))}
              </div>
              <div className="d-flex flex-wrap gap-3">
                {game.storeLinks?.map((link) => (
                  <a key={link.url} className="btn btn-outline-dark rounded-pill" href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
                {game.downloadUrl ? (
                  <a className="btn btn-brand rounded-pill" href={game.downloadUrl} target="_blank" rel="noreferrer">
                    Download
                  </a>
                ) : null}
              </div>
            </div>
            <div className="col-lg-5 hero-art-shell">
              <div
                className="hero-art h-100"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(8, 17, 31, 0.2), rgba(8, 17, 31, 0.75)), url('${game.banner || game.image}')`
                }}
              />
            </div>
          </div>
        </div>

        <RatingGrid ratings={game.structuredRatings} />

        <div className="row g-4">
          <div className="col-lg-8">
            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">Overview</p>
              <h2 className="h3 mb-3">What PlayWise says about this game.</h2>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Value rating</strong>
                    <p className="mb-1">{game.valueRating?.score} / 10</p>
                    <small className="text-secondary-emphasis">{game.valueRating?.advice}</small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Stability</strong>
                    <p className="mb-1">{game.bugStatus?.label}</p>
                    <small className="text-secondary-emphasis">{game.bugStatus?.note}</small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Best for</strong>
                    <p className="mb-1">{game.playerTypes?.bestFor?.join(', ') || 'N/A'}</p>
                    <small className="text-secondary-emphasis">
                      Less ideal for: {game.playerTypes?.notIdealFor?.join(', ') || 'Not specified'}
                    </small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="summary-card h-100">
                    <strong>Time commitment</strong>
                    <p className="mb-1">Main story: {game.timeCommitment?.mainStory}</p>
                    <small className="text-secondary-emphasis">
                      Side content: {game.timeCommitment?.mainPlusSide} / Completionist: {game.timeCommitment?.completionist}
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
                    <label className="form-label fw-semibold">Select a laptop model</label>
                    <select className="form-select form-select-lg rounded-4" value={hardwareForm.laptop} onChange={(event) => setHardwareForm((current) => ({ ...current, laptop: event.target.value }))}>
                      {catalog.laptops.map((laptop) => (
                        <option key={laptop.model} value={laptop.model}>
                          {laptop.model}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">CPU</label>
                      <select className="form-select form-select-lg rounded-4" value={hardwareForm.cpu} onChange={(event) => setHardwareForm((current) => ({ ...current, cpu: event.target.value }))}>
                        {catalog.cpus.map((cpu) => (
                          <option key={cpu.name} value={cpu.name}>
                            {cpu.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">GPU</label>
                      <select className="form-select form-select-lg rounded-4" value={hardwareForm.gpu} onChange={(event) => setHardwareForm((current) => ({ ...current, gpu: event.target.value }))}>
                        {catalog.gpus.map((gpu) => (
                          <option key={gpu.name} value={gpu.name}>
                            {gpu.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">RAM</label>
                      <select className="form-select form-select-lg rounded-4" value={hardwareForm.ram} onChange={(event) => setHardwareForm((current) => ({ ...current, ram: event.target.value }))}>
                        {catalog.ramOptions.map((ramOption) => (
                          <option key={ramOption} value={ramOption}>
                            {ramOption} GB
                          </option>
                        ))}
                      </select>
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
                </div>
              ) : null}
            </div>

            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">Optimization guide</p>
              <h2 className="h3 mb-3">Suggested settings tiers.</h2>
              <div className="row g-3">
                {game.optimizationGuide?.map((entry) => (
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
                {commentStatus.message ? <div className={`alert alert-${commentStatus.tone} mb-0 py-2 px-3 rounded-4`}>{commentStatus.message}</div> : null}
              </div>

              <form className="row g-3 mb-4" onSubmit={handleCommentSubmit}>
                {!user ? (
                  <div className="col-md-4">
                    <input className="form-control form-control-lg rounded-4" placeholder="Your name" value={commentForm.username} onChange={(event) => setCommentForm((current) => ({ ...current, username: event.target.value }))} required />
                  </div>
                ) : null}
                <div className={user ? 'col-12' : 'col-md-8'}>
                  <textarea rows="3" className="form-control form-control-lg rounded-4" placeholder={user ? `Comment as ${user.username}` : 'Share your take'} value={commentForm.message} onChange={(event) => setCommentForm((current) => ({ ...current, message: event.target.value }))} required />
                </div>
                <div className="col-12">
                  <button type="submit" className="btn btn-brand rounded-pill px-4">Post comment</button>
                </div>
              </form>

              <div className="d-flex flex-column gap-3">
                {commentsLoading ? <p className="text-secondary-emphasis mb-0">Loading comments...</p> : null}
                {!commentsLoading && !comments.length ? <div className="summary-card">No comments yet. Be the first to leave one.</div> : null}
                {comments.map((comment, index) => (
                  <article key={`${comment.username}-${comment.createdAt}-${index}`} className="comment-card">
                    <div className="d-flex justify-content-between flex-wrap gap-2">
                      <strong>{comment.username}</strong>
                      <span className="text-secondary-emphasis">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="mb-0 mt-2 text-secondary-emphasis">{comment.message}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="feature-card mb-4">
              <p className="eyebrow text-uppercase mb-2">{game.downloadUrl ? 'Download links' : 'Price tracker'}</p>
              <h2 className="h4 mb-3">{game.downloadUrl ? 'Official free sources' : 'Live store status'}</h2>

              {game.downloadUrl ? (
                <div className="d-flex flex-column gap-3">
                  <p className="text-secondary-emphasis mb-0">
                    This title is free/open-source, so PlayWise links directly to official downloads instead of live store pricing.
                  </p>
                  <a className="btn btn-brand rounded-pill" href={game.downloadUrl} target="_blank" rel="noreferrer">Download now</a>
                  <a className="btn btn-outline-dark rounded-pill" href={game.officialSite} target="_blank" rel="noreferrer">Visit official site</a>
                </div>
              ) : pricesStatus.loading ? (
                <PriceSkeleton />
              ) : prices ? (
                <div className="d-flex flex-column gap-3">
                  <p className="text-secondary-emphasis mb-0">{prices.message}</p>
                  {prices.bestDeal ? (
                    <div className="summary-card">
                      <strong>Best current deal</strong>
                      <p className="mb-1">{prices.bestDeal.store} / {prices.bestDeal.currentPrice}</p>
                      <small className="text-secondary-emphasis">
                        Regular: {prices.bestDeal.regularPrice || 'N/A'} / Discount: {prices.bestDeal.cut ?? 'N/A'}%
                      </small>
                    </div>
                  ) : null}
                  {prices.historicalLow ? (
                    <div className="summary-card">
                      <strong>Historical low</strong>
                      <p className="mb-1">{prices.historicalLow.store} / {prices.historicalLow.price}</p>
                      <small className="text-secondary-emphasis">Seen on {formatDate(prices.historicalLow.timestamp)}</small>
                    </div>
                  ) : null}
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
              <p className="text-secondary-emphasis mb-3">{game.story}</p>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                {game.gallery?.map((item) => (
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
