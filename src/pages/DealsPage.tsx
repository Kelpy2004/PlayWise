import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useShell } from '../context/ShellContext'
import { GRADS, storeColor } from '../lib/homeData'
import type { DealRecord } from '../types/api'

type DealType = 'all' | 'free' | 'discount'
type SortKey = 'popular' | 'discount' | 'discountLow' | 'priceLow' | 'priceHigh'

interface DealItem {
  id: string
  title: string
  storeId: string
  storeName: string
  accent: string
  original: number
  discountPct: number
  isFree: boolean
  price: number
  pop: number
  cover: string
  badge: string
  badgeColor: string
  priceText: string
  priceColor: string
  origText: string
  leavingSoon: boolean
  leftLabel: string
  storeUrl: string
  slug: string
}

const STORE_VISIT: Record<string, string> = {
  steam: 'https://store.steampowered.com/search/?term=',
  epic: 'https://store.epicgames.com/en-US/browse?q=',
  'epic games': 'https://store.epicgames.com/en-US/browse?q=',
  xbox: 'https://www.xbox.com/en-US/Search/Results?q=',
  ubisoft: 'https://store.ubisoft.com/us/search?q=',
  gog: 'https://www.gog.com/games?search=',
  ea: 'https://www.ea.com/games/library',
  nvidia: 'https://www.nvidia.com/en-us/geforce-now/games/',
}

const STORE_ORDER = ['steam', 'epic', 'epic games', 'xbox', 'ubisoft', 'gog', 'ea', 'nvidia']

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Merge a CSS custom property (e.g. --sc) into a style object without TS friction.
function withVar(style: CSSProperties, name: string, val: string): CSSProperties {
  return { ...style, [name]: val } as CSSProperties
}

// Representative fallback (used only when the API is empty/unreachable in dev).
const FALLBACK: Array<{ t: string; s: string; o: number; d: number; f?: boolean; p: number; e: string }> = [
  { t: 'Cyberpunk 2077', s: 'Steam', o: 59.99, d: 85, p: 97, e: '+1d' },
  { t: 'Elden Ring', s: 'Steam', o: 59.99, d: 40, p: 99, e: '+6d' },
  { t: 'Red Dead Redemption 2', s: 'Steam', o: 59.99, d: 67, p: 93, e: '+1d' },
  { t: 'Hollow Knight', s: 'Steam', o: 14.99, d: 75, p: 86, e: '+3d' },
  { t: 'Hades II', s: 'Steam', o: 29.99, d: 18, p: 90, e: '+10d' },
  { t: 'Fall Guys', s: 'Epic', o: 19.99, d: 100, f: true, p: 92, e: '+1d' },
  { t: 'Control Ultimate Edition', s: 'Epic', o: 29.99, d: 100, f: true, p: 89, e: '+1d' },
  { t: 'Alan Wake 2', s: 'Epic', o: 49.99, d: 35, p: 95, e: '+5d' },
  { t: 'Sifu', s: 'Epic', o: 39.99, d: 50, p: 84, e: '+4d' },
  { t: 'Forza Horizon 5', s: 'Xbox', o: 59.99, d: 61, p: 94, e: '+3d' },
  { t: 'Starfield', s: 'Xbox', o: 69.99, d: 40, p: 90, e: '+8d' },
  { t: 'Gears 5', s: 'Xbox', o: 39.99, d: 75, p: 83, e: '+6d' },
  { t: 'Far Cry 6', s: 'Ubisoft', o: 59.99, d: 80, p: 88, e: '+2d' },
  { t: "Assassin's Creed Mirage", s: 'Ubisoft', o: 49.99, d: 50, p: 92, e: '+6d' },
  { t: 'Rainbow Six Siege', s: 'Ubisoft', o: 19.99, d: 80, p: 87, e: '+1d' },
  { t: 'The Crew Motorfest', s: 'Ubisoft', o: 49.99, d: 60, p: 80, e: '+9d' },
]

function fallbackDeals(): DealRecord[] {
  const now = Date.now()
  return FALLBACK.map((d, i) => {
    const days = parseInt(d.e.replace(/[^0-9]/g, ''), 10) || 5
    const price = d.f ? 0 : Math.floor(d.o * (100 - d.d)) / 100
    return {
      id: `fb${i}`,
      externalId: `fb${i}`,
      type: d.f ? 'FREE_GAME' : 'DISCOUNT',
      title: d.t,
      store: d.s,
      originalPrice: d.o,
      dealPrice: price,
      discountPct: d.d,
      currency: 'USD',
      url: '',
      endsAt: new Date(now + days * 86400000).toISOString(),
      source: 'fallback',
      isActive: true,
      metadata: { pop: d.p },
    } as DealRecord
  })
}

