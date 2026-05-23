import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { getAllGames } from '../lib/catalog'
import { trackEvent } from '../lib/telemetry'
import Seo from '../components/Seo'

import CinematicIntro from '../components/CinematicIntro'
import Hero from '../components/Hero'
import TrendingSection from '../components/TrendingSection'
import SignalModules from '../components/SignalModules'
import FeaturesSection from '../components/FeaturesSection'
import TournamentsSection from '../components/TournamentsSection'
import CTASection from '../components/CTASection'
import StarsLayer from '../components/StarsLayer'
import MountainsLayer from '../components/MountainsLayer'
import PetalsLayer from '../components/PetalsLayer'

import type { GameRecord } from '../types/catalog'
import type { TournamentRecord } from '../types/api'

// Module-level flag — survives React re-renders / route navigations
// but resets on full page reload (F5 / Ctrl-R), so the intro replays.
let introHasPlayedThisLoad = false

export default function HomePage() {
  const [introPlayed, setIntroPlayed] = useState(() => introHasPlayedThisLoad)
  const [siteRevealed, setSiteRevealed] = useState(introPlayed)
  const { token } = useAuth()
  const navigate = useNavigate()

  // Load live data from API
  const [catalogGames, setCatalogGames] = useState<GameRecord[]>(() => getAllGames())
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([])
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState({ tone: 'info', message: '' })

  useEffect(() => {
    let ignore = false

    async function loadData() {
      try {
        const games = await api.fetchGames()
        if (!ignore && Array.isArray(games) && games.length) {
          setCatalogGames(games)
        }
      } catch {
        if (!ignore) setCatalogGames(getAllGames())
      }

      try {
        const tourns = await api.fetchTournaments({ limit: 6 })
        if (!ignore && Array.isArray(tourns)) {
          setTournaments(tourns)
        }
      } catch {
        // keep defaults
      }
    }

    void loadData()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    void trackEvent(
      { category: 'navigation', action: 'page_view', label: '/' },
      token
    )
  }, [token])

  // Called mid-animation when main site should start fading in.
  // Do NOT set introPlayed here — that would unmount CinematicIntro mid-flight.
  const handleIntroReveal = useCallback(() => {
    setSiteRevealed(true)
    introHasPlayedThisLoad = true
  }, [])

  // Called after the full intro animation (morph, dissolve, cleanup) finishes.
  const handleIntroDone = useCallback(() => {
    setIntroPlayed(true)
  }, [])

  // Skip intro if already played this session
  useEffect(() => {
    if (introPlayed) {
      setSiteRevealed(true)
    }
  }, [introPlayed])

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
      setNewsletterStatus({ tone: 'bad', message: error instanceof Error ? error.message : 'Could not subscribe.' })
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <>
      <Seo
        title="PlayWise | Decide Before You Download"
        description="PlayWise helps players compare games, check hardware compatibility, and decide if a title matches their PC, budget, and playstyle."
        url={origin ? `${origin}/` : undefined}
      />

      {/* Cinematic intro — only on first visit this session */}
      {!introPlayed && <CinematicIntro onComplete={handleIntroReveal} onDone={handleIntroDone} />}

      <div
        style={{
          opacity: siteRevealed ? 1 : 0,
          transform: siteRevealed ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <StarsLayer />
        <MountainsLayer />
        <PetalsLayer />

        {/* Hero with live game count */}
        <Hero gameCount={catalogGames.length} />

        {/* Trending — live games from API */}
        <TrendingSection games={catalogGames} onViewGame={(slug) => navigate(`/games/${slug}`)} />

        {/* Signal Modules — interactive compatibility & price tracking */}
        <SignalModules />

        {/* Features bento grid */}
        <FeaturesSection />

        {/* Tournaments — live data from API */}
        <TournamentsSection tournaments={tournaments} />

        {/* Newsletter subscribe */}
        <section className="bg-[var(--deep)] px-[clamp(1rem,5vw,6rem)] py-16" id="newsletter">
          <div className="mx-auto max-w-[980px] rounded-2xl border border-border bg-panel p-8 md:p-10">
            <p className="mb-2 text-[0.72rem] font-black uppercase tracking-[0.22em] text-cyan">Newsletter Uplink</p>
            <h3 className="text-[clamp(1.8rem,3vw,2.5rem)] font-extrabold tracking-tight">Get weekly PlayWise updates</h3>
            <p className="mt-3 text-[0.92rem] text-muted">
              Subscribe for top value picks, tournament reminders, and major price-drop opportunities.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                className="flex-1 rounded-lg border border-border bg-input-bg px-4 py-3 text-sm text-[var(--text)] outline-none"
                placeholder="you@example.com"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void handleNewsletterSubscribe()}
                className="rounded-lg bg-cyan px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white"
              >
                Subscribe
              </button>
            </div>
            {newsletterStatus.message ? (
              <div
                className={`mt-4 rounded-lg px-3 py-2 text-xs ${
                  newsletterStatus.tone === 'good'
                    ? 'bg-green/[0.15] text-green'
                    : newsletterStatus.tone === 'bad'
                      ? 'bg-red/[0.15] text-red'
                      : 'bg-amber/[0.15] text-amber'
                }`}
              >
                {newsletterStatus.message}
              </div>
            ) : null}
          </div>
        </section>

        {/* CTA */}
        <CTASection />
      </div>
    </>
  )
}
