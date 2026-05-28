import { useCallback, useEffect, useRef, useState } from 'react'
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
  GOG:                { color: '#a849d4', icon: 'storefront' },
}

const SORT_OPTIONS = [
  { key: 'title',   label: 'A → Z' },
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
}

/* ── Game card (NVIDIA-style landscape) ── */
function GameCard({ game }: { game: LibraryGame }) {
  const img = game.banner || game.image
  const isGfnOptimized = game.catalogBuckets?.includes('gfn-optimized')
  const isGfn = game.stores?.includes('GeForce NOW')

  return (
    <Link
      to={`/games/${game.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-lg bg-[#1a1a1a] transition-all duration-200 hover:bg-[#222] hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5"
    >
      {/* Landscape image */}
      <div className="relative aspect-[460/215] w-full overflow-hidden bg-[#111]">
        {img ? (
          <img
            src={img}
            alt={game.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-transparent">
            <span className="text-3xl font-black text-white/8">{game.title.charAt(0)}</span>
          </div>
        )}

        {/* GFN Optimized badge */}
        {isGfnOptimized && (
          <div className="absolute right-1.5 top-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-[#76b900] px-1.5 py-0.5 text-[9px] font-black uppercase text-black shadow-lg">
              <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>bolt</span>
              Optimized
            </span>
          </div>
        )}

        {/* Rating overlay */}
        {game.averageRating != null && game.averageRating > 0 && (
          <div className="absolute left-1.5 top-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-black shadow-lg ${
              game.averageRating >= 8 ? 'bg-[#76b900] text-black' :
              game.averageRating >= 6 ? 'bg-amber-500 text-black' :
              'bg-black/70 text-white/80 backdrop-blur'
            }`}>
              {game.averageRating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 px-2.5 py-2">
        <h3 className="text-[13px] font-semibold leading-tight text-white/90 line-clamp-1 group-hover:text-white">
          {game.title}
        </h3>

        <div className="flex items-center gap-2 text-[10px] text-white/35">
          {game.genres.length > 0 && (
            <span className="line-clamp-1">{game.genres.slice(0, 2).join(', ')}</span>
          )}
          {game.year && (
            <>
              <span className="text-white/15">·</span>
              <span>{game.year}</span>
            </>
          )}
        </div>

        {/* Store pills */}
        {game.stores.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {game.stores.slice(0, 3).map(store => {
              const conf = STORE_CONFIG[store]
              const label = store === 'Epic Games Store' ? 'Epic' : store.replace(' Store', '')
              return (
                <span
                  key={store}
                  className="rounded px-1.5 py-px text-[8px] font-bold text-white/80"
                  style={{ backgroundColor: (conf?.color || '#333') + '99' }}
                >
                  {label}
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
                ? 'bg-[#76b900] text-black'
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
        description="Browse thousands of games from Steam, Epic, Xbox, Ubisoft, EA, and GeForce NOW. Filter by store, genre, and sort alphabetically."
      />
      <section className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 xl:px-8">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {currentStore || 'All Games'}
                  {currentGenre && <span className="text-white/40 font-normal"> / {currentGenre}</span>}
                </h1>
                <p className="mt-1 text-xs text-white/40">
                  {pagination.total.toLocaleString()} games
                  {storeCounts.length > 0 && ` across ${storeCounts.length} stores`}
                </p>
              </div>
              <span className="text-[11px] font-medium text-white/30">
                Page {pagination.page} of {pagination.totalPages || 1}
              </span>
            </div>
          </motion.div>

          {/* Toolbar */}
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-white/6 bg-white/[0.02] p-3 lg:flex-row lg:items-center">

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" style={{ fontSize: '16px' }}>search</span>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search games..."
                defaultValue={currentQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-md border border-white/8 bg-black/40 py-2 pl-8 pr-3 text-xs text-white placeholder:text-white/25 focus:border-[#76b900]/50 focus:outline-none"
              />
            </div>

            {/* Store pills */}
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => updateParams({ store: '' })}
                className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${
                  !currentStore ? 'bg-[#76b900] text-black' : 'bg-white/5 text-white/50 hover:text-white/80'
                }`}
              >
                All
              </button>
              {storeCounts.map(sc => {
                const conf = STORE_CONFIG[sc.name]
                const label = sc.name === 'Epic Games Store' ? 'Epic' : sc.name.replace(' Store', '')
                return (
                  <button
                    key={sc.name}
                    onClick={() => updateParams({ store: sc.name === currentStore ? '' : sc.name })}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${
                      currentStore === sc.name
                        ? 'text-white'
                        : 'bg-white/5 text-white/50 hover:text-white/80'
                    }`}
                    style={currentStore === sc.name ? { backgroundColor: conf?.color || '#333' } : undefined}
                  >
                    {label}
                    <span className="text-[9px] opacity-50">{sc.count}</span>
                  </button>
                )
              })}
            </div>

            <div className="h-5 w-px bg-white/8 hidden lg:block" />

            {/* Genre */}
            {availableGenres.length > 0 && (
              <select
                value={currentGenre}
                onChange={(e) => updateParams({ genre: e.target.value })}
                className="rounded-md border border-white/8 bg-black/40 px-2.5 py-1.5 text-[10px] font-bold text-white/70 focus:border-[#76b900]/50 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">All Genres</option>
                {availableGenres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            )}

            <div className="h-5 w-px bg-white/8 hidden lg:block" />

            {/* Sort */}
            <div className="flex gap-0.5">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => updateParams({ sort: opt.key })}
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${
                    currentSort === opt.key
                      ? 'bg-white/10 text-white'
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active filter chips */}
          {(currentQuery || currentStore || currentGenre) && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {currentQuery && (
                <button
                  onClick={() => { updateParams({ q: '' }); if (searchRef.current) searchRef.current.value = '' }}
                  className="inline-flex items-center gap-1 rounded-full bg-[#76b900]/15 border border-[#76b900]/30 px-2.5 py-0.5 text-[10px] font-bold text-[#76b900]"
                >
                  "{currentQuery}" <span className="opacity-50 ml-0.5">✕</span>
                </button>
              )}
              {currentStore && (
                <button
                  onClick={() => updateParams({ store: '' })}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white/70"
                >
                  {currentStore} <span className="opacity-40 ml-0.5">✕</span>
                </button>
              )}
              {currentGenre && (
                <button
                  onClick={() => updateParams({ genre: '' })}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white/70"
                >
                  {currentGenre} <span className="opacity-40 ml-0.5">✕</span>
                </button>
              )}
              <button
                onClick={() => {
                  setSearchParams({}, { replace: true })
                  if (searchRef.current) searchRef.current.value = ''
                }}
                className="text-[10px] font-bold text-white/25 hover:text-white/50 underline ml-1"
              >
                Clear
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-3 py-20 justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#76b900] border-t-transparent" />
              <span className="text-xs text-white/40">Loading games...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && games.length === 0 && (
            <div className="rounded-lg border border-white/8 bg-white/[0.02] px-6 py-20 text-center">
              <p className="text-base font-semibold text-white/60 mb-1">No games found</p>
              <p className="text-xs text-white/30 mb-6">
                {currentQuery
                  ? `No results for "${currentQuery}".`
                  : 'Try changing the store or genre filter.'}
              </p>
              <button
                onClick={() => { setSearchParams({}, { replace: true }); if (searchRef.current) searchRef.current.value = '' }}
                className="rounded-md bg-[#76b900] px-5 py-2 text-xs font-bold text-black"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Game grid — landscape cards like NVIDIA */}
          {!loading && games.length > 0 && (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.02 } } }}
              className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              {games.map((game) => (
                <motion.div
                  key={game.slug}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
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

          {/* Footer */}
          {!loading && games.length > 0 && (
            <p className="mt-8 text-center text-[10px] text-white/20">
              Game data powered by IGDB &amp; NVIDIA GeForce NOW. Cover art belongs to their respective publishers.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
