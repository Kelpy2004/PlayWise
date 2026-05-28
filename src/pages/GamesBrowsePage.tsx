import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'

import Seo from '../components/Seo'
import { api } from '../lib/api'

/* ── Store visual config ── */
const STORE_CONFIG: Record<string, { color: string; icon: string }> = {
  Steam:              { color: '#1b2838', icon: 'sports_esports' },
  'Epic Games Store': { color: '#0078f2', icon: 'storefront' },
  Xbox:               { color: '#107c10', icon: 'sports_esports' },
  'Ubisoft Store':    { color: '#0070ff', icon: 'stadia_controller' },
  EA:                 { color: '#ff4747', icon: 'sports_soccer' },
  'GeForce NOW':      { color: '#76b900', icon: 'cloud' },
}

const SORT_OPTIONS = [
  { key: 'popular', label: 'Popular' },
  { key: 'rating',  label: 'Top Rated' },
  { key: 'newest',  label: 'Newest' },
  { key: 'title',   label: 'A → Z' },
] as const

type LibraryGame = {
  slug: string; title: string; year: number | null; heroTag: string | null
  genres: string[]; stores: string[]; platforms: string[]
  averageRating: number | null; popularityScore: number | null
  image: string | null; banner: string | null
  catalogBuckets: string[]; releaseTimestamp: string | null
}

