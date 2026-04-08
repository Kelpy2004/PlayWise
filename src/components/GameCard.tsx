import { Link } from 'react-router-dom'

import type { GameRecord } from '../types/catalog'

function toneClass(tone?: string): string {
  if (tone === 'good') return 'text-bg-success'
  if (tone === 'warn') return 'text-bg-warning'
  if (tone === 'bad') return 'text-bg-danger'
  return 'text-bg-info'
}

function getDisplayScore(game: GameRecord): number | null {
  if (typeof game.averageRating === 'number') {
    return game.averageRating
  }

  if (typeof game.valueRating?.score === 'number') {
    return game.valueRating.score
  }

  const ratings = Object.values(game.structuredRatings || {}).filter((value) => typeof value === 'number')
  if (!ratings.length) return null

  const total = ratings.reduce((sum, value) => sum + value, 0)
  return Number((total / ratings.length).toFixed(1))
}

interface GameCardProps {
  game: GameRecord
  isWishlisted?: boolean
  wishlistBusy?: boolean
  onToggleWishlist?: (game: GameRecord) => void
}

export default function GameCard({
  game,
  isWishlisted = false,
  wishlistBusy = false,
  onToggleWishlist
}: GameCardProps) {
  const displayScore = getDisplayScore(game)

  return (
    <article className="card game-card-modern border-0 shadow-sm h-100 overflow-hidden">
      {onToggleWishlist ? (
        <button
          type="button"
          className={`game-card-heart ${isWishlisted ? 'active' : ''}`}
          aria-label={isWishlisted ? `Remove ${game.title} from wishlist` : `Add ${game.title} to wishlist`}
          aria-pressed={isWishlisted}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onToggleWishlist(game)
          }}
          disabled={wishlistBusy}
        >
          <span aria-hidden="true">{isWishlisted ? '♥' : '♡'}</span>
        </button>
      ) : null}
      <Link className="game-card-link text-reset text-decoration-none" to={`/games/${game.slug}`}>
        <div
          className="game-card-cover"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(8, 17, 31, 0.06), rgba(8, 17, 31, 0.7)), url('${game.image || ''}')`
          }}
        />
        <div className="card-body d-flex flex-column p-4">
          <div className="d-flex flex-wrap gap-2 mb-3">
            {game.year ? <span className="badge rounded-pill text-bg-light">{game.year}</span> : null}
            <span className={`badge rounded-pill ${toneClass(game.demandTone || game.bugStatus?.tone || 'blue')}`}>
              {game.demandLevel || game.bugStatus?.label || (game.openSource ? 'Free' : 'Featured')}
            </span>
            {game.catalogSource === 'igdb' ? <span className="badge rounded-pill text-bg-dark">IGDB</span> : null}
            {game.openSource ? <span className="badge rounded-pill text-bg-dark">Open Source</span> : null}
          </div>
          <h3 className="h5 mb-2">{game.title}</h3>
          <p className="text-secondary-emphasis mb-3 flex-grow-1">{game.heroTag || game.description || 'Open the profile for live details.'}</p>
          <div className="d-flex flex-wrap gap-2 mb-4">
            {game.genre.slice(0, 3).map((genre) => (
              <span key={genre} className="badge rounded-pill text-bg-soft">
                {genre}
              </span>
            ))}
          </div>
          <div className="d-flex justify-content-between align-items-center mt-auto">
            <div>
              <small className="text-secondary-emphasis d-block">Average score</small>
              <strong>{displayScore != null ? displayScore.toFixed(1) : 'N/A'} / 10</strong>
            </div>
            <span className="btn btn-sm btn-brand rounded-pill px-3">View details</span>
          </div>
        </div>
      </Link>
    </article>
  )
}
