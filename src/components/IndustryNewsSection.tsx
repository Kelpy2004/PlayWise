import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { api } from '../lib/api'
import type { NewsItem, NewsSourceSlug } from '../types/api'

/* Source styling — small chip on each card */
const SOURCE_ACCENT: Record<NewsSourceSlug, { name: string; accent: string }> = {
  steam:   { name: 'Steam',      accent: '#66c0f4' },
  xbox:    { name: 'Xbox',       accent: '#5dc21e' },
  nvidia:  { name: 'NVIDIA',     accent: '#76b900' },
  epic:    { name: 'Epic Games', accent: '#50b5ff' },
  ubisoft: { name: 'Ubisoft',    accent: '#4da6ff' },
  ea:      { name: 'EA',         accent: '#f5a623' },
}

function relativeTime(iso: string) {
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initial(title: string) {
  return ((title || '').trim().charAt(0) || '?').toUpperCase()
}

/* Source chip overlay (top-left of image) */
function SourceChip({ slug }: { slug: NewsSourceSlug }) {
  const style = SOURCE_ACCENT[slug]
  if (!style) return null
  return (
    <span
      className="absolute left-3 top-3 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-black shadow-md"
      style={{ background: style.accent }}
    >
      {style.name}
    </span>
  )
}

/* ─── Featured large card (2x2 grid span) ─── */
function FeaturedCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group relative col-span-1 row-span-2 md:col-span-2 md:row-span-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e10] transition-all hover:border-white/25 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
    >
      <div className="relative h-full min-h-[300px] w-full overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]">
            <span className="text-8xl font-black text-white/[0.05]">{initial(item.title)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
        <SourceChip slug={item.sourceSlug} />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-7">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
            {relativeTime(item.publishedAt)}
            {item.author ? <span className="text-white/30"> · {item.author}</span> : null}
          </p>
          <h3 className="text-[clamp(1.2rem,1.8vw,1.6rem)] font-extrabold leading-tight text-white line-clamp-3">
            {item.title}
          </h3>
          {item.summary ? (
            <p className="mt-2 hidden text-[13px] leading-relaxed text-white/65 line-clamp-2 md:block">
              {item.summary}
            </p>
          ) : null}
        </div>
      </div>
    </a>
  )
}

/* ─── Medium card (1x1 with image) ─── */
function MediumCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-[#0e0e10] transition-all hover:border-white/20"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#161616]">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]">
            <span className="text-5xl font-black text-white/[0.05]">{initial(item.title)}</span>
          </div>
        )}
        <SourceChip slug={item.sourceSlug} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/40">
          {relativeTime(item.publishedAt)}
        </p>
        <h4 className="text-[13px] font-bold leading-snug text-white/90 line-clamp-3 group-hover:text-white transition-colors">
          {item.title}
        </h4>
      </div>
    </a>
  )
}

/* ─── Compact text-only card (no image, dense) ─── */
function CompactCard({ item }: { item: NewsItem }) {
  const accent = SOURCE_ACCENT[item.sourceSlug]?.accent || '#888'
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 rounded-xl border border-white/8 bg-[#0e0e10] p-3.5 transition-all hover:border-white/20 hover:bg-[#131317]"
    >
      <span className="mt-1 block h-full w-1 flex-shrink-0 rounded-full" style={{ background: accent }} />
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em]">
          <span style={{ color: accent }}>{SOURCE_ACCENT[item.sourceSlug]?.name}</span>
          <span className="text-white/35">·</span>
          <span className="text-white/40">{relativeTime(item.publishedAt)}</span>
        </div>
        <h4 className="text-[13px] font-bold leading-snug text-white/90 line-clamp-2 group-hover:text-white transition-colors">
          {item.title}
        </h4>
        {item.summary ? (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-white/50">
            {item.summary}
          </p>
        ) : null}
      </div>
    </a>
  )
}

/* ─────────────────── Main section ─────────────────── */

export default function IndustryNewsSection() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.fetchNews({ limit: 30 })
      .then((news) => {
        if (cancelled) return
        // Mix sources for visual variety — fetched news is newest-first
        const seenSources = new Set<NewsSourceSlug>()
        const balanced: NewsItem[] = []
        const remainder: NewsItem[] = []
        for (const it of news) {
          if (balanced.length < 6 && !seenSources.has(it.sourceSlug)) {
            balanced.push(it)
            seenSources.add(it.sourceSlug)
          } else {
            remainder.push(it)
          }
        }
        setItems([...balanced, ...remainder])
        setError(null)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load news.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  // Layout: 1 featured + 4 medium + 3 compact = 8 total visible
  const featured = items[0]
  const mediums = items.slice(1, 5)
  const compacts = items.slice(5, 8)

  return (
    <section className="bg-black px-[clamp(1rem,5vw,6rem)] py-20" id="industry-news">
      <div className="mx-auto max-w-[1340px]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.22em] text-cyan">
              Industry feed
            </p>
            <h2 className="text-[clamp(2rem,3.4vw,2.75rem)] font-black tracking-tight">
              Game Industry News
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] text-white/55">
              The latest from Steam, Xbox Wire, NVIDIA, Epic Games, Ubisoft, and EA — all flowing into one feed, refreshed every 30 minutes.
            </p>
          </div>
          <Link
            to="/news"
            className="self-start rounded-lg border border-white/15 bg-white/[0.04] px-5 py-2.5 text-[12px] font-black uppercase tracking-[0.14em] text-white transition hover:border-white/30 hover:bg-white/[0.08]"
          >
            View All News →
          </Link>
        </motion.div>

        {/* Error / Loading */}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-4 md:grid-rows-2">
            <div className="md:col-span-2 md:row-span-2 h-[360px] animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
            {[0,1,2,3].map((i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-6 text-center text-red-300">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/55">
            No news available right now. Check back soon.
          </div>
        ) : (
          <>
            {/* Magazine layout — featured + 4 medium cards in a 4-col × 2-row grid */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
              }}
              className="grid grid-cols-1 gap-5 md:grid-cols-4 md:grid-rows-2"
            >
              {featured ? (
                <motion.div variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}>
                  <FeaturedCard item={featured} />
                </motion.div>
              ) : null}
              {mediums.map((item) => (
                <motion.div
                  key={item.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                >
                  <MediumCard item={item} />
                </motion.div>
              ))}
            </motion.div>

            {/* Compact secondary row — 3 quick reads */}
            {compacts.length > 0 ? (
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-60px' }}
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
                }}
                className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3"
              >
                {compacts.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                  >
                    <CompactCard item={item} />
                  </motion.div>
                ))}
              </motion.div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
