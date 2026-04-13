import { Link } from 'react-router-dom'

import type { GameRecord } from '../types/catalog'

function buildSubtitle(game: GameRecord): string {
  const platforms = (game.supportedPlatforms || game.platform || []).filter(Boolean)
  if (platforms.length) return platforms.slice(0, 2).join(' / ')

  return game.genre.slice(0, 2).join(' / ')
}

function buildBadge(game: GameRecord): string | null {
  if (game.catalogBuckets?.includes('new-release')) return 'New release'
  if (game.catalogBuckets?.includes('top-rated')) return 'Top rated'
  if (game.catalogBuckets?.includes('popular')) return 'Popular'
  if (game.catalogBuckets?.includes('mid-popular')) return 'Trending'
  if (game.openSource) return 'Free'
  return null
}

interface StorefrontShelfCardProps {
  game: GameRecord
  isWishlisted?: boolean
  wishlistBusy?: boolean
  onToggleWishlist?: (game: GameRecord) => void
}

export default function StorefrontShelfCard({
  game,
  isWishlisted = false,
  wishlistBusy = false,
  onToggleWishlist
}: StorefrontShelfCardProps) {
  const subtitle = buildSubtitle(game)
  const badge = buildBadge(game)

  return (
    <article className="storefront-shelf-card">
      <div className="storefront-shelf-media-wrap">
        <Link className="storefront-shelf-link" to={`/games/${game.slug}`} aria-label={`Open ${game.title}`}>
          <div
            className="storefront-shelf-media"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(8, 17, 31, 0.08), rgba(8, 17, 31, 0.48)), url('${game.image || ''}')`
            }}
          />
        </Link>

        {badge ? <span className="storefront-shelf-badge">{badge}</span> : null}

        {onToggleWishlist ? (
          <button
            type="button"
            className={`storefront-shelf-heart ${isWishlisted ? 'active' : ''}`}
            aria-label={isWishlisted ? `Remove ${game.title} from wishlist` : `Add ${game.title} to wishlist`}
            aria-pressed={isWishlisted}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleWishlist(game)
            }}
            disabled={wishlistBusy}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 20.8 4.7 13.6a4.7 4.7 0 0 1 6.7-6.7L12 7.5l0.6-0.6a4.7 4.7 0 0 1 6.7 6.7Z" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="storefront-shelf-body">
        <Link className="storefront-shelf-title" to={`/games/${game.slug}`}>
          {game.title}
        </Link>
        <p className="storefront-shelf-subtitle">{subtitle || 'Explore the profile for more details.'}</p>
        <div className="storefront-shelf-meta">
          <span>{game.year || 'Live profile'}</span>
          <span>{typeof game.averageRating === 'number' ? `${game.averageRating.toFixed(1)}/10` : 'PlayWise'}</span>
        </div>
      </div>
    </article>
  )
}
