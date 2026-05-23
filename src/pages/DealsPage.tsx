import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

import { api } from '../lib/api'
import type { DealRecord } from '../types/api'
import { useAuth } from '../context/AuthContext'
import Seo from '../components/Seo'

type DealFilter = 'all' | 'free' | 'discount'

const STORE_COLORS: Record<string, string> = {
  'Epic Games Store': '#0078f2',
  Steam: '#1b2838',
  'GOG.com': '#86328a',
}

function formatExpiry(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const now = Date.now()
  const diff = d.getTime() - now
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h left`
  return 'Ending soon'
}

function formatPrice(amount?: number | null, currency = 'USD') {
  if (amount == null) return '—'
  if (amount === 0) return 'FREE'
  const sym = currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
  return `${sym}${amount.toFixed(2)}`
}

function providerLabel(source: string) {
  const labels: Record<string, string> = {
    epic: 'Epic Games',
    steam: 'Steam',
    gog: 'GOG',
    cheapshark: 'CheapShark',
    itad: 'IsThereAnyDeal',
  }
  return labels[source] || source
}

function DealCard({ deal }: { deal: DealRecord }) {
  const expiry = formatExpiry(deal.endsAt)
  const isFree = deal.type === 'FREE_GAME' || deal.type === 'MISSION_FREE'
  const storeColor = STORE_COLORS[deal.store] || '#333'

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121212] transition-all hover:border-white/20 hover:shadow-lg hover:shadow-cyan/5"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-white/5">
        {deal.imageUrl ? (
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/20 text-4xl font-black">
            {deal.title.charAt(0)}
          </div>
        )}

        {/* Discount badge */}
        <div className="absolute left-3 top-3">
          {isFree ? (
            <span className="rounded-lg bg-[#b1fa50] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-[#0b1600] shadow-lg">
              Free
            </span>
          ) : deal.discountPct ? (
            <span className="rounded-lg bg-[#ff7351] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-lg">
              -{deal.discountPct}%
            </span>
          ) : null}
        </div>

        {/* Expiry badge */}
        {expiry && expiry !== 'Expired' && (
          <div className="absolute right-3 top-3">
            <span className="rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white/90 backdrop-blur">
              {expiry}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 text-base font-bold text-white line-clamp-2">{deal.title}</h3>

        {/* Store + source row */}
        <div className="mb-3 flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ backgroundColor: storeColor }}
          >
            {deal.store}
          </span>
          <span className="text-[10px] text-white/40">
            via {providerLabel(deal.source)}
          </span>
        </div>

        {/* Price */}
        <div className="mt-auto flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className={`text-lg font-black ${isFree || deal.dealPrice === 0 ? 'text-[#b1fa50]' : 'text-cyan'}`}>
              {formatPrice(deal.dealPrice, deal.currency)}
            </span>
            {deal.originalPrice != null && deal.originalPrice > 0 && deal.originalPrice !== deal.dealPrice && (
              <span className="text-xs text-white/40 line-through">
                {formatPrice(deal.originalPrice, deal.currency)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={deal.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg bg-cyan px-3 py-2 text-xs font-black text-white transition-colors hover:bg-cyan/80"
          >
            {isFree ? 'Claim Now' : 'Get Deal'}
          </a>
          {deal.gameSlug && (
            <Link
              to={`/games/${deal.gameSlug}`}
              className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              Game Details
            </Link>
          )}
        </div>
      </div>

      {/* Type indicator line */}
      {deal.type === 'MISSION_FREE' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
      )}
    </motion.article>
  )
}

export default function DealsPage() {
  const { user, token } = useAuth()
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<DealFilter>('all')
  const [subEmail, setSubEmail] = useState('')
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [subMessage, setSubMessage] = useState('')

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await api.fetchDeals()
        if (!ignore) setDeals(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load deals.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => { ignore = true }
  }, [])

  const filtered = deals.filter((d) => {
    if (filter === 'free') return d.type === 'FREE_GAME' || d.type === 'MISSION_FREE' || d.dealPrice === 0
    if (filter === 'discount') return d.type === 'DISCOUNT' && (d.dealPrice ?? 0) > 0
    return true
  })

  const freeCount = deals.filter((d) => d.type === 'FREE_GAME' || d.type === 'MISSION_FREE' || d.dealPrice === 0).length
  const discountCount = deals.filter((d) => d.type === 'DISCOUNT' && (d.dealPrice ?? 0) > 0).length

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault()
    const email = subEmail.trim() || user?.email
    if (!email) return
    setSubStatus('loading')
    try {
      await api.subscribeToDealAlerts(
        { email, notifyFreeGames: true, notifyDiscounts: true, minDiscountPct: 75 },
        token
      )
      setSubStatus('done')
      setSubMessage('Subscribed! You will get alerts for free games and deep discounts.')
    } catch (err) {
      setSubStatus('error')
      setSubMessage(err instanceof Error ? err.message : 'Subscription failed.')
    }
  }

  return (
    <>
      <Seo
        title="Deals & Free Games | PlayWise"
        description="Free games across Epic, Steam, GOG and more. Deep discounts detected in real time."
      />
      <section className="mx-auto w-full max-w-[1320px] px-4 py-12 text-white">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-white/10 bg-[#111]/80 p-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#b1fa50]">Deal Tracker</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">Free Games & Deals</h1>
              <p className="mt-2 text-sm text-white/70">
                Live free game giveaways and deep discounts across Epic, Steam, GOG, and 40+ stores.
                Updated every 5 minutes.
              </p>
            </div>
            <div className="flex gap-2">
              {freeCount > 0 && (
                <span className="rounded-full bg-[#b1fa50]/15 px-3 py-1 text-xs font-bold text-[#b1fa50] border border-[#b1fa50]/30">
                  {freeCount} Free
                </span>
              )}
              {discountCount > 0 && (
                <span className="rounded-full bg-[#ff7351]/15 px-3 py-1 text-xs font-bold text-[#ff7351] border border-[#ff7351]/30">
                  {discountCount} Deals
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {([
            { key: 'all' as const, label: 'All' },
            { key: 'free' as const, label: 'Free Games' },
            { key: 'discount' as const, label: 'Discounts' },
          ]).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-all ${
                filter === f.key
                  ? 'bg-cyan text-white'
                  : 'border border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Subscribe banner */}
        {subStatus !== 'done' && (
          <div className="mb-6 rounded-xl border border-cyan/20 bg-cyan/5 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Get notified when games go free or drop below 75% off</p>
                <p className="text-xs text-white/50 mt-0.5">Instant email alerts across all platforms.</p>
              </div>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                {!user && (
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={subEmail}
                    onChange={(e) => setSubEmail(e.target.value)}
                    required={!user}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-cyan/50 focus:outline-none"
                  />
                )}
                <button
                  type="submit"
                  disabled={subStatus === 'loading'}
                  className="rounded-lg bg-cyan px-4 py-2 text-xs font-black text-white transition-colors hover:bg-cyan/80 disabled:opacity-50"
                >
                  {subStatus === 'loading' ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            </div>
            {subStatus === 'error' && (
              <p className="mt-2 text-xs text-red-400">{subMessage}</p>
            )}
          </div>
        )}
        {subStatus === 'done' && (
          <div className="mb-6 rounded-xl border border-[#b1fa50]/20 bg-[#b1fa50]/5 px-4 py-3 text-sm text-[#b1fa50]">
            {subMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-sm text-white/60">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            Scanning stores for deals...
          </div>
        )}

        {/* Empty */}
        {!loading && !error && !filtered.length && (
          <div className="rounded-xl border border-white/10 bg-[#121212] p-8 text-center">
            <p className="text-lg font-bold text-white/70 mb-2">No deals found right now</p>
            <p className="text-sm text-white/40">
              {filter !== 'all'
                ? 'Try switching to "All" to see everything.'
                : 'The deals scanner is warming up. Check back in a few minutes.'}
            </p>
          </div>
        )}

        {/* Deals grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((deal) => (
            <DealCard key={deal.externalId || deal.id} deal={deal} />
          ))}
        </div>

        {/* Source footer */}
        {!loading && deals.length > 0 && (
          <p className="mt-8 text-center text-[11px] text-white/30">
            Data from Epic Games, Steam, GOG, IsThereAnyDeal, and CheapShark. Prices may vary by region.
          </p>
        )}
      </section>
    </>
  )
}
