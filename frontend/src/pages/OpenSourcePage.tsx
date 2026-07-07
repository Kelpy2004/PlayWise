import { useDeferredValue, useMemo, useState } from 'react'

import Seo from '../components/Seo'
import { useWishlist } from '../hooks/useWishlist'
import { getOpenSourceGames } from '../lib/catalog'
import { GRADS } from '../lib/homeData'
import type { GameRecord } from '../types/catalog'
import { Link } from 'react-router-dom'

const card = { background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)' } as const

function initialOf(title: string): string {
  return (title.replace(/^The\s+/i, '').match(/[A-Za-z0-9]/)?.[0] || title[0] || '?').toUpperCase()
}

function subtitleOf(game: GameRecord): string {
  const platforms = (game.supportedPlatforms || game.platform || []).filter(Boolean)
  if (platforms.length) return platforms.slice(0, 2).join(' · ')
  return game.genre.slice(0, 2).join(' · ')
}

function OSCard({
  game,
  index,
  wishlisted,
  busy,
  onToggle,
}: {
  game: GameRecord
  index: number
  wishlisted: boolean
  busy: boolean
  onToggle: (game: GameRecord) => void
}) {
  const cover = GRADS[index % GRADS.length]
  const subtitle = subtitleOf(game)
  return (
    <div className="gcard" style={{ display: 'flex', flexDirection: 'column', ...card, borderRadius: 16, overflow: 'hidden', boxShadow: '4px 5px 0 var(--hard)' }}>
      <Link to={`/games/${game.slug}`} aria-label={`Open ${game.title}`} style={{ display: 'block', position: 'relative', height: 158, background: cover, overflow: 'hidden', borderBottom: '2.5px solid var(--bd,#f6f4ff)', textDecoration: 'none' }}>
        {game.image ? (
          <img src={game.image} alt={game.title} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,.22) 1.4px,transparent 1.5px)', backgroundSize: '11px 11px' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 54, lineHeight: 1, color: 'rgba(255,255,255,.9)', textShadow: '2px 2px 0 rgba(0,0,0,.3)' }}>{initialOf(game.title)}</div>
          </>
        )}
        <span style={{ position: 'absolute', top: 9, left: 9, fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 11.5, color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '3px 8px', boxShadow: '2px 2px 0 rgba(0,0,0,.35)', transform: 'rotate(-3deg)' }}>FREE</span>
      </Link>

      <div style={{ padding: '12px 13px 13px', display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Link to={`/games/${game.slug}`} style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, letterSpacing: '-.01em', lineHeight: 1.2, color: 'var(--tx,#f6f4ff)', textDecoration: 'none' }}>{game.title}</Link>
          <button
            type="button"
            className="press"
            onClick={() => onToggle(game)}
            disabled={busy}
            aria-pressed={wishlisted}
            aria-label={wishlisted ? `Remove ${game.title} from wishlist` : `Add ${game.title} to wishlist`}
            style={{ flexShrink: 0, width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 9, cursor: busy ? 'default' : 'pointer', background: wishlisted ? 'var(--pink)' : 'var(--bg,#0b0a12)', border: '2px solid var(--bd,#f6f4ff)', color: wishlisted ? '#fff' : 'var(--tx2,#aaa3c6)', boxShadow: '2px 2px 0 var(--hard)', opacity: busy ? 0.6 : 1 }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.1"><path d="M12 20.8 4.7 13.6a4.7 4.7 0 0 1 6.7-6.7L12 7.5l.6-.6a4.7 4.7 0 0 1 6.7 6.7Z" /></svg>
          </button>
        </div>
        <div style={{ fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx2,#aaa3c6)', letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle || 'Open-source pick'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '2px solid var(--line)' }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)' }}>{game.year || 'Live profile'}</span>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--lime)' }}>{typeof game.averageRating === 'number' ? `${game.averageRating.toFixed(1)}/10` : 'PlayWise'}</span>
        </div>
      </div>
    </div>
  )
}

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

  const { busySlug, favoriteSlugSet, status, toggleWishlist } = useWishlist(games)

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} url={seoUrl} />
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '46px 26px 0' }}>
        {/* Header */}
        <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 28 }}>
          <div style={{ minWidth: 300, flex: '1 1 480px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--cyan)' }}>
              <span style={{ width: 18, height: 2, background: 'var(--cyan)' }} />OPEN-SOURCE LIBRARY
            </div>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(38px,5.6vw,68px)', lineHeight: 0.95, fontWeight: 800, letterSpacing: '-.04em', margin: '14px 0 0' }}>
              Free games,<br />
              <span style={{ display: 'inline-block', background: 'var(--cyan)', color: '#0b0a12', padding: '0 .12em', marginTop: '.08em', border: '3px solid var(--bd)', boxShadow: '6px 6px 0 var(--hard)', transform: 'rotate(-1.5deg)' }}>real analysis.</span>
            </h1>
            <p style={{ fontSize: 'clamp(15px,1.7vw,18px)', color: 'var(--tx2,#aaa3c6)', maxWidth: '52ch', margin: '24px 0 0', lineHeight: 1.55 }}>
              Legitimate free and open-source picks with the same PlayWise decision flow — ratings, compatibility, price-free access, and saved wishlist syncing.
            </p>
          </div>

          <div style={{ width: '100%', maxWidth: 380, ...card, borderRadius: 16, padding: '16px 18px', boxShadow: '6px 6px 0 var(--hard)' }}>
            <label htmlFor="open-source-search" style={{ display: 'block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tx3,#736c92)', marginBottom: 9 }}>Search free titles</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 12, padding: '10px 13px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
              <input
                id="open-source-search"
                type="search"
                placeholder="Search by title or genre"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 15 }}
              />
            </div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', marginTop: 10, letterSpacing: '.03em' }}>
              <span style={{ color: 'var(--lime)', fontWeight: 700 }}>{games.length}</span> free {games.length === 1 ? 'title' : 'titles'}
            </div>
          </div>
        </section>

        {status.message ? (
          <div style={{ marginTop: 22, background: 'var(--panel,#120f1f)', border: '2px solid var(--line)', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, color: status.tone === 'success' ? 'var(--lime)' : status.tone === 'danger' ? 'var(--pink)' : status.tone === 'warning' ? 'var(--amber)' : 'var(--tx2,#aaa3c6)', fontWeight: 600 }}>
            {status.message}
          </div>
        ) : null}

        {/* Grid */}
        <section style={{ padding: '30px 0 0' }}>
          {games.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 18 }}>
              {games.map((game, index) => (
                <OSCard
                  key={game.slug}
                  game={game}
                  index={index}
                  wishlisted={favoriteSlugSet.has(game.slug)}
                  busy={busySlug === game.slug}
                  onToggle={(entry) => void toggleWishlist(entry)}
                />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '72px 22px', background: 'var(--card,#1a1630)', border: '2.5px dashed var(--line2,#3a3460)', borderRadius: 20 }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>No free titles matched</div>
              <div style={{ fontSize: 14.5, color: 'var(--tx2,#aaa3c6)', marginTop: 10, lineHeight: 1.5 }}>Try a broader search term to see more open-source or legitimately free games.</div>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
