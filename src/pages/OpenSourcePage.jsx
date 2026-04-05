import { useDeferredValue, useState } from 'react'

import GameCard from '../components/GameCard'
import { getOpenSourceGames } from '../lib/catalog'

export default function OpenSourcePage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const games = getOpenSourceGames().filter((game) => {
    const haystack = `${game.title} ${game.genre.join(' ')} ${game.heroTag} ${game.description}`.toLowerCase()
    return haystack.includes(deferredQuery.trim().toLowerCase())
  })

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
              <GameCard game={game} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
