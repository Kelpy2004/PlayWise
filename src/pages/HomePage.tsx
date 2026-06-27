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
import IndustryNewsSection from '../components/IndustryNewsSection'
import SignalModules from '../components/SignalModules'
import FeaturesSection from '../components/FeaturesSection'
import StarsLayer from '../components/StarsLayer'
import MountainsLayer from '../components/MountainsLayer'
import PetalsLayer from '../components/PetalsLayer'

import type { GameRecord } from '../types/catalog'

// Intro plays once per fresh browser session. sessionStorage survives
// F5 refresh and SPA navigation but clears when the tab/browser closes,
// so the next fresh open replays it.
const INTRO_FLAG_KEY = 'playwise:intro-played'

function hasIntroAlreadyPlayed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(INTRO_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function markIntroPlayed(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(INTRO_FLAG_KEY, '1')
  } catch {
    /* sessionStorage blocked (private mode, etc.) — just play intro again */
  }
}

export default function HomePage() {
  const [introPlayed, setIntroPlayed] = useState(hasIntroAlreadyPlayed)
  const [siteRevealed, setSiteRevealed] = useState(introPlayed)
  const { token } = useAuth()
  const navigate = useNavigate()

  // Load live data from API
  const [catalogGames, setCatalogGames] = useState<GameRecord[]>(() => getAllGames())
  const [stats, setStats] = useState({ gameCount: 0, dealCount: 0, freeCount: 0, storeCount: 0, stores: [] as string[], tournamentCount: 0 })

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
        const s = await api.fetchStats()
        if (!ignore && s) setStats(s)
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
    markIntroPlayed()
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

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <>
      <Seo
        title="PlayWise | Decide Before You Download"
        description="Game deals from Steam, Epic, Xbox, and Ubisoft in one place. Free games, price drops, tournaments, and PC compatibility checks — no more site hopping."
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

        {/* Hero with live stats */}
        <Hero
          gameCount={stats.gameCount || catalogGames.length}
          dealCount={stats.dealCount}
          freeCount={stats.freeCount}
          storeCount={stats.storeCount}
          stores={stats.stores}
          tournamentCount={stats.tournamentCount}
        />

        {/* Trending — live deals from API */}
        <TrendingSection />

        {/* Industry News — latest from Steam, Xbox, NVIDIA, Epic, Ubisoft, EA */}
        <IndustryNewsSection />

        {/* Signal Modules — interactive compatibility & price tracking */}
        <SignalModules />

        {/* Features bento grid — closing value prop */}
        <FeaturesSection />
      </div>
    </>
  )
}
