import { useDeferredValue, useMemo, useState } from 'react'

import GameCard from '../components/GameCard'
import { useWishlist } from '../hooks/useWishlist'
import { getOpenSourceGames } from '../lib/catalog'

export default function OpenSourcePage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const games = useMemo(
    () =>
      getOpenSourceGames().filter((game) => {
        const haystack = `${game.title} ${game.genre.join(' ')} ${game.heroTag || ''} ${game.description || ''}`.toLowerCase()
        return haystack.includes(deferredQuery.trim().toLowerCase())
      }),
    [deferredQuery]
  )
  const {
    busySlug: wishlistBusySlug,
    favoriteSlugSet,
    status: wishlistStatus,
    toggleWishlist
  } = useWishlist(games)

  return (
    <section className="py-5">
      <div className="container">
        <div className="section-banner mb-4">
          <div>
            <p className="eyebrow text-uppercase mb-2">Open-source / free</p>
            <h1 className="h2 mb-2">Free games with legitimate downloads and structured evaluation.</h1>
            <p className="text-secondary-emphasis mb-0">
              These picks keep the same PlayWise rating, compatibility, and recommendation format while pointing only to safe
              official sources.
            </p>
          </div>
          <div className="search-shell">
            <label htmlFor="open-source-search" className="form-label fw-semibold">
              Search free titles
            </label>
            <input
              id="open-source-search"
              type="search"
              className="form-control form-control-lg rounded-4"
              placeholder="Search by title or genre"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="row g-4">
          {games.map((game) => (
            <div key={game.slug} className="col-md-6 col-xl-4">
              <GameCard
                game={game}
                isWishlisted={favoriteSlugSet.has(game.slug)}
                wishlistBusy={wishlistBusySlug === game.slug}
                onToggleWishlist={(entry) => void toggleWishlist(entry)}
              />
            </div>
          ))}
        </div>
        {wishlistStatus.message ? (
          <div className={`alert alert-${wishlistStatus.tone} rounded-4 mt-4 mb-0 py-2 px-3 home-toast-alert`}>
            {wishlistStatus.message}
          </div>
        ) : null}
      </div>
    </section>
  )
}
