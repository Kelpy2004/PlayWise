import { useDeferredValue, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import GameCard from '../components/GameCard'
import { api } from '../lib/api'
import { getAllGames, getFeaturedGames, getOpenSourceGames } from '../lib/catalog'

const FEATURES = [
  {
    eyebrow: 'Compatibility first',
    title: 'PC compatibility that means something',
    description: 'Use laptop presets or manual specs and get a practical performance readout instead of relying only on vague requirement lists.'
  },
  {
    eyebrow: 'Decision support',
    title: 'Game value and player-fit insights',
    description: 'Every title is framed around story, gameplay, replayability, optimization, and whether it fits the kind of player you are.'
  },
  {
    eyebrow: 'Scalable foundation',
    title: 'Built for growth',
    description: 'React routing, reusable components, and API-backed workflows make PlayWise easier to maintain, expand, and polish over time.'
  }
]

const DECISION_CHIPS = ['Performance clarity', 'Player-fit insights', 'Better value decisions']

function selectRandomGames(games, count) {
  const shuffled = [...games]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function matchesQuery(game, query) {
  if (!query) return true
  const haystack = `${game.title} ${game.genre.join(' ')} ${game.heroTag} ${game.description}`.toLowerCase()
  return haystack.includes(query)
}

export default function HomePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactStatus, setContactStatus] = useState({ tone: 'idle', message: '' })
  const [isSending, setIsSending] = useState(false)

  const allGames = getAllGames()
  const featuredGames = getFeaturedGames()
  const openSourceGames = getOpenSourceGames()
  const spotlightSourceGames = featuredGames.filter((game) => !game.openSource)
  const [spotlightPool, setSpotlightPool] = useState(() =>
    selectRandomGames(spotlightSourceGames.length ? spotlightSourceGames : featuredGames, 5)
  )
  const [spotlightIndex, setSpotlightIndex] = useState(0)
  const search = searchParams.get('q') || ''
  const deferredSearch = useDeferredValue(search)
  const spotlightGame = spotlightPool[spotlightIndex] || featuredGames[0] || allGames[0]
  const activeSearch = deferredSearch.trim()
  const filteredGames = allGames.filter((game) => matchesQuery(game, activeSearch.toLowerCase()))
  const heroStats = [
    { value: allGames.length, label: 'games profiled', detail: 'structured ratings and summaries' },
    { value: 2, label: 'hardware paths', detail: 'manual specs or laptop presets' },
    { value: openSourceGames.length, label: 'free alternatives', detail: 'open-source titles in the same flow' }
  ]
  const spotlightBackground = spotlightGame?.image
    ? `linear-gradient(180deg, rgba(8, 17, 31, 0.18), rgba(8, 17, 31, 0.88)), url('${spotlightGame.image}')`
    : 'linear-gradient(135deg, rgba(16, 32, 51, 0.96), rgba(15, 125, 117, 0.78))'

  useEffect(() => {
    setSpotlightPool(selectRandomGames(spotlightSourceGames.length ? spotlightSourceGames : featuredGames, 5))
    setSpotlightIndex(0)
  }, [featuredGames.length, spotlightSourceGames.length])

  useEffect(() => {
    if (spotlightPool.length <= 1) {
      return undefined
    }

    const rotationId = window.setInterval(() => {
      setSpotlightIndex((current) => (current + 1) % spotlightPool.length)
    }, 2600)

    return () => window.clearInterval(rotationId)
  }, [spotlightPool])

  async function handleContactSubmit(event) {
    event.preventDefault()
    setIsSending(true)

    try {
      const response = await api.sendContact(contactForm)
      setContactStatus({ tone: 'success', message: response.message })
      setContactForm({ name: '', email: '', message: '' })
    } catch (error) {
      setContactStatus({ tone: 'danger', message: error.message })
    } finally {
      setIsSending(false)
    }
  }

  function handleSpotlightOpen() {
    if (spotlightGame?.slug) {
      navigate(`/games/${spotlightGame.slug}`)
    }
  }

  function handleSpotlightKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSpotlightOpen()
    }
  }

  return (
    <>
      <section className="hero-section py-5 py-lg-6">
        <div className="container">
          <div className="home-hero-grid">
            <div className="hero-panel hero-copy home-hero-main">
              <p className="eyebrow text-uppercase mb-3">Dashboard</p>
              <h1 className="display-4 mb-3">Choose what to play with better answers, not just better cover art.</h1>
              <p className="lead text-secondary-emphasis mb-4">
                PlayWise turns game discovery into a full decision workflow. Browse a title, check whether it fits your PC,
                understand whether it matches your taste, and make a smarter decision before you buy or download.
              </p>

              <div className="home-cta-row mb-4">
                <a href="#discover" className="btn btn-brand btn-lg rounded-pill px-4">
                  Browse games
                </a>
                <Link to="/open-source" className="btn btn-outline-dark btn-lg rounded-pill px-4">
                  Explore free alternatives
                </Link>
              </div>

              <div className="home-chip-row mb-4">
                {DECISION_CHIPS.map((chip) => (
                  <span key={chip} className="home-chip">
                    {chip}
                  </span>
                ))}
              </div>

              <div className="home-metric-strip">
                {heroStats.map((item) => (
                  <article key={item.label} className="home-metric-card">
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </article>
                ))}
              </div>
            </div>

            <div className="home-hero-rail">
              <article
                key={spotlightGame?.slug || 'spotlight'}
                className="home-spotlight-card featured-glow-card spotlight-clickable"
                style={{ backgroundImage: spotlightBackground }}
                role="link"
                tabIndex={0}
                aria-label={spotlightGame ? `Open ${spotlightGame.title}` : 'Open featured game'}
                onClick={handleSpotlightOpen}
                onKeyDown={handleSpotlightKeyDown}
              >
                <div className="home-spotlight-content">
                  <div className="home-spotlight-top">
                    <span className="home-spotlight-label">Featured spotlight</span>
                    <span className="home-spotlight-status">{spotlightGame?.bugStatus?.label || 'Top pick'}</span>
                  </div>

                  <div className="home-spotlight-body">
                    <h2 className="home-spotlight-title">{spotlightGame?.title || 'PlayWise pick'}</h2>
                    <p className="home-spotlight-copy">
                      {spotlightGame?.heroTag || 'Jump into a richer game profile with compatibility, ratings, and value context.'}
                    </p>
                    {spotlightGame ? (
                      <div className="home-spotlight-tags">
                        {spotlightGame.genre.slice(0, 2).map((genre) => (
                          <span key={genre} className="home-spotlight-tag">
                            {genre}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {spotlightPool.length ? (
                    <div className="home-spotlight-footer">
                      <small className="home-spotlight-rotation-text">Top featured games</small>
                      <div className="home-spotlight-dots" role="tablist" aria-label="Featured spotlight rotation">
                        {spotlightPool.map((game, index) => (
                          <button
                            key={game.slug}
                            type="button"
                            className={`home-spotlight-dot ${index === spotlightIndex ? 'active' : ''}`}
                            aria-label={`Show ${game.title}`}
                            aria-pressed={index === spotlightIndex}
                            onClick={(event) => {
                              event.stopPropagation()
                              setSpotlightIndex(index)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="pb-5">
        <div className="container">
          <div className="section-banner home-catalog-banner">
            <div>
              <p className="eyebrow text-uppercase mb-2">Catalog overview</p>
              <h2 className="h2 mb-2">Browse games with decision-ready context, not just store-page noise.</h2>
              <p className="text-secondary-emphasis mb-0">
                Every title in PlayWise is framed around what matters most to players: hardware fit, optimization quality,
                long-term value, and whether it actually suits the kind of experience they want.
              </p>
            </div>
            <div className="home-catalog-summary">
              <strong>{filteredGames.length}</strong>
              <span>{activeSearch ? `matching "${activeSearch}"` : 'games in the active catalog'}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="discover" className="pb-5 anchor-section">
        <div className="container">
          {filteredGames.length ? (
            <div className="row g-4">
              {filteredGames.map((game) => (
                <div key={game.slug} className="col-md-6 col-xl-4">
                  <GameCard game={game} />
                </div>
              ))}
            </div>
          ) : (
            <div className="feature-card empty-state-card">
              <p className="eyebrow text-uppercase mb-2">No results found</p>
              <h2 className="h3 mb-2">Try a different title, genre, or keyword.</h2>
              <p className="text-secondary-emphasis mb-0">
                PlayWise searches across game names, genres, summaries, and discovery tags, so a broader search usually helps.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="pb-5">
        <div className="container">
          <div className="section-heading mb-4">
            <p className="eyebrow text-uppercase mb-2">Why choose us?</p>
            <h2 className="h2 mb-2">PlayWise is designed to remove guesswork from game decisions.</h2>
            <p className="text-secondary-emphasis mb-0">
              These are the core advantages that make the platform more useful than a typical game listing page.
            </p>
          </div>
          <div className="row g-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="col-lg-4">
                <article className="feature-card h-100">
                  <p className="eyebrow text-uppercase mb-2">{feature.eyebrow}</p>
                  <h3 className="h4 mb-3">{feature.title}</h3>
                  <p className="text-secondary-emphasis mb-0">{feature.description}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-5">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="feature-card featured-glow-card h-100">
                <p className="eyebrow text-uppercase mb-2">Featured paid games</p>
                <h2 className="h3 mb-3">Story-rich picks with better purchase context.</h2>
                <p className="text-secondary-emphasis mb-4">
                  Premium games still need smarter decision support, especially when players care about value, optimization,
                  and long-term replayability.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  {featuredGames.slice(0, 5).map((game) => (
                    <Link key={game.slug} to={`/games/${game.slug}`} className="btn btn-outline-dark rounded-pill">
                      {game.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="feature-card featured-glow-card h-100">
                <p className="eyebrow text-uppercase mb-2">Open-source spotlight</p>
                <h2 className="h3 mb-3">Legit free games belong in the same decision flow.</h2>
                <p className="text-secondary-emphasis mb-4">
                  PlayWise treats open-source games as serious alternatives, so users can compare quality options without
                  leaving the platform.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  {openSourceGames.slice(0, 5).map((game) => (
                    <Link key={game.slug} to={`/games/${game.slug}`} className="btn btn-outline-dark rounded-pill">
                      {game.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="pb-5 anchor-section">
        <div className="container">
          <div className="row g-4 align-items-start">
            <div className="col-lg-5">
              <div className="feature-card h-100">
                <p className="eyebrow text-uppercase mb-2">Contact</p>
                <h2 className="h3 mb-3">Send feedback or project suggestions.</h2>
                <p className="text-secondary-emphasis mb-0">
                  The form is API-backed with validation, so it behaves like a real product workflow instead of a static
                  portfolio placeholder.
                </p>
              </div>
            </div>
            <div className="col-lg-7">
              <form className="feature-card" onSubmit={handleContactSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Name</label>
                    <input
                      className="form-control form-control-lg rounded-4"
                      value={contactForm.name}
                      onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Email</label>
                    <input
                      type="email"
                      className="form-control form-control-lg rounded-4"
                      value={contactForm.email}
                      onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Message</label>
                    <textarea
                      rows="5"
                      className="form-control form-control-lg rounded-4"
                      value={contactForm.message}
                      onChange={(event) => setContactForm((current) => ({ ...current, message: event.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mt-4">
                  <button type="submit" className="btn btn-brand btn-lg rounded-pill px-4" disabled={isSending}>
                    {isSending ? 'Sending...' : 'Send message'}
                  </button>
                  {contactStatus.message ? (
                    <div className={`alert alert-${contactStatus.tone} mb-0 py-2 px-3 rounded-4`}>
                      {contactStatus.message}
                    </div>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