/* ── Game card ── */
function GameCard({ game }: { game: LibraryGame }) {
  const topStore = game.stores[0]
  const storeConf = topStore ? STORE_CONFIG[topStore] : null

  return (
    <Link
      to={`/games/${game.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/8 bg-[#111] transition-all hover:border-white/20 hover:shadow-xl hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/5">
        {game.image ? (
          <img
            src={game.image}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-5xl font-black text-white/10">
            {game.title.charAt(0)}
          </div>
        )}

        {/* Rating badge */}
        {game.averageRating != null && game.averageRating > 0 && (
          <div className="absolute left-2 top-2">
            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
              game.averageRating >= 8 ? 'bg-[#b1fa50] text-[#0b1600]' :
              game.averageRating >= 6 ? 'bg-amber-400 text-black' :
              'bg-white/20 text-white'
            }`}>
              ★ {game.averageRating.toFixed(1)}
            </span>
          </div>
        )}

        {/* Year badge */}
        {game.year && (
          <div className="absolute right-2 top-2">
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur">
              {game.year}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="text-[0.82rem] font-bold text-white line-clamp-2 leading-snug mb-1.5">{game.title}</h3>

        {/* Genre tags */}
        {game.genres.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {game.genres.slice(0, 2).map(g => (
              <span key={g} className="rounded bg-white/8 px-1.5 py-0.5 text-[9px] font-semibold text-white/50">{g}</span>
            ))}
          </div>
        )}

        {/* Store badges */}
        {game.stores.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {game.stores.slice(0, 3).map(store => {
              const conf = STORE_CONFIG[store]
              return (
                <span
                  key={store}
                  className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold text-white/90"
                  style={{ backgroundColor: conf?.color || '#333' }}
                >
                  {store.replace(' Store', '').replace(' Games Store', '')}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </Link>
  )
}

/* ── Pagination ── */
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
    <div className="flex items-center justify-center gap-1.5 mt-10">
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-30"
      >
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="px-1 text-white/30">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
              p === page
                ? 'bg-cyan text-white'
                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-30"
      >
        Next →
      </button>
    </div>
  )
}

/* ── Page ── */
export default function GamesBrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [games, setGames] = useState<LibraryGame[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 24, total: 0, totalPages: 0 })
  const [availableGenres, setAvailableGenres] = useState<string[]>([])
  const [storeCounts, setStoreCounts] = useState<Array<{ name: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Read filters from URL
  const currentPage = parseInt(searchParams.get('page') || '1') || 1
  const currentStore = searchParams.get('store') || ''
  const currentGenre = searchParams.get('genre') || ''
  const currentSort = searchParams.get('sort') || 'popular'
  const currentQuery = searchParams.get('q') || ''

  const updateParams = useCallback((updates: Record<string, string>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      // Reset to page 1 when filters change (unless explicitly setting page)
      if (!('page' in updates)) next.delete('page')
      return next
    }, { replace: true })
  }, [setSearchParams])

  // Fetch games from API
  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await api.fetchLibrary({
          page: currentPage,
          limit: 24,
          q: currentQuery || undefined,
          store: currentStore || undefined,
          genre: currentGenre || undefined,
          sort: currentSort,
        })
        if (ignore) return
        // Validate response shape (backend may not have /library route yet)
        if (!result || !Array.isArray(result.games)) {
          throw new Error('Library endpoint not available yet. The backend needs to be redeployed.')
        }
        setGames(result.games)
        setPagination(result.pagination || { page: 1, limit: 24, total: 0, totalPages: 0 })
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
        description="Browse thousands of games from Steam, Epic, Xbox, Ubisoft, and EA. Filter by store, genre, and ratings."
      />
      <section className="min-h-screen bg-[#070a07] text-white">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 xl:px-8">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8"
          >
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan">Game Library</p>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight">
                  {currentStore || 'All Games'}
                  {currentGenre && <span className="text-white/50"> · {currentGenre}</span>}
                </h1>
                <p className="mt-1 text-sm text-white/50">
                  {pagination.total.toLocaleString()} games across {storeCounts.length || 5} stores
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold text-white/60">
                Page {pagination.page} of {pagination.totalPages || 1}
              </div>
            </div>
          </motion.div>

          {/* Filters bar */}
          <div className="mb-6 flex flex-col gap-4 rounded-xl border border-white/8 bg-white/[0.02] p-4 lg:flex-row lg:items-center">

            {/* Search */}
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/30" style={{ fontSize: '18px' }}>search</span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search games..."
                defaultValue={currentQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-cyan/40 focus:outline-none"
              />
            </div>

            {/* Store filter */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => updateParams({ store: '' })}
                className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                  !currentStore ? 'bg-cyan text-white' : 'border border-white/10 bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                All Stores
              </button>
              {storeCounts.map(sc => (
                <button
                  key={sc.name}
                  onClick={() => updateParams({ store: sc.name === currentStore ? '' : sc.name })}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    currentStore === sc.name
                      ? 'text-white'
                      : 'border border-white/10 bg-white/5 text-white/60 hover:text-white'
                  }`}
                  style={currentStore === sc.name ? { backgroundColor: STORE_CONFIG[sc.name]?.color || '#333' } : undefined}
                >
                  {sc.name.replace(' Store', '').replace(' Games Store', '')}
                  <span className="text-white/40">{sc.count}</span>
                </button>
              ))}
            </div>

            {/* Genre dropdown */}
            {availableGenres.length > 0 && (
              <select
                value={currentGenre}
                onChange={(e) => updateParams({ genre: e.target.value })}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-white/80 focus:border-cyan/40 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">All Genres</option>
                {availableGenres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}

            {/* Sort */}
            <div className="flex gap-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => updateParams({ sort: opt.key })}
                  className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    currentSort === opt.key
                      ? 'bg-white/15 text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active filters */}
          {(currentQuery || currentStore || currentGenre) && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Filters:</span>
              {currentQuery && (
                <button
                  onClick={() => { updateParams({ q: '' }); if (searchRef.current) searchRef.current.value = '' }}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[10px] font-bold text-cyan"
                >
                  "{currentQuery}" <span className="text-cyan/60">✕</span>
                </button>
              )}
              {currentStore && (
                <button
                  onClick={() => updateParams({ store: '' })}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/80"
                >
                  {currentStore} <span className="text-white/40">✕</span>
                </button>
              )}
              {currentGenre && (
                <button
                  onClick={() => updateParams({ genre: '' })}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white/80"
                >
                  {currentGenre} <span className="text-white/40">✕</span>
                </button>
              )}
              <button
                onClick={() => {
                  setSearchParams({}, { replace: true })
                  if (searchRef.current) searchRef.current.value = ''
                }}
                className="text-[10px] font-bold text-white/30 hover:text-white/60 underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-16 justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
              <span className="text-sm text-white/50">Loading library...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && games.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-6 py-16 text-center">
              <p className="text-lg font-bold text-white/70 mb-2">No games found</p>
              <p className="text-sm text-white/40 mb-6">
                {currentQuery
                  ? `No results for "${currentQuery}". Try a different search term.`
                  : 'Try changing the store or genre filter.'}
              </p>
              <button
                onClick={() => { setSearchParams({}, { replace: true }); if (searchRef.current) searchRef.current.value = '' }}
                className="rounded-lg bg-cyan px-5 py-2.5 text-xs font-black text-white"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Game grid */}
          {!loading && games.length > 0 && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
              className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            >
              {games.map((game) => (
                <motion.div
                  key={game.slug}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
                  }}
                >
                  <GameCard game={game} />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}

          {/* Footer note */}
          {!loading && games.length > 0 && (
            <p className="mt-8 text-center text-[11px] text-white/25">
              Game data powered by IGDB. Cover art and metadata belong to their respective publishers.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
