import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'

import Seo from '../components/Seo'
import { api } from '../lib/api'

/* ─────────────────── Store icon SVGs (small logos) ─────────────────── */

function SteamIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="white">
      <path d="M12 2a10 10 0 00-9.96 9.04l5.34 2.2a2.85 2.85 0 011.62-.5h.05l2.42-3.51V9.1a3.82 3.82 0 013.81-3.81 3.82 3.82 0 013.82 3.81 3.82 3.82 0 01-3.82 3.82h-.09l-3.45 2.46c0 .03.01.06.01.1a2.86 2.86 0 01-2.86 2.86 2.87 2.87 0 01-2.82-2.35L2.2 14.96A10 10 0 0012 22a10 10 0 000-20z"/>
    </svg>
  )
}

function EpicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="white">
      <path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.12c0 1.374.504 1.879 1.877 1.879h4.963v-2.32H5.02c-.474 0-.68-.206-.68-.68V7.02c0-.474.206-.68.68-.68h2.48V4H5.02c-.474 0-.68-.206-.68-.68V1.68c0-.474.206-.68.68-.68h3.48V0zm6.508 0v20h2.524v-8.24h3.39v-2.32h-3.39V2.32h4.2V0zm10.036 0c-1.374 0-1.877.506-1.877 1.879V18.12c0 1.374.503 1.879 1.877 1.879h2.282v-2.32h-.962c-.474 0-.68-.206-.68-.68V7.02c0-.474.206-.68.68-.68h.962V4h-.962c-.474 0-.68-.206-.68-.68V1.68c0-.474.206-.68.68-.68h.962V0z" transform="scale(0.9) translate(1.2, 2)"/>
    </svg>
  )
}

function XboxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="white">
      <path d="M6.43 4.65C5.04 5.74 3.29 8.31 4.13 11.44c.84 3.12 3.3 5.73 4.68 6.82.83.66 1.54.62 1.54.62s-.75-1.35-.71-2.15c.08-1.54 2.15-4.26 2.36-4.63.21-.36 2.28-3.09 2.36-4.63.04-.8-.71-2.15-.71-2.15s.71-.04 1.54.62c1.38 1.09 3.84 3.7 4.68 6.82.84 3.13-.91 5.7-2.3 6.79C17.57 20.55 14.15 22 12 22s-5.57-1.45-6.57-2.45c-1.39-1.09-3.14-3.66-2.3-6.79.84-3.12 3.3-5.73 4.68-6.82a9.22 9.22 0 012.19-1.3S8.3 5.02 8.3 5.02c-1.3.04-1.87-.37-1.87-.37zM12 2c2.39 0 4.55.88 6.22 2.33 0 0-.8.5-2.31.45 0 0-1.69-.44-3.91-.44s-3.91.44-3.91.44C6.58 4.83 5.78 4.33 5.78 4.33A9.96 9.96 0 0112 2z"/>
    </svg>
  )
}

function UbisoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="white">
      <path d="M23.561 12.669a11.479 11.479 0 00-2.56-7.487c-.21.39-.54.96-.88 1.53a9.87 9.87 0 011.88 5.957 9.83 9.83 0 01-9.96 9.84 9.83 9.83 0 01-9.96-9.84c0-3.57 1.89-6.59 4.62-8.37a14.93 14.93 0 00-.15 2.37c0 6.57 5.16 10.41 5.16 10.41s-.87-.72-1.17-1.65c-.3-.93-.15-2.22.72-3.69s2.16-3.39 2.16-5.13c0-1.17-.36-2.73-1.59-4.2C10.561.99 8.101 0 8.101 0s.72.42 1.11 1.23c.39.84.3 1.89-.27 2.61-.72.9-2.22 1.71-3.66 3.12C3.131 9.069 1.601 11.759 1.601 14.729a10.39 10.39 0 0010.44 10.35 10.39 10.39 0 0010.44-10.35c0-.72-.06-1.41-.18-2.06z" transform="scale(0.88) translate(1.5, 1)"/>
    </svg>
  )
}

function EAIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="white">
      <text x="12" y="16" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily="Arial,sans-serif">EA</text>
    </svg>
  )
}

function GFNIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="white">
      <path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
    </svg>
  )
}

function GOGIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="white">
      <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" fill="white"/>
    </svg>
  )
}

const STORE_ICONS: Record<string, () => JSX.Element> = {
  Steam: SteamIcon,
  'Epic Games Store': EpicIcon,
  Xbox: XboxIcon,
  'Ubisoft Store': UbisoftIcon,
  EA: EAIcon,
  'GeForce NOW': GFNIcon,
  GOG: GOGIcon,
}

/* ─────────────────── Sort & filter config ─────────────────── */

const SORT_OPTIONS = [
  { key: 'title',   label: 'A – Z' },
  { key: 'popular', label: 'Popular' },
  { key: 'rating',  label: 'Top Rated' },
  { key: 'newest',  label: 'Newest' },
] as const

