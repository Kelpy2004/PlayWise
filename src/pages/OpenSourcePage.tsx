import { useDeferredValue, useMemo, useState } from 'react'

import StorefrontShelfCard from '../components/StorefrontShelfCard'
import Seo from '../components/Seo'
import { useWishlist } from '../hooks/useWishlist'
import { getOpenSourceGames } from '../lib/catalog'

export default function OpenSourcePage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = deferredQuery.trim().toLowerCase()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const seoTitle = 'Free & Open-Source Games | PlayWise'
  const seoDescription = 'Browse free and open-source games with PlayWise compatibility checks, ratings, and curated picks.'
  const seoUrl = origin ? `${origin}/open-source` : undefined

  const games = useMemo(
    () =>
      getOpenSourceGames().filter((game) => {
        const haystack = `${game.title} ${game.genre.join(' ')} ${game.heroTag || ''} ${game.description || ''}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      }),
    [normalizedQuery]
  )

  const {
    busySlug: wishlistBusySlug,
    favoriteSlugSet,
    status: wishlistStatus,
    toggleWishlist
  } = useWishlist(games)

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} url={seoUrl} />
      <section className="bg-[#090a09] px-4 pb-24 pt-28 sm:px-6 xl:px-8">
        <div className="mx-auto max-w-[1600px]">
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#3ba7ff]">PlayWise // open-source library</p>
            <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-[-0.05em] text-white md:text-5xl">
              Free games with
              <span className="italic text-[#b1fa50]"> real PlayWise analysis</span>
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/56">
              Browse legitimate free and open-source picks with the same decision flow: ratings, compatibility, price-free access,
              and saved wishlist syncing.
            </p>
          </div>

          <div className="w-full max-w-md rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
            <label htmlFor="open-source-search" className="mb-3 block text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
              Search free titles
            </label>
            <input
              id="open-source-search"
              type="search"
              className="w-full rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#b1fa50]/40"
              placeholder="Search by title or genre"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {wishlistStatus.message ? (
          <div className="mb-8 rounded-2xl border border-white/8 bg-white/[0.04] px-5 py-4 text-sm text-white/70">
            {wishlistStatus.message}
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((game) => (
            <StorefrontShelfCard
              key={game.slug}
              game={game}
              isWishlisted={favoriteSlugSet.has(game.slug)}
              wishlistBusy={wishlistBusySlug === game.slug}
              onToggleWishlist={(entry) => void toggleWishlist(entry)}
            />
          ))}
        </div>

        {!games.length ? (
          <div className="mt-10 rounded-[28px] bg-white/[0.03] p-10 text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-white/35">No free titles matched</p>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/58">
              Try a broader search term to see more open-source or legitimately free games.
            </p>
          </div>
        ) : null}
        </div>
      </section>
    </>
  )
}
