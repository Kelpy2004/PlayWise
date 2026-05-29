import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

import { api } from '../lib/api'
import type { NewsItem, NewsSource, NewsSourceSlug } from '../types/api'
import Seo from '../components/Seo'

/* ─────────────────── Source palette (matches DealsPage tones) ─────────────────── */
const SOURCE_STYLE: Record<NewsSourceSlug, {
  name: string
  bg: string
  accent: string
  emoji: string
}> = {
  steam:   { name: 'Steam',      bg: '#1b2838', accent: '#66c0f4', emoji: '🎮' },
  xbox:    { name: 'Xbox',       bg: '#107c10', accent: '#5dc21e', emoji: '🟢' },
  nvidia:  { name: 'NVIDIA',     bg: '#1a2a0e', accent: '#76b900', emoji: '🟩' },
  epic:    { name: 'Epic Games', bg: '#0a1929', accent: '#50b5ff', emoji: '🛡️' },
  ubisoft: { name: 'Ubisoft',    bg: '#001b3a', accent: '#4da6ff', emoji: '🔷' },
  ea:      { name: 'EA',         bg: '#1a0e1e', accent: '#f5a623', emoji: '🟧' },
}

const SOURCE_ORDER: NewsSourceSlug[] = ['steam', 'xbox', 'nvidia', 'epic', 'ubisoft', 'ea']

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
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={`rounded-full border px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider transition ${
          active === 'all'
            ? 'border-[var(--text)] bg-[var(--metric-bg)] text-[var(--text)]'
            : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:border-[var(--card-border)] hover:text-[var(--text)]'
        }`}
      >
        All <span className="ml-1 text-[var(--muted)]">{totalCount}</span>
      </button>
      {SOURCE_ORDER.map((slug) => {
        const src = sources.find((s) => s.slug === slug)
        const style = SOURCE_STYLE[slug]
        const isActive = active === slug
        return (
          <button
            key={slug}
            type="button"
            onClick={() => onSelect(slug)}
            className={`rounded-full border px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider transition ${
              isActive
                ? 'border-transparent text-white shadow-md'
                : 'border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:border-[var(--card-border)] hover:text-[var(--text)]'
            }`}
            style={isActive ? { background: style.bg, borderColor: style.accent } : undefined}
          >
            {style.name}
            {src ? <span className="ml-1 text-[var(--muted)]">{src.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────── Featured (large) news card ─────────────────── */

function FeaturedNewsCard({ item }: { item: NewsItem }) {
  const style = SOURCE_STYLE[item.sourceSlug]
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group relative block overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] transition-all hover:border-[var(--cyan)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--input-bg)]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--input-bg)] to-[var(--metric-bg)]">
            <span className="text-7xl font-black text-white/[0.06] select-none">{getInitial(item.title)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        <div className="absolute left-4 top-4">
          <span
            className="rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg"
            style={{ background: style.accent, color: '#0a0a0a' }}
          >
            {style.name}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-2">
            {formatRelativeTime(item.publishedAt)}
            {item.author ? <span className="text-[var(--muted)]"> · {item.author}</span> : null}
          </p>
          <h3 className="text-[clamp(1.3rem,2vw,1.6rem)] font-extrabold leading-tight text-[var(--text)] line-clamp-3 group-hover:text-[var(--text)]">
            {item.title}
          </h3>
          {item.summary ? (
            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{item.summary}</p>
          ) : null}
        </div>
      </div>
    </a>
  )
}

/* ─────────────────── Standard news card ─────────────────── */

function NewsCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  const style = SOURCE_STYLE[item.sourceSlug]
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 transition-all hover:border-[var(--card-border)] hover:bg-[var(--metric-bg)]"
    >
      <div className={`relative w-full overflow-hidden rounded-lg bg-[var(--input-bg)] ${compact ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}>
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--input-bg)] to-[var(--metric-bg)]">
            <span className="text-5xl font-black text-white/[0.06] select-none">{getInitial(item.title)}</span>
          </div>
        )}

        <div className="absolute left-2 top-2">
          <span
            className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-md"
            style={{ background: style.accent, color: '#0a0a0a' }}
          >
            {style.name}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-1 pb-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
          {formatRelativeTime(item.publishedAt)}
        </p>
        <h3 className={`font-bold leading-snug text-[var(--text)] transition-colors group-hover:text-[var(--text)] ${compact ? 'text-[13px] line-clamp-2' : 'text-[14px] line-clamp-3'}`}>
          {item.title}
        </h3>
        {!compact && item.summary ? (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">{item.summary}</p>
        ) : null}
      </div>
    </a>
  )
}

/* ─────────────────── Skeleton placeholder ─────────────────── */

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 animate-pulse">
      <div className="aspect-[16/10] w-full rounded-lg bg-[var(--card-bg)]" />
      <div className="px-1 space-y-2">
        <div className="h-2 w-16 rounded bg-[var(--card-bg)]" />
        <div className="h-3 w-full rounded bg-[var(--card-bg)]" />
        <div className="h-3 w-3/4 rounded bg-[var(--card-bg)]" />
      </div>
    </div>
  )
}

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
    if (active !== 'all') {
      out = out.filter((it) => it.sourceSlug === active)
    }
    const needle = search.trim().toLowerCase()
    if (needle) {
      out = out.filter((it) => `${it.title} ${it.summary}`.toLowerCase().includes(needle))
    }
    return out
  }, [items, active, search])

  // For the "Latest" section, pick a featured + grid layout
  const [featured, ...rest] = filtered
  const totalCount = items.length

  // Section per source for the source-grouped view (only when 'all' is active)
  const grouped = useMemo(() => {
    if (active !== 'all') return null
    const map: Record<NewsSourceSlug, NewsItem[]> = {
      steam: [],
      xbox: [],
      nvidia: [],
      epic: [],
      ubisoft: [],
      ea: [],
    }
    for (const it of filtered) {
      if (map[it.sourceSlug]) map[it.sourceSlug].push(it)
    }
    return map
  }, [filtered, active])

  return (
    <>
      <Seo
        title="Gaming News | Steam, Xbox, NVIDIA, Epic, Ubisoft & EA — PlayWise"
        description="Latest gaming news, patch notes, free games, and updates from Steam, Xbox, NVIDIA, Epic Games, Ubisoft, and EA — all in one feed."
      />

      <section className="min-h-screen bg-[var(--deep)] text-[var(--text)]">
        <div className="mx-auto w-full max-w-[1360px] px-6 py-10 sm:px-8 xl:px-10">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--muted)]">Industry feed</p>
              <h1 className="text-[clamp(2rem,4vw,3.2rem)] font-black tracking-tight">Game Industry News</h1>
              <p className="mt-2 max-w-2xl text-[14px] text-[var(--text-secondary)]">
                Headlines straight from the source — Steam, Xbox Wire, NVIDIA GeForce blog, Epic Games Store, Ubisoft, and EA. Updated every 30 minutes.
              </p>
            </div>
            <div className="text-right text-[12px] text-[var(--muted)]">
              {loading ? 'Loading…' : `${filtered.length} articles · ${sources.length} sources`}
            </div>
          </div>

          {/* Search + Filters */}
          <div className="mb-8 flex flex-col gap-4">
            <div className="relative w-full max-w-md">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                type="search"
                placeholder="Search headlines…"
                className="w-full rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] py-2.5 pl-10 pr-4 text-[13px] text-[var(--text)] placeholder-[var(--muted)] outline-none transition focus:border-[var(--cyan)] focus:bg-[var(--card-bg)]"
              />
              <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <SourceFilters sources={sources} active={active} onSelect={setActive} totalCount={totalCount} />
          </div>

          {/* Error */}
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-6 text-center text-red-300">
              {error}
            </div>
          ) : null}

          {/* Loading skeleton */}
          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : null}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 ? (
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-10 text-center text-[var(--text-secondary)]">
              <p className="text-lg font-bold">No news matches your filters.</p>
              <p className="mt-2 text-sm">Try changing the source or clearing your search.</p>
            </div>
          ) : null}

          {/* Single-source view: featured + grid */}
          {!loading && !error && active !== 'all' && filtered.length > 0 ? (
            <div className="space-y-8">
              {featured ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                  <FeaturedNewsCard item={featured} />
                </motion.div>
              ) : null}
              {rest.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {rest.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.4) }}
                    >
                      <NewsCard item={item} />
                    </motion.div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Multi-source view: grouped by source */}
          {!loading && !error && active === 'all' && grouped ? (
            <div className="space-y-12">
              {/* Featured at the top */}
              {featured ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                  <FeaturedNewsCard item={featured} />
                </motion.div>
              ) : null}

              {/* Per-source subsections */}
              {SOURCE_ORDER.map((slug) => {
                const items = grouped[slug]
                if (!items?.length) return null
                const style = SOURCE_STYLE[slug]
                return (
                  <section key={slug}>
                    <div className="mb-5 flex items-end justify-between">
                      <div className="flex items-center gap-3">
                        <span className="block h-6 w-1.5 rounded-full" style={{ background: style.accent }} />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--muted)]">
                            From {style.name}
                          </p>
                          <h2 className="text-[20px] font-extrabold tracking-tight">{style.name} News</h2>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActive(slug)}
                        className="text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--muted)] transition hover:text-[var(--text)]"
                      >
                        See all {items.length} →
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.slice(0, 4).map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
                        >
                          <NewsCard item={item} />
                        </motion.div>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