function toItem(d: DealRecord, i: number): DealItem {
  const storeId = slugify(d.store)
  const isFree = d.type === 'FREE_GAME' || d.dealPrice === 0
  const price = typeof d.dealPrice === 'number' ? d.dealPrice : 0
  const original = typeof d.originalPrice === 'number' ? d.originalPrice : 0
  const discountPct = d.discountPct ?? (original ? Math.round((1 - price / original) * 100) : 0)
  const ms = d.endsAt ? new Date(d.endsAt).getTime() - Date.now() : Infinity
  const h = ms / 3600000
  const leavingSoon = ms > 0 && h <= 48
  const leftLabel = h <= 24 ? `${Math.max(1, Math.round(h))}h left` : `${Math.ceil(h / 24)}d left`
  const slug = d.gameSlug || slugify(d.title)
  const pop = (d.metadata && typeof (d.metadata as { pop?: number }).pop === 'number' ? (d.metadata as { pop?: number }).pop : discountPct) || 0
  const visit = STORE_VISIT[storeId] || STORE_VISIT[d.store.toLowerCase()]
  return {
    id: d.id || `d${i}`,
    title: d.title,
    storeId,
    storeName: d.store,
    accent: storeColor(d.store),
    original,
    discountPct,
    isFree,
    price,
    pop,
    cover: GRADS[i % GRADS.length],
    badge: isFree ? 'FREE' : `−${discountPct}%`,
    badgeColor: isFree ? '#1fd7ff' : '#caff3f',
    priceText: isFree ? 'Free' : `$${price.toFixed(2)}`,
    priceColor: isFree ? '#1fd7ff' : '#caff3f',
    origText: original ? `$${original.toFixed(2)}` : '',
    leavingSoon,
    leftLabel,
    storeUrl: d.url || (visit ? visit + encodeURIComponent(d.title) : '#'),
    slug,
  }
}

const SORTS: Record<SortKey, (a: DealItem, b: DealItem) => number> = {
  popular: (a, b) => b.pop - a.pop,
  discount: (a, b) => b.discountPct - a.discountPct,
  discountLow: (a, b) => a.discountPct - b.discountPct,
  priceLow: (a, b) => a.price - b.price,
  priceHigh: (a, b) => b.price - a.price,
}

const SORT_LABELS: Array<{ k: SortKey; label: string }> = [
  { k: 'popular', label: 'Popular' },
  { k: 'discount', label: 'Biggest discount' },
  { k: 'discountLow', label: 'Lowest discount' },
  { k: 'priceLow', label: 'Price: low → high' },
  { k: 'priceHigh', label: 'Price: high → low' },
]

const card = { background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)' } as const

