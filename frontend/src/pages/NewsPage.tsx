import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { api } from '../lib/api'
import type { NewsItem, NewsSource, NewsSourceSlug } from '../types/api'
import Seo from '../components/Seo'

/* ─────────────────── Source palette (brand identity accents) ─────────────────── */
const SOURCE_STYLE: Record<NewsSourceSlug, { name: string; accent: string }> = {
  steam:   { name: 'Steam',      accent: '#66c0f4' },
  xbox:    { name: 'Xbox',       accent: '#5dc21e' },
  nvidia:  { name: 'NVIDIA',     accent: '#76b900' },
  epic:    { name: 'Epic Games', accent: '#50b5ff' },
  ubisoft: { name: 'Ubisoft',    accent: '#4da6ff' },
  ea:      { name: 'EA',         accent: '#f5a623' },
}

const SOURCE_ORDER: NewsSourceSlug[] = ['steam', 'xbox', 'nvidia', 'epic', 'ubisoft', 'ea']

const card = { background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)' } as const

/* ─────────────────── Utility helpers ─────────────────── */
function formatRelativeTime(iso: string) {
  const t = new Date(iso).getTime()
  if (!t) return ''
  const diff = Date.now() - t
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function getInitial(title: string) {
  const trimmed = (title || '').trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?'
}

function SourceBadge({ slug, small }: { slug: NewsSourceSlug; small?: boolean }) {
  const style = SOURCE_STYLE[slug]
  return (
    <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: small ? 9.5 : 11.5, letterSpacing: '.02em', color: '#0b0a12', background: style.accent, border: `2px solid var(--bd,#f6f4ff)`, borderRadius: 7, padding: small ? '2px 6px' : '3px 8px', boxShadow: '2px 2px 0 rgba(0,0,0,.35)', transform: 'rotate(-2deg)' }}>
      {style.name}
    </span>
  )
}

