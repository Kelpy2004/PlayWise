import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import StorefrontShelfCard from '../components/StorefrontShelfCard'
import Seo from '../components/Seo'
import { useWishlist } from '../hooks/useWishlist'
import { getAllGames } from '../lib/catalog'
import { api, getCachedCatalogSnapshot } from '../lib/api'
import type { GameRecord } from '../types/catalog'

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function gameMatchesQuery(game: GameRecord, query: string): boolean {
  if (!query) return true
  const haystack = [
    game.title,
    game.slug,
    ...(game.genre || []),
    ...(game.genres || []),
    ...(game.platform || []),
    ...(game.supportedPlatforms || []),
    ...(game.catalogBuckets || []),
    game.pricingTag || '',
    game.heroTag || '',
    game.description || ''
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function gameMatchesCategory(game: GameRecord, query: string): boolean {
  const q = normalize(query)
  const buckets = game.catalogBuckets || []

  if (q.includes('featured')) return buckets.includes('featured') || buckets.includes('popular')
  if (q.includes('new release') || q.includes('new to old')) return buckets.includes('new-release')
  if (q.includes('top rated')) return buckets.includes('top-rated') || Number(game.averageRating || 0) >= 8
  if (q.includes('free to play')) return Boolean(game.openSource) || String(game.pricingTag || '').toLowerCase().includes('free')

  return false
}

function gameMatchesPlatform(game: GameRecord, query: string): boolean {
  const q = normalize(query)
  const platforms = [...(game.supportedPlatforms || []), ...(game.platform || [])].map((entry) => normalize(entry))

  if (!platforms.length) return false
  if (q === 'pc') return platforms.some((entry) => entry.includes('pc') || entry.includes('windows'))
  if (q === 'xbox') return platforms.some((entry) => entry.includes('xbox'))
  if (q === 'playstation') return platforms.some((entry) => entry.includes('playstation') || entry.includes('ps'))
  if (q === 'nintendo switch') return platforms.some((entry) => entry.includes('nintendo') || entry.includes('switch'))
  if (q === 'virtual reality') return platforms.some((entry) => entry.includes('vr') || entry.includes('virtual'))
  if (q === 'mobile') return platforms.some((entry) => entry.includes('mobile') || entry.includes('android') || entry.includes('ios'))

  return false
}

function sortGames(games: GameRecord[], sort: string): GameRecord[] {
  const next = [...games]
  if (sort === 'popular') {
    return next.sort((a, b) => Number(b.popularityScore || 0) - Number(a.popularityScore || 0))
  }
  if (sort === 'new') {
    return next.sort((a, b) => {
      const at = a.releaseTimestamp ? new Date(a.releaseTimestamp).getTime() : 0
      const bt = b.releaseTimestamp ? new Date(b.releaseTimestamp).getTime() : 0
      return bt - at
    })
  }
  if (sort === 'rating') {
    return next.sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0))
  }

  return next.sort((a, b) => a.title.localeCompare(b.title))
}

export default function GamesBrowsePage() {
  const [searchParams] = useSearchParams()
  const fallbackGames = useMemo(() => getCachedCatalogSnapshot() || getAllGames(), [])
  const [apiGames, setApiGames] = useState<GameRecord[]>(fallbackGames)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const query = normalize(searchParams.get('q') || '')
  const view = normalize(searchParams.get('view') || '')
  const sort = normalize(searchParams.get('sort') || '')
  const allGames = apiGames.length ? apiGames : fallbackGames
  const { wishlistGames, favoriteSlugSet, busySlug, status, toggleWishlist } = useWishlist(allGames)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const seoTitle = view === 'wishlist'
    ? 'Your Wishlist | PlayWise'
    : query
      ? `Search "${query}" | PlayWise`
      : 'Browse Games | PlayWise'
  const seoDescription = view === 'wishlist'
    ? 'Your saved PlayWise wishlist with quick access to compatibility checks, pricing, and recommendations.'
    : 'Browse PlayWise games by category, platform, ratings, and price insights.'
  const seoUrl = origin ? `${origin}/games${window.location.search || ''}` : undefined

  useEffect(() => {
    let ignore = false
    async function loadGamesFromApi() {
      setIsLoading(true)
      setLoadError('')
      try {
        const response = await api.fetchGames()
        if (!ignore && Array.isArray(response)) {
          setApiGames(response)
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : 'Could not load games from live catalog.')
          setApiGames(fallbackGames)
        }
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }
    void loadGamesFromApi()
    return () => { ignore = true }
  }, [fallbackGames])

  const baseGames = view === 'wishlist' ? wishlistGames : allGames
  const filteredGames = useMemo(() => {
    const hasQuery = Boolean(query)
    const byQuery = hasQuery
      ? baseGames.filter((game) => {
          if (gameMatchesCategory(game, query)) return true
          if (gameMatchesPlatform(game, query)) return true
          return gameMatchesQuery(game, query)
        })
      : baseGames

    const desiredSort = sort || (query.includes('new') ? 'new' : query.includes('top rated') ? 'rating' : '')
    return sortGames(byQuery, desiredSort)
  }, [baseGames, query, sort])

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} url={seoUrl} />
      <section className="min-h-screen bg-[#070a07] text-white">
        <div className="mx-auto w-full max-w-[1700px] px-4 py-10 sm:px-6 xl:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.24em] text-[#4d8ad4]">Signal Board // Live Catalog</p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
              {view === 'wishlist' ? 'Your Wishlist Stack' : 'Browse Games'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              {view === 'wishlist'
                ? 'All games you hearted are synced here. Jump back into compatibility and price checks anytime.'
                : 'Use the Games dropdown filters or navbar search to explore by title, category, platform, and popularity.'}
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-xs uppercase tracking-[0.16em] text-white/70">
            {filteredGames.length} games found
          </div>
        </div>

        {query ? (
          <div className="mb-6 inline-flex rounded-full border border-[#b1fa50]/30 bg-[#b1fa50]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b1fa50]">
            Filter: {query}
          </div>
        ) : null}

        {status.message ? (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              status.tone === 'success'
                ? 'border-[#b1fa50]/35 bg-[#b1fa50]/12 text-[#d8ff9c]'
                : status.tone === 'danger'
                  ? 'border-red-400/35 bg-red-500/12 text-red-200'
                  : status.tone === 'warning'
                    ? 'border-amber-400/35 bg-amber-500/12 text-amber-100'
                    : 'border-[#4d8ad4]/35 bg-[#4d8ad4]/12 text-[#cfe2ff]'
            }`}
          >
            {status.message}
          </div>
        ) : null}

        {loadError ? (
          <div className="mb-6 rounded-xl border border-amber-400/35 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
            Live catalog fallback active: {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mb-4 text-xs uppercase tracking-[0.18em] text-white/45">Loading catalog…</div>
        ) : null}

        {filteredGames.length ? (
          <div className="storefront-shelf-grid">
            {filteredGames.map((game) => (
              <StorefrontShelfCard
                key={game.slug}
                game={game}
                isWishlisted={favoriteSlugSet.has(game.slug)}
                wishlistBusy={busySlug === game.slug}
                onToggleWishlist={toggleWishlist}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-lg font-semibold text-white">No games matched this filter.</p>
            <p className="mt-2 text-sm text-white/60">Try another category/platform from the Games menu or clear the search.</p>
            <Link to="/games" className="mt-6 inline-flex rounded-full bg-[#b1fa50] px-5 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#0a1202]">
              View all games
            </Link>
          </div>
        )}
        </div>
      </section>
    </>
  )
}