export default function DealsPage() {
  const navigate = useNavigate()
  const { toast } = useShell()
  const { token, user } = useAuth()
  const [all, setAll] = useState<DealItem[]>(() => fallbackDeals().map(toItem))
  const [query, setQuery] = useState('')
  const [type, setType] = useState<DealType>('all')
  const [sort, setSort] = useState<SortKey>('popular')
  const [maxPrice, setMaxPrice] = useState(150)
  const [stores, setStores] = useState<string[] | null>(null) // null = all
  const [showFilters, setShowFilters] = useState(false)
  const [countdown, setCountdown] = useState(180)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertQuery, setAlertQuery] = useState('')
  const [alertList, setAlertList] = useState<string[]>([])
  const [alertSaving, setAlertSaving] = useState(false)
  const [catalog, setCatalog] = useState<Array<{ title: string; slug: string }>>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const alertEmailRef = useRef<HTMLInputElement>(null)
  // gameSlugs that already have an active server-side alert (for save-time diffing)
  const serverSlugsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const deals = await api.fetchDeals()
        if (!ignore && deals.length) setAll(deals.map(toItem))
      } catch {
        /* keep fallback */
      }
      try {
        const games = await api.fetchGames()
        if (!ignore && games.length) setCatalog(games.map((g) => ({ title: g.title, slug: g.slug })))
      } catch {
        /* fall back to deal titles */
      }
    })()
    try {
      const saved = JSON.parse(localStorage.getItem('playwise-alerts') || '{}')
      if (Array.isArray(saved.list)) setAlertList(saved.list)
      if (saved.email && alertEmailRef.current) alertEmailRef.current.value = saved.email
    } catch {
      /* ignore */
    }
    return () => { ignore = true }
  }, [])

  // logged-in: pull existing server-side price alerts and prefill the list
  useEffect(() => {
    if (!token || !catalog.length) return
    let ignore = false
    void (async () => {
      try {
        const alerts = await api.fetchPriceAlerts(token)
        if (ignore) return
        const active = alerts.filter((a) => a.isActive)
        serverSlugsRef.current = new Set(active.map((a) => a.gameSlug))
        const titleBySlug = new Map(catalog.map((c) => [c.slug, c.title]))
        const titles = active.map((a) => titleBySlug.get(a.gameSlug)).filter((t): t is string => Boolean(t))
        if (titles.length) setAlertList((prev) => [...new Set([...prev, ...titles])])
      } catch {
        /* keep local list */
      }
    })()
    return () => { ignore = true }
  }, [token, catalog])

  const persistAlerts = (list: string[]) => {
    try {
      const email = alertEmailRef.current?.value.trim() || ''
      localStorage.setItem('playwise-alerts', JSON.stringify({ list, email }))
    } catch {
      /* ignore */
    }
  }
  const addAlert = (t: string) => setAlertList((prev) => { const next = prev.includes(t) ? prev : [...prev, t]; persistAlerts(next); return next })
  const removeAlert = (t: string) => setAlertList((prev) => { const next = prev.filter((x) => x !== t); persistAlerts(next); return next })

  const slugByTitle = useMemo(() => {
    const m = new Map<string, string>()
    all.forEach((d) => { if (d.slug) m.set(d.title, d.slug) })
    catalog.forEach((c) => m.set(c.title, c.slug))
    return m
  }, [catalog, all])

  const saveAlerts = async () => {
    const email = alertEmailRef.current?.value.trim() || user?.email || ''
    if (!alertList.length) { toast('Add at least one game to track'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email to get alerts'); alertEmailRef.current?.focus(); return }
    persistAlerts(alertList)
    setAlertSaving(true)

    const slugs = [...new Set(alertList.map((t) => slugByTitle.get(t)).filter((s): s is string => Boolean(s)))]
    const removed = [...serverSlugsRef.current].filter((s) => !slugs.includes(s))
    const results = await Promise.allSettled([
      ...slugs.map((gameSlug) => api.createDealPriceAlert({ email, gameSlug }, token)),
      ...removed.map((gameSlug) => api.removeDealPriceAlert({ email, gameSlug }, token)),
      api.subscribeToDealAlerts({ email, notifyFreeGames: true, notifyDiscounts: true }, token),
    ])
    setAlertSaving(false)

    const created = results.slice(0, slugs.length)
    const okCount = created.filter((r) => r.status === 'fulfilled').length
    if (okCount > 0) {
      serverSlugsRef.current = new Set(slugs.filter((_, i) => created[i].status === 'fulfilled'))
      setAlertOpen(false)
      toast(`${okCount} ${okCount === 1 ? 'alert' : 'alerts'} set — we'll email ${email}`)
    } else if (results.at(-1)?.status === 'fulfilled') {
      setAlertOpen(false)
      toast(`Deal digest on — we'll email ${email} about free games & big drops`)
    } else {
      toast('Could not reach the alert service — your list is saved, try again soon')
    }
  }

  const searchCatalog = useMemo(
    () => (catalog.length ? catalog.map((c) => c.title) : Array.from(new Set(all.map((d) => d.title)))),
    [catalog, all]
  )
  const alertResults = useMemo(() => {
    const q = alertQuery.trim().toLowerCase()
    let list: string[]
    if (!q) list = searchCatalog.slice(0, 6)
    else {
      const starts: string[] = []
      const incl: string[] = []
      searchCatalog.forEach((t) => { const l = t.toLowerCase(); if (l.startsWith(q)) starts.push(t); else if (l.includes(q)) incl.push(t) })
      list = [...starts, ...incl].slice(0, 9)
    }
    return list.map((t, i) => ({ title: t, cover: GRADS[i % GRADS.length], initial: (t.replace(/^The\s+/i, '').match(/[A-Za-z0-9]/)?.[0] || t[0]).toUpperCase(), inList: alertList.includes(t) }))
  }, [alertQuery, searchCatalog, alertList])

  useEffect(() => {
    const id = window.setInterval(() => setCountdown((c) => (c <= 0 ? 180 : c - 1)), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (alertOpen && alertEmailRef.current && !alertEmailRef.current.value && user?.email) {
      alertEmailRef.current.value = user.email
    }
  }, [alertOpen, user])

  // distinct stores present, in preferred order
  const storeList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; accent: string }>()
    all.forEach((d) => { if (!map.has(d.storeId)) map.set(d.storeId, { id: d.storeId, name: d.storeName, accent: d.accent }) })
    return [...map.values()].sort((a, b) => {
      const ia = STORE_ORDER.indexOf(a.name.toLowerCase())
      const ib = STORE_ORDER.indexOf(b.name.toLowerCase())
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
  }, [all])

  const activeStores = stores ?? storeList.map((s) => s.id)

  const filtered = useMemo(() => {
    let arr = all.slice()
    const q = query.trim().toLowerCase()
    if (q) arr = arr.filter((d) => d.title.toLowerCase().includes(q))
    if (type === 'free') arr = arr.filter((d) => d.isFree)
    else if (type === 'discount') arr = arr.filter((d) => !d.isFree)
    if (maxPrice < 150) arr = arr.filter((d) => d.price <= maxPrice)
    arr = arr.filter((d) => activeStores.includes(d.storeId))
    return arr
  }, [all, query, type, maxPrice, activeStores])

  const sections = useMemo(() => {
    const cmp = SORTS[sort]
    return storeList
      .filter((st) => activeStores.includes(st.id))
      .map((st) => {
        const ds = filtered.filter((d) => d.storeId === st.id).sort(cmp)
        const free = ds.filter((d) => d.isFree).length
        const paid = ds.length - free
        const parts: string[] = []
        if (free) parts.push(`${free} free`)
        if (paid || !free) parts.push(`${paid} deal${paid === 1 ? '' : 's'}`)
        return { ...st, deals: ds, mono: st.name.charAt(0).toUpperCase(), countLabel: parts.join(' · ') }
      })
      .filter((s) => s.deals.length)
  }, [filtered, storeList, sort, activeStores])

  const totalFree = all.filter((d) => d.isFree).length
  const activeCount = (type !== 'all' ? 1 : 0) + (maxPrice < 150 ? 1 : 0) + (stores && stores.length < storeList.length ? 1 : 0)

  const toggleStore = (id: string) => {
    const cur = stores ?? storeList.map((s) => s.id)
    setStores(cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id])
  }
  const resetAll = () => { setQuery(''); setType('all'); setSort('popular'); setMaxPrice(150); setStores(null); toast('Filters reset') }
  const scrollToStore = (id: string) => {
    const el = rootRef.current?.querySelector(`[data-store-id="${id}"]`)
    if (!el) { toast('No deals in that store with the current filters'); return }
    const y = (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 150
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  const pillBtn = (active: boolean, accent = true) => ({
    font: 'inherit', fontSize: 13, fontWeight: active ? 700 : 600, cursor: 'pointer', borderRadius: 100, padding: '8px 14px',
    border: `2px solid ${active ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`,
    background: active && accent ? 'var(--lime)' : 'transparent', color: active && accent ? '#0b0a12' : 'var(--tx2,#aaa3c6)',
  }) as const

  const mm = Math.floor(countdown / 60)
  const ss = String(countdown % 60).padStart(2, '0')

  return (
    <div ref={rootRef} id="top">
      {/* Header block */}
      <section style={{ maxWidth: 1320, margin: '0 auto', padding: '46px 26px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 28 }}>
        <div style={{ minWidth: 300, flex: '1 1 480px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--pink)' }}>
            <span style={{ width: 18, height: 2, background: 'var(--pink)' }} />DEAL TRACKER
          </div>
          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(40px,6vw,76px)', lineHeight: 0.94, fontWeight: 800, letterSpacing: '-.04em', margin: '14px 0 0' }}>
            Deals on<br />
            <span style={{ display: 'inline-block', background: 'var(--lime)', color: '#0b0a12', padding: '0 .12em', marginTop: '.08em', border: '3px solid var(--bd)', boxShadow: '6px 6px 0 var(--hard)', transform: 'rotate(-1.5deg)' }}>right now.</span>
          </h1>
          <p style={{ fontSize: 'clamp(15px,1.7vw,18px)', color: 'var(--tx2,#aaa3c6)', maxWidth: '48ch', margin: '26px 0 0', lineHeight: 1.55 }}>Live prices pulled directly from each store — updated every 5 minutes.</p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, fontFamily: 'var(--fm)', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', color: 'var(--tx2)', background: 'var(--card)', border: '2px solid var(--line2)', borderRadius: 100, padding: '6px 13px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lime)', boxShadow: '0 0 7px var(--lime)', animation: 'pw-blink 1.6s ease-in-out infinite' }} />Refreshed just now<span style={{ opacity: 0.45, margin: '0 5px' }}>·</span>next sync in&nbsp;<span style={{ fontWeight: 700, color: 'var(--lime)', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ ...card, borderRadius: 17, padding: '18px 20px', boxShadow: '5px 5px 0 var(--cyan)', minWidth: 120 }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--tx)' }}>{all.length}</div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 500, letterSpacing: '.05em', color: 'var(--tx2,#aaa3c6)', marginTop: 7, textTransform: 'uppercase' }}>Deals live</div>
          </div>
          <div style={{ ...card, borderRadius: 17, padding: '18px 20px', boxShadow: '5px 5px 0 var(--lime)', minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--cyan)' }}>{totalFree}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pink)', animation: 'pw-blink 1.3s ease-in-out infinite' }} />
            </div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 500, letterSpacing: '.05em', color: 'var(--tx2,#aaa3c6)', marginTop: 7, textTransform: 'uppercase' }}>Free now</div>
          </div>
        </div>
      </section>

      {/* Search + filter toggle */}
      <section style={{ maxWidth: 1320, margin: '24px auto 0', padding: '0 26px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 12, ...card, borderRadius: 15, padding: '8px 16px 8px 18px', boxShadow: '6px 6px 0 var(--hard)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search these deals by title…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 16 }} />
            <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>FILTERS LIVE</span>
          </div>
          <button className="press" onClick={() => setShowFilters((s) => !s)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 11, ...card, borderRadius: 15, padding: '8px 20px', cursor: 'pointer', boxShadow: '6px 6px 0 var(--hard)', color: 'var(--tx,#f6f4ff)', transition: 'transform .1s,box-shadow .1s' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            <span style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em' }}>Filters</span>
            {activeCount > 0 && <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--pink)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '0 7px', lineHeight: 1.6 }}>{activeCount}</span>}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .25s', transform: showFilters ? 'rotate(180deg)' : 'none' }}><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
      </section>

      {/* Deal alert bar */}
      <section style={{ maxWidth: 1320, margin: '12px auto 0', padding: '0 26px' }}>
        <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 15, background: 'var(--panel,#120f1f)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 16, padding: '13px 16px 13px 22px', boxShadow: '6px 6px 0 var(--hard)', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'var(--grad)' }} />
          <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 13, ...card, boxShadow: '3px 3px 0 var(--pink)', display: 'grid', placeItems: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx,#f6f4ff)' }}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
          </span>
          <div style={{ flex: 1, minWidth: 210 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Set a deal alert</span>
              {alertList.length > 0 && <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '2px 8px' }}>{alertList.length} tracked</span>}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--tx2,#aaa3c6)', marginTop: 3, lineHeight: 1.45 }}>Pick any games on PlayWise — we'll email you the moment they drop in price or go free.</div>
          </div>
          <button className="press" onClick={() => { setAlertOpen(true); setAlertQuery('') }} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 700, color: '#0b0a12', background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 12, padding: '11px 17px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Set alert for deals
          </button>
        </div>
      </section>

      {/* Filters panel */}
      {showFilters && (
        <section style={{ maxWidth: 1320, margin: '14px auto 0', padding: '0 26px' }}>
          <div style={{ ...card, borderRadius: 20, boxShadow: '7px 7px 0 var(--hard)', padding: '6px 22px 22px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 0 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{ fontFamily: 'var(--fd)', fontSize: 16, fontWeight: 800, letterSpacing: '-.01em' }}>Filters</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx2)', background: 'var(--bg)', border: '2px solid var(--line2)', borderRadius: 8, padding: '4px 10px' }}><span style={{ color: 'var(--lime)' }}>{filtered.length}</span> results</span>
              </div>
              <div style={{ display: 'inline-flex', background: 'var(--bg)', border: '2px solid var(--line2)', borderRadius: 12, padding: 4 }}>
                {(['all', 'free', 'discount'] as DealType[]).map((t) => (
                  <button key={t} className="fbtn" onClick={() => setType(t)} style={{ font: 'inherit', fontSize: 13, fontWeight: type === t ? 700 : 600, cursor: 'pointer', borderRadius: 9, padding: '9px 16px', border: `2px solid ${type === t ? 'var(--bd,#f6f4ff)' : 'transparent'}`, background: type === t ? 'var(--lime)' : 'transparent', color: type === t ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{t === 'all' ? 'All' : t === 'free' ? 'Free Games' : 'Discounts'}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9, padding: '16px 0', borderTop: '2px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', width: 84, flexShrink: 0 }}>Sort</span>
              {SORT_LABELS.map((s) => (
                <button key={s.k} className="fbtn press" onClick={() => setSort(s.k)} style={pillBtn(sort === s.k)}>{s.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: '16px 0', borderTop: '2px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', width: 84, flexShrink: 0 }}>Price</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx2,#aaa3c6)' }}>$0</span>
                <input type="range" className="pwr" min={0} max={150} step={5} value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value, 10) || 0)} style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx2,#aaa3c6)' }}>$150</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 118, justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Up to</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 17, fontWeight: 700, color: 'var(--lime)', minWidth: 50, textAlign: 'right' }}>{maxPrice >= 150 ? 'Any' : `$${maxPrice}`}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 9, padding: '16px 0 4px', borderTop: '2px solid var(--line)' }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', width: 84, flexShrink: 0 }}>Stores</span>
              {storeList.map((st) => {
                const on = activeStores.includes(st.id)
                return (
                  <button key={st.id} className="fbtn press" onClick={() => toggleStore(st.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...pillBtn(on) }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.accent, border: '1.5px solid currentColor' }} />{st.name}
                  </button>
                )
              })}
              <div style={{ flex: 1 }} />
              <button onClick={() => setStores(null)} style={{ font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--tx2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>All</button>
              <button onClick={() => setStores([])} style={{ font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--tx2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>Clear</button>
              <button className="press" onClick={resetAll} style={{ font: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '8px 13px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)' }}>Reset all</button>
            </div>
          </div>
        </section>
      )}

      {/* Jump-to sticky bar */}
      <div style={{ position: 'sticky', top: 70, zIndex: 150, marginTop: 20, background: 'var(--bg,#0b0a12)', borderTop: '2px solid var(--line)', borderBottom: '2px solid var(--line)', boxShadow: '0 8px 20px -14px rgba(0,0,0,.6)' }}>
        <div className="rail" style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 26px', overflowX: 'auto' }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', flexShrink: 0 }}>Jump to</span>
          {sections.map((sec) => (
            <button key={sec.id} className="jumpchip press" onClick={() => scrollToStore(sec.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', flexShrink: 0, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 100, padding: '7px 13px', border: '2px solid var(--line2,#3a3460)', background: 'var(--card,#1a1630)', color: 'var(--tx,#f6f4ff)' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: sec.accent, border: '1.5px solid var(--bd,#f6f4ff)' }} />{sec.name}
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--tx3,#736c92)', background: 'var(--bg,#0b0a12)', border: '1.5px solid var(--line2,#3a3460)', borderRadius: 7, padding: '1px 6px' }}>{sec.deals.length}</span>
            </button>
          ))}
          <div style={{ flex: 1, minWidth: 8 }} />
          <span style={{ whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx2,#aaa3c6)' }}><span style={{ color: 'var(--lime)' }}>{filtered.length}</span> results</span>
        </div>
      </div>

      {/* Store sections */}
      <div style={{ maxWidth: 1320, margin: '0 auto', padding: '8px 26px 0' }}>
        {sections.map((sec) => (
          <section key={sec.id} data-store-id={sec.id} style={{ scrollMarginTop: 150, padding: '34px 0 6px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, borderBottom: '2px solid var(--line)', paddingBottom: 15 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ width: 50, height: 50, borderRadius: 14, background: sec.accent, border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--hard)', display: 'grid', placeItems: 'center', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 24, color: '#0b0a12' }}>{sec.mono}</span>
                <div>
                  <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, letterSpacing: '-.02em', margin: 0, lineHeight: 1 }}>{sec.name}</h2>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 12.5, fontWeight: 500, color: 'var(--tx2,#aaa3c6)', marginTop: 5 }}>{sec.countLabel}</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(232px,1fr))', gap: 18, marginTop: 20 }}>
              {sec.deals.map((item) => (
                <div key={item.id} className="dealc" style={withVar({ display: 'flex', flexDirection: 'column', ...card, borderRadius: 16, overflow: 'hidden', boxShadow: '4px 5px 0 var(--hard)' }, '--sc', item.accent)}>
                  <div style={{ position: 'relative', height: 150, background: item.cover, overflow: 'hidden', borderBottom: '2.5px solid var(--bd,#f6f4ff)' }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,.22) 1.4px,transparent 1.5px)', backgroundSize: '11px 11px' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 19, lineHeight: 1, color: 'rgba(255,255,255,.96)', letterSpacing: '-.01em', textShadow: '2px 2px 0 rgba(0,0,0,.3)', maxHeight: '100%', overflow: 'hidden' }}>{item.title}</span>
                    </div>
                    <span style={{ position: 'absolute', top: 9, right: 9, fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 12.5, color: '#0b0a12', background: item.badgeColor, border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '3px 8px', boxShadow: '2px 2px 0 rgba(0,0,0,.35)', transform: 'rotate(3deg)' }}>{item.badge}</span>
                    {item.leavingSoon && (
                      <span style={{ position: 'absolute', top: 9, left: 9, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 9.5, letterSpacing: '.04em', color: '#fff', background: 'var(--pink)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '3px 7px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pw-blink 1.1s ease-in-out infinite' }} />LEAVING SOON · {item.leftLabel}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '12px 13px 13px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 12 }}>
                      <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 20, color: item.priceColor }}>{item.priceText}</span>
                      {item.origText && <span style={{ fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--tx3,#736c92)', textDecoration: 'line-through' }}>{item.origText}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                      <button className="getbtn press" onClick={() => { if (item.storeUrl && item.storeUrl !== '#') window.open(item.storeUrl, '_blank', 'noopener,noreferrer'); else toast(`Opening ${item.storeName} → grab your deal`) }} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: 'var(--fd)', fontSize: 12, fontWeight: 700, color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '9px 8px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>Get Deal</button>
                      <button className="press" onClick={() => navigate(`/games/${item.slug}`)} style={{ flexShrink: 0, fontFamily: 'var(--ff)', fontSize: 12, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '9px 11px', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '2px 2px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>View details</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {sections.length === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 22px', background: 'var(--card,#1a1630)', border: '2.5px dashed var(--line2,#3a3460)', borderRadius: 20, marginTop: 24 }}>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 24, fontWeight: 800, letterSpacing: '-.02em' }}>No deals match your filters</div>
            <div style={{ fontSize: 14.5, color: 'var(--tx2,#aaa3c6)', marginTop: 10, lineHeight: 1.5 }}>Try removing a filter, widening the max price, or selecting more stores.</div>
            <button className="press" onClick={resetAll} style={{ marginTop: 22, fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 700, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '11px 18px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)' }}>Reset all filters</button>
          </div>
        )}
      </div>

      <section style={{ maxWidth: 1320, margin: '34px auto 0', padding: '0 26px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'var(--panel,#120f1f)', border: '2px solid var(--line)', borderRadius: 14, padding: '14px 18px', color: 'var(--tx2,#aaa3c6)', fontSize: 13, lineHeight: 1.5 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
          Prices pulled directly from each store's official API. May vary by region.
        </div>
      </section>

      {/* Deal alert modal */}
      {alertOpen && (
        <div onClick={() => setAlertOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '38px 16px', overflowY: 'auto', background: 'rgba(6,5,12,.62)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)' }}>
          <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal style={{ width: '100%', maxWidth: 564, margin: 'auto', ...card, borderRadius: 22, boxShadow: '9px 11px 0 var(--hard)', display: 'flex', flexDirection: 'column', maxHeight: '86vh', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '19px 21px 16px', borderBottom: '2px solid var(--line)' }}>
              <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, background: 'var(--bg,#0b0a12)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--pink)', display: 'grid', placeItems: 'center' }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx,#f6f4ff)' }}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--pink)' }}>DEAL ALERTS</div>
                <div style={{ fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', marginTop: 3 }}>Track a game, grab the drop</div>
              </div>
              <button className="press" onClick={() => setAlertOpen(false)} title="Close" style={{ width: 38, height: 38, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg,#0b0a12)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, cursor: 'pointer', color: 'var(--tx,#f6f4ff)', boxShadow: '2px 2px 0 var(--hard)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '17px 21px 6px' }}>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', margin: '0 0 8px' }}>Email for alerts</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 12, padding: '10px 13px' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                <input ref={alertEmailRef} type="email" placeholder="you@email.com" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 15 }} />
              </div>

              <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', margin: '18px 0 8px' }}>Find a game</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg,#0b0a12)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 12, padding: '10px 13px', boxShadow: '3px 3px 0 var(--hard)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
                <input autoFocus value={alertQuery} onChange={(e) => setAlertQuery(e.target.value)} placeholder="Search all games on PlayWise…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 15 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '15px 0 9px' }}>
                <span style={{ fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-.01em' }}>{alertQuery.trim() ? 'Search results' : 'Popular on PlayWise'}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--tx3,#736c92)', letterSpacing: '.04em' }}>searches the full catalog</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 234, overflowY: 'auto', paddingRight: 2 }}>
                {alertResults.map((g) => (
                  <div key={g.title} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 9px', border: '2px solid var(--line2,#3a3460)', borderRadius: 12, background: 'var(--bg,#0b0a12)' }}>
                    <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 9, background: g.cover, border: '2px solid var(--bd,#f6f4ff)', display: 'grid', placeItems: 'center', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 14, color: 'rgba(255,255,255,.96)', textShadow: '1px 1px 0 rgba(0,0,0,.3)' }}>{g.initial}</span>
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 13.5, letterSpacing: '-.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</div>
                    {g.inList ? (
                      <button className="press" onClick={() => removeAlert(g.title)} title="Remove" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ff)', fontSize: 12, fontWeight: 800, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 9, padding: '7px 11px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>Added
                      </button>
                    ) : (
                      <button className="press" onClick={() => addAlert(g.title)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--ff)', fontSize: 12, fontWeight: 700, color: 'var(--tx,#f6f4ff)', ...card, borderRadius: 9, padding: '7px 11px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Add
                      </button>
                    )}
                  </div>
                ))}
                {alertQuery.trim() && alertResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--tx2,#aaa3c6)', fontSize: 13.5, lineHeight: 1.5 }}>No games match that title.<br />Try a different spelling or a shorter word.</div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '19px 0 0' }}>
                <span style={{ fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-.01em' }}>Your alert list</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 7, padding: '2px 8px' }}>{alertList.length}</span>
              </div>
              {alertList.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 11 }}>
                  {alertList.map((t) => (
                    <button key={t} className="press" onClick={() => removeAlert(t)} title="Remove" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--ff)', fontSize: 12.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', ...card, borderRadius: 9, padding: '7px 11px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)' }}>{t}<span style={{ display: 'grid', placeItems: 'center', width: 15, height: 15, borderRadius: '50%', background: 'var(--pink)', color: '#fff' }}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></span></button>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: 11, textAlign: 'center', padding: '18px 12px', border: '2px dashed var(--line2,#3a3460)', borderRadius: 12, color: 'var(--tx2,#aaa3c6)', fontSize: 13, lineHeight: 1.5 }}>No games yet — search above and hit <b style={{ color: 'var(--tx,#f6f4ff)' }}>Add</b>. They'll show up here.</div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 21px', borderTop: '2px solid var(--line)', background: 'var(--card,#1a1630)' }}>
              <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.03em' }}>Free · unsubscribe anytime</div>
              <button className="press" onClick={() => setAlertOpen(false)} style={{ font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 11, padding: '10px 15px', cursor: 'pointer' }}>Maybe later</button>
              <button className="press" onClick={() => void saveAlerts()} disabled={alertSaving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: '#0b0a12', background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '10px 17px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', opacity: alertSaving ? 0.7 : 1 }}>{alertSaving ? 'Saving…' : 'Save alerts'}{!alertSaving && alertList.length > 0 && <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, background: '#0b0a12', color: 'var(--lime)', borderRadius: 6, padding: '1px 7px' }}>{alertList.length}</span>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