/* ─────────────────── Source filter pills ─────────────────── */
function SourceFilters({
  sources,
  active,
  onSelect,
  totalCount,
}: {
  sources: NewsSource[]
  active: NewsSourceSlug | 'all'
  onSelect: (s: NewsSourceSlug | 'all') => void
  totalCount: number
}) {
  const pill = (on: boolean, accent?: string): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 8, font: 'inherit', fontSize: 13, fontWeight: on ? 700 : 600,
    cursor: 'pointer', borderRadius: 100, padding: '8px 14px',
    border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`,
    background: on ? (accent || 'var(--lime)') : 'transparent',
    color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)',
  })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
      <button type="button" className="press" onClick={() => onSelect('all')} style={pill(active === 'all')}>
        All <span style={{ fontFamily: 'var(--fm)', fontSize: 11, opacity: 0.7 }}>{totalCount}</span>
      </button>
      {SOURCE_ORDER.map((slug) => {
        const src = sources.find((s) => s.slug === slug)
        const style = SOURCE_STYLE[slug]
        const on = active === slug
        return (
          <button key={slug} type="button" className="press" onClick={() => onSelect(slug)} style={pill(on, style.accent)}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: style.accent, border: '1.5px solid currentColor' }} />
            {style.name}
            {src ? <span style={{ fontFamily: 'var(--fm)', fontSize: 11, opacity: 0.7 }}>{src.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────── Featured (large) news card ─────────────────── */
function FeaturedNewsCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="leadcard" style={{ display: 'block', textDecoration: 'none', color: 'var(--tx,#f6f4ff)', ...card, borderRadius: 20, overflow: 'hidden', boxShadow: '6px 7px 0 var(--hard)' }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 8', width: '100%', overflow: 'hidden', borderBottom: '2.5px solid var(--bd,#f6f4ff)', background: 'var(--panel,#120f1f)' }}>
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" className="lead-img-zoom" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--card2,#221c3c)' }}>
            <span style={{ fontFamily: 'var(--fd)', fontSize: 96, fontWeight: 800, color: 'rgba(255,255,255,.06)' }}>{getInitial(item.title)}</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,5,12,.94), rgba(6,5,12,.25) 55%, transparent)' }} />
        <div style={{ position: 'absolute', left: 16, top: 16 }}><SourceBadge slug={item.sourceSlug} /></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'clamp(16px,3vw,26px)' }}>
          <p style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.72)', margin: '0 0 8px' }}>
            {formatRelativeTime(item.publishedAt)}{item.author ? ` · ${item.author}` : ''}
          </p>
          <h3 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(20px,2.6vw,30px)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.12, margin: 0, color: '#fff', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</h3>
          {item.summary ? (
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,.78)', margin: '10px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.summary}</p>
          ) : null}
          <span className="lead-read" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 14, fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.85)', transition: 'gap .2s,color .2s' }}>
            Read the story
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </div>
      </div>
    </a>
  )
}

/* ─────────────────── Standard news card ─────────────────── */
function NewsCard({ item, delay = 0 }: { item: NewsItem; delay?: number }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" className="gcard tcardin" style={{ display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'var(--tx,#f6f4ff)', ...card, borderRadius: 15, overflow: 'hidden', boxShadow: '4px 5px 0 var(--hard)', animationDelay: `${delay}ms` }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 10', width: '100%', overflow: 'hidden', borderBottom: '2.5px solid var(--bd,#f6f4ff)', background: 'var(--panel,#120f1f)' }}>
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--card2,#221c3c)' }}>
            <span style={{ fontFamily: 'var(--fd)', fontSize: 52, fontWeight: 800, color: 'rgba(255,255,255,.06)' }}>{getInitial(item.title)}</span>
          </div>
        )}
        <div style={{ position: 'absolute', left: 9, top: 9 }}><SourceBadge slug={item.sourceSlug} small /></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '11px 13px 13px' }}>
        <p style={{ fontFamily: 'var(--fm)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--tx3,#736c92)', margin: 0 }}>{formatRelativeTime(item.publishedAt)}</p>
        <h3 style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: '-.01em', lineHeight: 1.28, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</h3>
        {item.summary ? (
          <p style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--tx2,#aaa3c6)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.summary}</p>
        ) : null}
      </div>
    </a>
  )
}

/* ─────────────────── Skeleton placeholder ─────────────────── */
function SkeletonCard() {
  return (
    <div style={{ ...card, borderColor: 'var(--line2,#3a3460)', borderRadius: 15, overflow: 'hidden', opacity: 0.7 }}>
      <div style={{ aspectRatio: '16 / 10', width: '100%', background: 'var(--card2,#221c3c)', animation: 'pw-blink 1.4s ease-in-out infinite' }} />
      <div style={{ padding: '11px 13px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 8, width: 60, borderRadius: 4, background: 'var(--card2,#221c3c)' }} />
        <div style={{ height: 11, width: '100%', borderRadius: 4, background: 'var(--card2,#221c3c)' }} />
        <div style={{ height: 11, width: '72%', borderRadius: 4, background: 'var(--card2,#221c3c)' }} />
      </div>
    </div>
  )
}

const GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }

/* ─────────────────── Main page ─────────────────── */
export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [sources, setSources] = useState<NewsSource[]>([])
  const [active, setActive] = useState<NewsSourceSlug | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([api.fetchNews({ limit: 200 }), api.fetchNewsSources()])
      .then(([news, srcs]) => {
        if (cancelled) return
        setItems(news)
        setSources(srcs)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load news.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    let out = items
    if (active !== 'all') out = out.filter((it) => it.sourceSlug === active)
    const needle = search.trim().toLowerCase()
    if (needle) out = out.filter((it) => `${it.title} ${it.summary}`.toLowerCase().includes(needle))
    return out
  }, [items, active, search])

  const [featured, ...rest] = filtered
  const totalCount = items.length

  const grouped = useMemo(() => {
    if (active !== 'all') return null
    const map: Record<NewsSourceSlug, NewsItem[]> = { steam: [], xbox: [], nvidia: [], epic: [], ubisoft: [], ea: [] }
    for (const it of filtered) if (map[it.sourceSlug]) map[it.sourceSlug].push(it)
    return map
  }, [filtered, active])

  return (
    <>
      <Seo
        title="Gaming News | Steam, Xbox, NVIDIA, Epic, Ubisoft & EA — PlayWise"
        description="Latest gaming news, patch notes, free games, and updates from Steam, Xbox, NVIDIA, Epic Games, Ubisoft, and EA — all in one feed."
      />

      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '46px 26px 0' }}>
        {/* Header */}
        <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ minWidth: 300, flex: '1 1 520px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--amber)' }}>
              <span style={{ width: 18, height: 2, background: 'var(--amber)' }} />INDUSTRY FEED
            </div>
            <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(38px,5.6vw,68px)', lineHeight: 0.95, fontWeight: 800, letterSpacing: '-.04em', margin: '14px 0 0' }}>
              Game industry<br />
              <span style={{ display: 'inline-block', background: 'var(--amber)', color: '#0b0a12', padding: '0 .12em', marginTop: '.08em', border: '3px solid var(--bd)', boxShadow: '6px 6px 0 var(--hard)', transform: 'rotate(-1.5deg)' }}>news.</span>
            </h1>
            <p style={{ fontSize: 'clamp(15px,1.7vw,18px)', color: 'var(--tx2,#aaa3c6)', maxWidth: '54ch', margin: '24px 0 0', lineHeight: 1.55 }}>
              Headlines straight from the source — Steam, Xbox Wire, NVIDIA GeForce blog, Epic Games Store, Ubisoft, and EA. Updated every 30 minutes.
            </p>
          </div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 600, color: 'var(--tx2,#aaa3c6)', textAlign: 'right' }}>
            {loading ? 'Loading…' : <><span style={{ color: 'var(--lime)', fontWeight: 700 }}>{filtered.length}</span> articles · {sources.length} sources</>}
          </div>
        </section>

        {/* Search + Filters */}
        <section style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 440, ...card, borderRadius: 15, padding: '9px 16px', boxShadow: '6px 6px 0 var(--hard)' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} type="search" placeholder="Search headlines…" style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 15 }} />
          </div>
          <SourceFilters sources={sources} active={active} onSelect={setActive} totalCount={totalCount} />
        </section>

        {/* Error */}
        {error ? (
          <div style={{ marginTop: 26, background: 'var(--panel,#120f1f)', border: '2px solid var(--pink)', borderRadius: 14, padding: '16px 18px', color: 'var(--pink)', fontWeight: 600, fontSize: 14 }}>{error}</div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div style={{ ...GRID, marginTop: 30 }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : null}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 ? (
          <div style={{ marginTop: 30, textAlign: 'center', padding: '72px 22px', background: 'var(--card,#1a1630)', border: '2.5px dashed var(--line2,#3a3460)', borderRadius: 20 }}>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>No news matches your filters</div>
            <div style={{ fontSize: 14.5, color: 'var(--tx2,#aaa3c6)', marginTop: 10, lineHeight: 1.5 }}>Try changing the source or clearing your search.</div>
          </div>
        ) : null}

        {/* Single-source view: featured + grid */}
        {!loading && !error && active !== 'all' && filtered.length > 0 ? (
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 26 }}>
            {featured ? <FeaturedNewsCard item={featured} /> : null}
            {rest.length > 0 ? (
              <div style={GRID}>
                {rest.map((item, i) => <NewsCard key={item.id} item={item} delay={Math.min(i * 28, 400)} />)}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Multi-source view: grouped by source */}
        {!loading && !error && active === 'all' && grouped ? (
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 44 }}>
            {featured ? <FeaturedNewsCard item={featured} /> : null}
            {SOURCE_ORDER.map((slug) => {
              const list = grouped[slug]
              if (!list?.length) return null
              const style = SOURCE_STYLE[slug]
              return (
                <section key={slug}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, borderBottom: '2px solid var(--line)', paddingBottom: 14, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                      <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, background: style.accent, border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--hard)', display: 'grid', placeItems: 'center', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22, color: '#0b0a12' }}>{style.name.charAt(0)}</span>
                      <div>
                        <p style={{ fontFamily: 'var(--fm)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--tx3,#736c92)', margin: 0 }}>From {style.name}</p>
                        <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(20px,2.4vw,26px)', fontWeight: 800, letterSpacing: '-.02em', margin: '2px 0 0', lineHeight: 1 }}>{style.name} News</h2>
                      </div>
                    </div>
                    <button type="button" onClick={() => setActive(slug)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--ff)', fontSize: 12.5, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      See all {list.length}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </button>
                  </div>
                  <div style={GRID}>
                    {list.slice(0, 4).map((item, i) => <NewsCard key={item.id} item={item} delay={Math.min(i * 32, 300)} />)}
                  </div>
                </section>
              )
            })}
          </div>
        ) : null}

        <div style={{ height: 20 }} />
      </div>
    </>
  )
}