const ITEMS_PER_PAGE = 36

type LibraryGame = {
  slug: string; title: string; year: number | null; heroTag: string | null
  genres: string[]; stores: string[]; platforms: string[]
  averageRating: number | null; popularityScore: number | null
  image: string | null; banner: string | null
  catalogBuckets: string[]; releaseTimestamp: string | null
  publisher: string | null
}

/* ─────────────────── Store icon pill (rendered inside image) ─────────────────── */

function StoreIconBadge({ store }: { store: string }) {
  const IconComponent = STORE_ICONS[store]
  if (!IconComponent) return null

  return (
    <div
      className="flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10"
      style={{ width: 24, height: 24 }}
      title={store}
    >
      <div className="w-[14px] h-[14px] opacity-90">
        <IconComponent />
      </div>
    </div>
  )
}

/* ─────────────────── Game card (NVIDIA layout) ─────────────────── */

function GameCard({ game }: { game: LibraryGame }) {
  const img = game.banner || game.image

  return (
    <Link
      to={`/games/${game.slug}`}
      className="group flex flex-col gap-2 text-left"
    >
      {/* Image container */}
      <div className="relative aspect-[460/215] w-full overflow-hidden rounded-md bg-[#161616]">
        {img ? (
          <img
            src={img}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#111]">
            <span className="text-4xl font-black text-white/[0.06] select-none">
              {game.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Subtle hover overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Store icons — bottom-right of image */}
        {game.stores.length > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            {game.stores.slice(0, 3).map(store => (
              <StoreIconBadge key={store} store={store} />
            ))}
          </div>
        )}

        {/* Rating — top-left (subtle) */}
        {game.averageRating != null && game.averageRating > 0 && (
          <div className="absolute left-2 top-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-black shadow-lg ${
              game.averageRating >= 8 ? 'bg-[#76b900]/90 text-black' :
              game.averageRating >= 6 ? 'bg-amber-500/90 text-black' :
              'bg-black/70 text-white/80 backdrop-blur-sm'
            }`}>
              {game.averageRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Text — below image */}
      <div className="flex flex-col gap-0.5 px-0.5">
        {/* Publisher */}
        {game.publisher && (
          <span className="text-[11px] leading-tight text-white/35 line-clamp-1">
            {game.publisher}
          </span>
        )}

        {/* Title */}
        <h3 className="text-[13px] font-bold leading-snug text-white/90 line-clamp-1 group-hover:text-white transition-colors">
          {game.title}
        </h3>

        {/* Year */}
        {game.year && (
          <span className="text-[10px] text-white/25">{game.year}</span>
        )}
      </div>
    </Link>
  )
}

/* ─────────────────── Pagination ─────────────────── */

function Pagination({
  page, totalPages, onPageChange
}: {
  page: number; totalPages: number; onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  const delta = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-12">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-25 disabled:cursor-not-allowed"
      >
        Prev
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="px-1 text-[11px] text-white/20">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
              p === page
                ? 'bg-white text-black'
                : 'border border-white/8 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/80'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/50 transition hover:bg-white/[0.06] hover:text-white/80 disabled:opacity-25 disabled:cursor-not-allowed"
      >
        Next
      </button>
    </div>
  )
}

/* ─────────────────── Page ─────────────────── */

export default function GamesBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [games, setGames] = useState<LibraryGame[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0 })
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [storeCounts, setStoreCounts] = useState<Array<{ name: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const currentPage = parseInt(searchParams.get('page') || '1') || 1
  const currentStore = searchParams.get('store') || ''
  const currentGenre = searchParams.get('genre') || ''
  const currentSort = searchParams.get('sort') || 'title'
  const currentQuery = searchParams.get('q') || ''

  const updateParams = useCallback((updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!('page' in updates)) next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await api.fetchLibrary({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          q: currentQuery || undefined,
          store: currentStore || undefined,
          genre: currentGenre || undefined,
          sort: currentSort,
        })
        if (ignore) return
        if (!result || !Array.isArray(result.games)) {
          throw new Error('Library endpoint not available yet. The backend needs to be redeployed.')
        }
        setGames(result.games)
        setPagination(result.pagination || { page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0 })
        if (result.filters?.genres?.length) setAvailableGenres(result.filters.genres)
        if (result.filters?.stores?.length) setStoreCounts(result.filters.stores)
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load library')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [currentPage, currentStore, currentGenre, currentSort, currentQuery])

  function handleSearch(value: string) {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ q: value.trim() })
    }, 400)
  }

  function handlePageChange(page: number) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (page > 1) next.set('page', String(page))
      else next.delete('page')
      return next
    }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const seoTitle = currentQuery
    ? `Search "${currentQuery}" | PlayWise`
    : currentStore
      ? `${currentStore} Games | PlayWise`
      : 'Game Library | PlayWise'

  return (
    <>
      <Seo
        title={seoTitle}
        description="Browse thousands of PC games. Filter by store, genre, and more."
      />
      <section className="min-h-screen bg-black text-white">
        <div className="mx-auto w-full max-w-[1360px] px-6 py-10 sm:px-8 xl:px-10">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mb-7"
          >
            <h1 className="text-[22px] font-bold tracking-tight text-white">
              {currentStore || 'Games'}
              {currentGenre && <span className="text-white/30 font-normal"> / {currentGenre}</span>}
            </h1>
            <p className="mt-1 text-[11px] text-white/30">
              {pagination.total.toLocaleString()} titles
              {' · '}
              Page {pagination.page} of {pagination.totalPages || 1}
            </p>
          </motion.div>

          {/* ── Toolbar ── */}
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">

            {/* Search */}
            <div className="relative min-w-[220px] lg:flex-1 lg:max-w-xs">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" style={{ fontSize: '16px' }}>search</span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search games…"
                defaultValue={currentQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded border border-white/8 bg-white/[0.03] py-2 pl-8 pr-3 text-[12px] text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none transition"
              />
            </div>

            {/* Store filter */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => updateParams({ store: '' })}
                className={`rounded px-2.5 py-1.5 text-[10px] font-semibold transition ${
                  !currentStore ? 'bg-white text-black' : 'bg-white/[0.04] text-white/40 hover:text-white/70'
                }`}
              >
                All
              </button>
              {storeCounts.map(sc => {
                const label = sc.name === 'Epic Games Store' ? 'Epic' : sc.name.replace(' Store', '')
                return (
                  <button
                    key={sc.name}
                    onClick={() => updateParams({ store: sc.name === currentStore ? '' : sc.name })}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-semibold transition ${
                      currentStore === sc.name
                        ? 'bg-white text-black'
                        : 'bg-white/[0.04] text-white/40 hover:text-white/70'
                    }`}
                  >
                    {label}
                    <span className="opacity-40">{sc.count}</span>
                  </button>
                )
              })}
            </div>

            {/* Genre */}
            {availableGenres.length > 0 && (
              <select
                value={currentGenre}
                onChange={(e) => updateParams({ genre: e.target.value })}
                className="rounded border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 focus:border-white/20 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">All Genres</option>
                {availableGenres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            )}

            {/* Sort */}
            <div className="flex gap-0.5 ml-auto">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => updateParams({ sort: opt.key })}
                  className={`rounded px-2.5 py-1.5 text-[10px] font-semibold transition ${
                    currentSort === opt.key
                      ? 'bg-white/10 text-white'
                      : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Active filter chips ── */}
          {(currentQuery || currentStore || currentGenre) && (
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {currentQuery && (
                <button
                  onClick={() => { updateParams({ q: '' }); if (searchRef.current) searchRef.current.value = '' }}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] text-white/60"
                >
                  "{currentQuery}" <span className="opacity-40">✕</span>
                </button>
              )}
              {currentStore && (
                <button
                  onClick={() => updateParams({ store: '' })}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] text-white/60"
                >
                  {currentStore} <span className="opacity-40">✕</span>
                </button>
              )}
              {currentGenre && (
                <button
                  onClick={() => updateParams({ genre: '' })}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[10px] text-white/60"
                >
                  {currentGenre} <span className="opacity-40">✕</span>
                </button>
              )}
              <button
                onClick={() => { setSearchParams({}, { replace: true }); if (searchRef.current) searchRef.current.value = '' }}
                className="text-[10px] text-white/20 hover:text-white/50 underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}

          {/* ── Loading ── */}
          {loading && (
            <div className="flex items-center gap-3 py-24 justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
              <span className="text-xs text-white/30">Loading games…</span>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="mb-6 rounded border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* ── Empty ── */}
          {!loading && !error && games.length === 0 && (
            <div className="px-6 py-24 text-center">
              <p className="text-sm font-semibold text-white/50 mb-1">No games found</p>
              <p className="text-xs text-white/25 mb-6">
                {currentQuery ? `No results for "${currentQuery}".` : 'Try a different filter.'}
              </p>
              <button
                onClick={() => { setSearchParams({}, { replace: true }); if (searchRef.current) searchRef.current.value = '' }}
                className="rounded bg-white px-5 py-2 text-xs font-bold text-black"
              >
                Reset
              </button>
            </div>
          )}

          {/* ── Game grid — 4 columns like NVIDIA ── */}
          {!loading && games.length > 0 && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.015 } } }}
              className="grid gap-x-5 gap-y-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {games.map(game => (
                <motion.div
                  key={game.slug}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
                  }}
                >
                  <GameCard game={game} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ── Pagination ── */}
          {!loading && pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}

          {/* ── Footer ── */}
          {!loading && games.length > 0 && (
            <p className="mt-10 text-center text-[10px] text-white/15">
              Game data powered by IGDB &amp; NVIDIA GeForce NOW. Cover art belongs to their respective publishers.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
