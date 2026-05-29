import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { getAllGames } from '../lib/catalog'
import { api, getCachedCatalogSnapshot } from '../lib/api'
import { trackEvent } from '../lib/telemetry'
import type { GameRecord } from '../types/catalog'
import SiteAssistant from './SiteAssistant'
import Logo from './Logo'
import Footer from './Footer'

function SearchMark() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="h-4 w-4">
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ShellLink({
  to,
  children
}: {
  to: string
  children: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'relative px-2 py-1 text-sm font-medium tracking-wide transition-colors',
          isActive ? 'text-cyan' : 'text-[var(--muted)] hover:text-[var(--text)]'
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}

function menuGameScore(game: GameRecord) {
  return typeof game.averageRating === 'number' ? game.averageRating : game.valueRating?.score || 0
}

export default function AppShell() {
  const [searchText, setSearchText] = useState('')
  const [searchWordIndex, setSearchWordIndex] = useState(0)
  const [isGamesMenuOpen, setIsGamesMenuOpen] = useState(false)
  const { user, isLoading, logout, token } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  
  const isGamePage = location.pathname.startsWith('/games/')
  const gamesMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openGamesMenu = useCallback(() => {
    if (gamesMenuTimer.current) { clearTimeout(gamesMenuTimer.current); gamesMenuTimer.current = null }
    setIsGamesMenuOpen(true)
  }, [])

  const scheduleCloseGamesMenu = useCallback(() => {
    if (gamesMenuTimer.current) clearTimeout(gamesMenuTimer.current)
    gamesMenuTimer.current = setTimeout(() => setIsGamesMenuOpen(false), 180)
  }, [])
  
  const searchWords = useMemo(() => ['Games', 'Library', 'Tournaments', 'Prices'], [])
  const [catalogGames, setCatalogGames] = useState<GameRecord[]>(() => getCachedCatalogSnapshot() || getAllGames())
  const browseCategories = useMemo(() => ['Featured', 'New Releases', 'Top Rated', 'Free to Play'], [])
  const browsePlatforms = useMemo(() => ['PC', 'Xbox', 'PlayStation', 'Nintendo Switch', 'Virtual reality', 'Mobile'], [])
  const topMenuGames = useMemo(
    () => [...catalogGames].sort((left, right) => menuGameScore(right) - menuGameScore(left)).slice(0, 10),
    [catalogGames]
  )
  const popularMenuGames = useMemo(
    () => [...catalogGames].sort((left, right) => (right.popularityScore || 0) - (left.popularityScore || 0)).slice(0, 3),
    [catalogGames]
  )
  const searchPlaceholder = useMemo(() => `Search ${searchWords[searchWordIndex] || 'games'}`, [searchWordIndex, searchWords])

  useEffect(() => {
    let ignore = false
    async function loadCatalogForNavbar() {
      try {
        const response = await api.fetchGames()
        if (!ignore && Array.isArray(response) && response.length) {
          setCatalogGames(response)
        }
      } catch {
        // Keep local fallback catalog.
      }
    }
    void loadCatalogForNavbar()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setSearchText(params.get('q') || '')
  }, [location.search])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSearchWordIndex((current) => (current + 1) % searchWords.length)
    }, 2200)

    return () => window.clearInterval(intervalId)
  }, [searchWords])

  useEffect(() => {
    void trackEvent(
      {
        category: 'navigation',
        action: 'page_view',
        label: location.pathname,
        meta: { search: location.search, hash: location.hash }
      },
      token
    )
  }, [location.hash, location.pathname, location.search, token])

  useEffect(() => {
    if (!location.hash) {
      return undefined
    }

    const sectionId = location.hash.replace('#', '')
    const frameId = window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionId)
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [location.hash, location.pathname])

  useEffect(() => {
    setIsGamesMenuOpen(false)
  }, [location.hash, location.pathname, location.search])

  function updateHomeSearch(value: string, replace = true) {
    const params = new URLSearchParams()
    const trimmed = value.trim()

    if (trimmed) {
      params.set('q', trimmed)
    }

    navigate(
      {
        pathname: '/games',
        search: params.toString() ? `?${params.toString()}` : ''
      },
      { replace }
    )
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateHomeSearch(searchText, false)

    if (searchText.trim()) {
      void trackEvent(
        {
          category: 'discovery',
          action: 'navbar_search_submit',
          label: searchText.trim()
        },
        token
      )
    }
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value
    setSearchText(nextValue)

    if (location.pathname === '/games') {
      updateHomeSearch(nextValue, true)
    }
  }

  function handleSectionJump(sectionId: string) {
    const section = document.getElementById(sectionId)

    if (location.pathname === '/' && section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    navigate({ pathname: '/', hash: sectionId })
  }

  function handleCatalogBrowse(query = '') {
    setIsGamesMenuOpen(false)
    updateHomeSearch(query, false)
  }

  function handleMenuGameOpen(slug: string) {
    setIsGamesMenuOpen(false)
    navigate(`/games/${slug}`)
  }

  return (
    <div className="min-h-screen overflow-x-clip text-[var(--text)] transition-colors" style={{ background: 'var(--deep)', transitionDuration: 'var(--transition-theme)' }}>
      <header
        className="fixed inset-x-0 top-0 z-[100] border-b backdrop-blur-[24px] saturate-[1.6] transition-all"
        style={{
          borderColor: theme === 'dark' ? 'rgba(0,212,255,0.15)' : 'rgba(0,136,187,0.12)',
          background: theme === 'dark' ? 'rgba(14,14,14,0.8)' : 'rgba(250,247,242,0.88)',
          boxShadow: theme === 'dark' ? '0 0 40px rgba(0,212,255,0.08)' : '0 4px 24px rgba(0,0,0,0.06)',
          transitionDuration: 'var(--transition-theme)',
        }}
      >
        <div className="mx-auto flex h-20 w-full max-w-[1920px] items-center gap-3 px-4 sm:gap-4 sm:px-6 xl:px-8">
          <NavLink to="/" className="flex shrink-0 items-center gap-[10px]">
            <div className="w-9 h-9 rounded-[9px] grid place-items-center overflow-hidden shadow-[0_0_16px_rgba(0,180,255,0.2)]" style={{ background: theme === 'dark' ? '#0a1628' : '#e8f4ff' }}>
              <Logo size={28} />
            </div>
            <span className="font-extrabold text-[1.35rem] tracking-tight text-[var(--text)]">
              Play<span className="text-cyan">Wise</span>
            </span>
          </NavLink>

          <nav className="hidden min-w-0 flex-1 items-center gap-5 pl-6 xl:gap-7 lg:flex">
            <div className="relative flex h-20 items-center" onMouseEnter={openGamesMenu} onMouseLeave={scheduleCloseGamesMenu}>
              <button
                type="button"
                className="flex items-center gap-1 border-b-2 border-cyan pb-1 text-sm font-semibold text-cyan"
                onClick={() => setIsGamesMenuOpen((current) => !current)}
              >
                Games
                <span className="material-symbols-outlined text-base">{isGamesMenuOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
              </button>
              <AnimatePresence>
              {isGamesMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={openGamesMenu}
                onMouseLeave={scheduleCloseGamesMenu}
                className="fixed left-1/2 top-20 z-50 w-[min(95vw,1040px)] -translate-x-1/2 rounded-[26px] border border-cyan/18 p-6 backdrop-blur-2xl xl:absolute xl:left-0 xl:top-full xl:w-[1040px] xl:translate-x-0"
                style={{
                  background: theme === 'dark' ? 'rgba(17,17,17,0.9)' : 'rgba(250,247,242,0.95)',
                  boxShadow: theme === 'dark'
                    ? '0 28px 80px rgba(0,0,0,0.55), 0 0 60px rgba(0,212,255,0.04)'
                    : '0 28px 80px rgba(0,0,0,0.12), 0 0 30px rgba(0,212,255,0.02)',
                }}
              >
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_240px_1fr]">
                  <div className="space-y-7">
                    <div className="space-y-3">
                      <p className="border-b border-[var(--border)] pb-3 text-[10px] font-black uppercase tracking-[0.22em] text-cyan">Browse by category</p>
                      {browseCategories.map((category) => (
                        <button key={category} type="button" className="block text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => handleCatalogBrowse(category.toLowerCase())}>
                          {category}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <p className="border-b border-[var(--border)] pb-3 text-[10px] font-black uppercase tracking-[0.22em] text-cyan">Browse by platform</p>
                      {browsePlatforms.map((platform) => (
                        <button key={platform} type="button" className="block text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => handleCatalogBrowse(platform.toLowerCase())}>
                          {platform}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-cyan px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white transition-transform hover:-translate-y-0.5"
                      onClick={() => handleCatalogBrowse('')}
                    >
                      View all games
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="border-b border-[var(--border)] pb-3 text-[10px] font-black uppercase tracking-[0.22em] text-cyan">Browse by game</p>
                      <div className="grid gap-2">
                        {topMenuGames.map((game) => (
                          <button key={game.slug} type="button" className="text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => handleMenuGameOpen(game.slug)}>
                            {game.title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 pt-2">
                      <button type="button" className="flex items-center gap-2 text-left text-sm font-semibold text-[var(--text)] transition-colors hover:text-cyan" onClick={() => navigate('/games?view=wishlist')}>
                        <span className="material-symbols-outlined text-sm">favorite</span>
                        Wishlist
                      </button>
                      <button type="button" className="text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => navigate('/games')}>
                        Library
                      </button>
                      <button type="button" className="text-left text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => navigate('/games?sort=popular')}>
                        Recommendations
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan">Most popular</p>
                      <button type="button" className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => navigate('/games?sort=popular')}>
                        View all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {popularMenuGames.map((game) => (
                        <button
                          key={game.slug}
                          type="button"
                          className="overflow-hidden rounded-[18px] bg-white/[0.03] text-left transition-transform hover:-translate-y-1"
                          onClick={() => handleMenuGameOpen(game.slug)}
                        >
                          <div
                            className="aspect-[1.02] bg-no-repeat"
                            style={{
                              backgroundImage: `linear-gradient(180deg, rgba(12,12,12,0.06), rgba(12,12,12,0.45)), url('${game.image || game.banner || ''}')`,
                              backgroundSize: 'contain',
                              backgroundPosition: 'center',
                              backgroundColor: 'rgba(9, 14, 9, 0.85)'
                            }}
                          />
                          <div className="p-3">
                            <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">{game.title}</p>
                            <p className="mt-1 text-[11px] text-[var(--muted)]">{(game.platform || game.supportedPlatforms || ['PlayWise']).slice(0, 1).join('')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
              )}
              </AnimatePresence>
            </div>
            <button type="button" className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => handleSectionJump('tournaments')}>
              Tournaments
            </button>
            <button type="button" className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => navigate('/deals')}>
              Deals
            </button>
            <button type="button" className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => navigate('/news')}>
              News
            </button>
            <button type="button" className="text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]" onClick={() => navigate('/games?view=wishlist')}>
              Library
            </button>
            {user?.role === 'admin' ? <ShellLink to="/admin/hardware">Hardware</ShellLink> : null}
          </nav>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-2 sm:gap-3">
            {/* Dark / Light theme toggle */}
            <div
              onClick={toggleTheme}
              role="button"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative w-14 h-7 rounded-full cursor-pointer overflow-hidden border transition-all"
              style={{
                background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
                borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(120,90,40,0.15)',
                transitionDuration: 'var(--transition-theme)',
              }}
            >
              {/* Stars (dark mode) */}
              <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: theme === 'dark' ? 1 : 0 }}>
                <span className="absolute w-[1.5px] h-[1.5px] bg-white rounded-full" style={{ top: '6px', left: '36px' }} />
                <span className="absolute w-0.5 h-0.5 bg-white rounded-full" style={{ top: '14px', left: '42px' }} />
                <span className="absolute w-[1px] h-[1px] bg-white rounded-full" style={{ top: '20px', left: '34px' }} />
              </div>
              {/* Knob (moon / sun) */}
              <div
                className="absolute top-[3px] w-[22px] h-[22px] rounded-full z-[2] transition-all duration-500"
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.68,-0.55,0.265,1.55)',
                  left: theme === 'dark' ? '3px' : '31px',
                  background: theme === 'dark' ? '#c8dcff' : '#ffd54f',
                  boxShadow: theme === 'dark'
                    ? '0 0 12px rgba(200,220,255,0.6), inset -3px -1px 0 rgba(100,120,160,0.4)'
                    : '0 0 16px rgba(255,213,79,0.7)',
                }}
              />
            </div>

            <form className="hidden items-center gap-2 2xl:flex" onSubmit={handleSearchSubmit}>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[var(--muted)] transition-all duration-300 hover:border-cyan/25 hover:text-[var(--text)] focus-within:border-cyan/40 focus-within:shadow-[0_0_20px_rgba(0,212,255,0.1)]">
                <input
                  type="search"
                  value={searchText}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-28 border-none bg-transparent p-0 font-mono text-xs uppercase tracking-[0.14em] text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:ring-0 2xl:w-40"
                />
                <SearchMark />
              </div>
            </form>

            {isLoading ? (
              <span className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Restoring
              </span>
            ) : user ? (
              <>
                <span className="hidden rounded-lg border border-cyan/15 bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)] sm:inline-flex">
                  {user.username}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                  onClick={() => {
                    void trackEvent({ category: 'auth', action: 'logout', label: user.username }, token)
                    logout()
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/register"
                  state={{
                    backgroundLocation: location,
                    from: `${location.pathname}${location.search}${location.hash}`
                  }}
                  className="whitespace-nowrap rounded-lg bg-cyan px-4 py-2 text-xs font-black text-white shadow-[0_0_24px_rgba(0,212,255,0.22)] transition-transform hover:-translate-y-0.5 sm:px-5"
                >
                  Join Pro
                </NavLink>
                <NavLink
                  to="/login"
                  state={{
                    backgroundLocation: location,
                    from: `${location.pathname}${location.search}${location.hash}`
                  }}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:px-4"
                >
                  Login
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="pt-20">
        <Outlet />
      </main>

      <SiteAssistant />

      {/* Footer — hide on individual game pages */}
      {isGamePage ? null : <Footer />}
    </div>
  )
}
