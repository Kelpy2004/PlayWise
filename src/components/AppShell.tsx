import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { getAllGames } from '../lib/catalog'
import { api, getCachedCatalogSnapshot } from '../lib/api'
import { trackEvent } from '../lib/telemetry'
import type { GameRecord } from '../types/catalog'
import SiteAssistant from './SiteAssistant'

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
          isActive ? 'text-[#b1fa50]' : 'text-white/58 hover:text-white'
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
  const location = useLocation()
  const navigate = useNavigate()
  
  // Conditionally hide footer for game pages
  const isGamePage = location.pathname.startsWith('/games/');
  
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
    <div className="min-h-screen overflow-x-clip bg-[#060806] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#b1fa50]/15 bg-[#0e0e0e]/80 shadow-[0_0_40px_rgba(177,250,80,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-[1920px] items-center gap-3 px-4 sm:gap-4 sm:px-6 xl:px-8">
          <NavLink to="/" className="flex shrink-0 items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden bg-[#b1fa50] text-[#081003] shadow-[0_0_20px_rgba(177,250,80,0.2)] [clip-path:polygon(0_0,100%_0,86%_100%,0_100%)]">
              <span className="material-symbols-outlined text-lg font-black">bolt</span>
            </span>
            <span className="font-display text-2xl font-black italic tracking-[-0.05em] text-white">
              Play<span className="text-[#b1fa50]">Wise</span>
            </span>
          </NavLink>

          <nav className="hidden min-w-0 flex-1 items-center gap-5 pl-6 xl:gap-7 lg:flex">
            <div className="relative flex h-20 items-center">
              <button
                type="button"
                className="flex items-center gap-1 border-b-2 border-[#b1fa50] pb-1 text-sm font-semibold text-[#b1fa50]"
                onClick={() => setIsGamesMenuOpen((current) => !current)}
              >
                Games
                <span className="material-symbols-outlined text-base">{isGamesMenuOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</span>
              </button>
              <div
                className={`fixed left-1/2 top-20 z-50 w-[min(95vw,1040px)] -translate-x-1/2 rounded-[26px] border border-[#b1fa50]/18 bg-[#171717]/95 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-all duration-200 xl:absolute xl:left-0 xl:top-full xl:w-[1040px] xl:translate-x-0 ${
                  isGamesMenuOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
                }`}
              >
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_240px_1fr]">
                  <div className="space-y-7">
                    <div className="space-y-3">
                      <p className="border-b border-white/10 pb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#b1fa50]">Browse by category</p>
                      {browseCategories.map((category) => (
                        <button key={category} type="button" className="block text-left text-sm text-white/64 transition-colors hover:text-white" onClick={() => handleCatalogBrowse(category.toLowerCase())}>
                          {category}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <p className="border-b border-white/10 pb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#b1fa50]">Browse by platform</p>
                      {browsePlatforms.map((platform) => (
                        <button key={platform} type="button" className="block text-left text-sm text-white/64 transition-colors hover:text-white" onClick={() => handleCatalogBrowse(platform.toLowerCase())}>
                          {platform}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="rounded-full bg-[#b1fa50] px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[#091100] transition-transform hover:-translate-y-0.5"
                      onClick={() => handleCatalogBrowse('')}
                    >
                      View all games
                    </button>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <p className="border-b border-white/10 pb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#b1fa50]">Browse by game</p>
                      <div className="grid gap-2">
                        {topMenuGames.map((game) => (
                          <button key={game.slug} type="button" className="text-left text-sm text-white/66 transition-colors hover:text-white" onClick={() => handleMenuGameOpen(game.slug)}>
                            {game.title}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 pt-2">
                      <button type="button" className="flex items-center gap-2 text-left text-sm font-semibold text-white transition-colors hover:text-[#b1fa50]" onClick={() => navigate('/games?view=wishlist')}>
                        <span className="material-symbols-outlined text-sm">favorite</span>
                        Wishlist
                      </button>
                      <button type="button" className="text-left text-sm text-white/64 transition-colors hover:text-white" onClick={() => navigate('/games')}>
                        Library
                      </button>
                      <button type="button" className="text-left text-sm text-white/64 transition-colors hover:text-white" onClick={() => navigate('/games?sort=popular')}>
                        Recommendations
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#b1fa50]">Most popular</p>
                      <button type="button" className="text-[10px] font-black uppercase tracking-[0.18em] text-white/52 transition-colors hover:text-white" onClick={() => navigate('/games?sort=popular')}>
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
                            <p className="line-clamp-2 text-sm font-semibold text-white">{game.title}</p>
                            <p className="mt-1 text-[11px] text-white/44">{(game.platform || game.supportedPlatforms || ['PlayWise']).slice(0, 1).join('')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button type="button" className="text-sm font-medium text-white/58 transition-colors hover:text-white" onClick={() => handleSectionJump('tournaments')}>
              Tournaments
            </button>
            <button type="button" className="text-sm font-medium text-white/58 transition-colors hover:text-white" onClick={() => navigate('/games')}>
              Store
            </button>
            <button type="button" className="text-sm font-medium text-white/58 transition-colors hover:text-white" onClick={() => handleSectionJump('precision')}>
              News
            </button>
            <button type="button" className="text-sm font-medium text-white/58 transition-colors hover:text-white" onClick={() => navigate('/games?view=wishlist')}>
              Library
            </button>
            {user?.role === 'admin' ? <ShellLink to="/admin/hardware">Hardware</ShellLink> : null}
          </nav>

          <div className="ml-auto flex shrink-0 items-center justify-end gap-2 sm:gap-3">
            <form className="hidden items-center gap-2 2xl:flex" onSubmit={handleSearchSubmit}>
              <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-transparent px-3 py-2 text-white/64 transition-colors hover:border-[#b1fa50]/20 hover:text-white">
                <input
                  type="search"
                  value={searchText}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  className="w-28 border-none bg-transparent p-0 font-mono text-xs uppercase tracking-[0.14em] text-white outline-none placeholder:text-white/42 focus:ring-0 2xl:w-40"
                />
                <SearchMark />
              </div>
            </form>

            {isLoading ? (
              <span className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                Restoring
              </span>
            ) : user ? (
              <>
                <span className="hidden rounded-lg border border-[#b1fa50]/15 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 sm:inline-flex">
                  {user.username}
                </span>
                <button
                  type="button"
                  className="rounded-lg border border-white/12 px-4 py-2 text-xs font-semibold text-white/72 transition-colors hover:text-white"
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
                  className="whitespace-nowrap rounded-lg bg-[#b1fa50] px-4 py-2 text-xs font-black text-[#111a02] shadow-[0_0_24px_rgba(177,250,80,0.22)] transition-transform hover:-translate-y-0.5 sm:px-5"
                >
                  Join Pro
                </NavLink>
                <NavLink
                  to="/login"
                  state={{
                    backgroundLocation: location,
                    from: `${location.pathname}${location.search}${location.hash}`
                  }}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold text-white/72 transition-colors hover:text-white sm:px-4"
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

      {/* Conditionally render the global footer based on route */}
      {isGamePage ? null : (
        <footer className="border-t border-white/6 bg-[#000000]">
          <div className="mx-auto max-w-[1600px] px-4 py-16 sm:px-6 xl:px-8">
            <div className="grid gap-12 xl:grid-cols-[1.5fr_0.75fr_0.75fr_1.15fr]">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center overflow-hidden bg-[#b1fa50] text-[#081003] [clip-path:polygon(0_0,100%_0,86%_100%,0_100%)]">
                    <span className="material-symbols-outlined text-sm">bolt</span>
                  </span>
                  <strong className="font-display text-2xl text-white">PlayWise</strong>
                </div>
                <p className="max-w-sm text-[1.05rem] leading-8 text-white/55">
                  Decision intelligence platform for the next generation of gamers. PlayWise Obsidian Engine v4.2
                </p>
                <div className="mt-6 flex items-center gap-4 text-white/55">
                  <span className="material-symbols-outlined text-xl">public</span>
                  <span className="material-symbols-outlined text-xl">alternate_email</span>
                  <span className="material-symbols-outlined text-xl">groups</span>
                </div>
              </div>

              <div>
                <p className="mb-4 text-[11px] font-black uppercase tracking-[0.24em] text-white">Ecosystem</p>
                <div className="flex flex-col gap-3 text-[1.05rem] text-white/58">
                  <button type="button" className="text-left transition-colors hover:text-[#b1fa50]" onClick={() => handleSectionJump('trending')}>
                    Global Rankings
                  </button>
                  <button type="button" className="text-left transition-colors hover:text-[#b1fa50]" onClick={() => navigate('/games')}>
                    Developer Portal
                  </button>
                  <button type="button" className="text-left transition-colors hover:text-[#b1fa50]" onClick={() => handleSectionJump('discover')}>
                    Support Center
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-4 text-[11px] font-black uppercase tracking-[0.24em] text-white">Legal</p>
                <div className="flex flex-col gap-3 text-[1.05rem] text-white/58">
                  <span>Privacy Policy</span>
                  <span>Terms of Service</span>
                  <span>Community Guidelines</span>
                </div>
              </div>

              <div className="flex flex-col justify-between xl:items-end xl:text-right">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#47506a]">© 2024 PlayWise Interactive. All rights reserved.</p>
                <div className="mt-10 xl:mt-20">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-white/32">System Status</p>
                  <p className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-[0.08em] text-[#b1fa50]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#8fd22d]" />
                    PlayWise systems operational
                  </p>
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
