import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../../lib/api'
import {
  PRICE_HISTORY,
  mapNews,
  mapTourns,
  relPast,
  seededPick,
  type NewsVM,
  type TournVM,
} from '../../lib/homeData'

type Tab = 'deals' | 'tournaments' | 'news'

const SPRING = 'cubic-bezier(.34,1.56,.64,1)'
const DAY = 86400000

interface TMPoint {
  t: number
  amount: number
}

interface TMGame {
  slug: string
  title: string
  image: string | null
  currency: string
  points: TMPoint[]
  regular: number | null
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount)
  } catch {
    return `$${amount.toFixed(2)}`
  }
}

function shortDate(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Dev fallback: turn the representative PRICE_HISTORY table into TMGame shapes.
function fallbackTMGames(): TMGame[] {
  const now = Date.now()
  return Object.entries(PRICE_HISTORY).map(([title, data]) => ({
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title,
    image: null,
    currency: 'USD',
    regular: data[0],
    points: data.map((amount, i) => ({ t: now - (data.length - 1 - i) * 30 * DAY, amount })),
  }))
}

export default function TimeMachine() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('deals')
  const [games, setGames] = useState<TMGame[]>([])
  const [probing, setProbing] = useState(true)
  const [sel, setSel] = useState<string>('')
  // per-game tab data; null = loading, [] = confirmed empty
  const [gameTourns, setGameTourns] = useState<TournVM[] | null>(null)
  const [gameNews, setGameNews] = useState<NewsVM[] | null>(null)
  const tabCache = useRef<Record<string, { tourns: TournVM[]; news: NewsVM[] }>>({})
  const rootRef = useRef<HTMLDivElement>(null)

  // imperative state kept in refs so dragging never triggers React re-renders
  const chart = useRef<{
    timeAt: (ratio: number) => number
    priceAt: (time: number) => number
    xOf: (time: number) => number
    yOf: (v: number) => number
    t0: number
    t1: number
    min: number
    X0: number
    X1: number
  } | null>(null)
  const tmT = useRef<number | null>(null) // selected time (ms) on the chart
  const tSel = useRef(0)
  const nSel = useRef(0)

  const game = games.find((g) => g.slug === sel) || games[0] || null

  // ---- resolve a fresh rotating set of real games with price history --------
  // Probe serially in small batches: the price endpoint is ITAD-backed and 500s
  // under heavy concurrency, so we trade a little latency for reliability and
  // reveal games progressively as each one resolves.
  useEffect(() => {
    let ignore = false
    const TARGET = 5
    const toTMGame = (c: { slug: string; title: string; image: string | null }, snap: Awaited<ReturnType<typeof api.fetchPrices>>): TMGame | null => {
      const pts = snap.history?.available ? snap.history.points || [] : []
      const raw = pts
        .map((pt) => ({ t: Date.parse(pt.timestamp), amount: pt.amount }))
        .filter((pt) => Number.isFinite(pt.t) && Number.isFinite(pt.amount) && pt.amount > 0)
        .sort((a, b) => a.t - b.t)
      if (raw.length < 5) return null
      // ITAD history occasionally carries junk points (e.g. ₹2.19 for a ₹3000 game).
      // Drop anything below 10% of the median so the low + chart scale stay honest.
      const sortedAmts = raw.map((p) => p.amount).sort((a, b) => a - b)
      const median = sortedAmts[Math.floor(sortedAmts.length / 2)] || 0
      const floorAmt = median * 0.1
      const points = raw.filter((p) => p.amount >= floorAmt)
      if (points.length < 5) return null
      const last = pts[pts.length - 1]
      return {
        slug: c.slug,
        title: c.title,
        image: c.image,
        currency: (last.currency || snap.bestDeal?.currency || 'USD') as string,
        regular: typeof last.regularAmount === 'number' ? last.regularAmount : null,
        points,
      }
    }
    void (async () => {
      try {
        const lib = await api.fetchLibrary({ sort: 'popular', limit: 60, page: 1 })
        if (ignore) return
        const candidates = seededPick(
          (lib.games || []).filter((g) => g.image).map((g) => ({ slug: g.slug, title: g.title, image: g.image })),
          Math.floor(Math.random() * 1e6) + 1,
          14
        )
        const collected: TMGame[] = []
        for (let i = 0; i < candidates.length && collected.length < TARGET; i += 2) {
          if (ignore) return
          const batch = candidates.slice(i, i + 2)
          const snaps = await Promise.allSettled(batch.map((c) => api.fetchPrices(c.slug)))
          if (ignore) return
          snaps.forEach((s, j) => {
            if (collected.length >= TARGET || s.status !== 'fulfilled') return
            const tm = toTMGame(batch[j], s.value)
            if (tm) collected.push(tm)
          })
          if (collected.length) {
            setGames([...collected])
            setSel((cur) => cur || collected[0].slug)
            setProbing(false) // first game is enough to render
          }
        }
        if (!ignore && collected.length < 2) {
          const fb = fallbackTMGames()
          setGames(fb)
          setSel((cur) => cur || fb[0]?.slug || '')
        }
      } catch {
        if (!ignore) {
          const fb = fallbackTMGames()
          setGames(fb)
          setSel((cur) => cur || fb[0]?.slug || '')
        }
      } finally {
        if (!ignore) setProbing(false)
      }
    })()
    return () => { ignore = true }
  }, [])

  // ---- per-game tournaments + news for the other two tabs -------------------
  useEffect(() => {
    if (!game) return
    const slug = game.slug
    const cached = tabCache.current[slug]
    if (cached) {
      setGameTourns(cached.tourns)
      setGameNews(cached.news)
      return
    }
    let ignore = false
    setGameTourns(null)
    setGameNews(null)
    void (async () => {
      const [t, n] = await Promise.allSettled([
        api.fetchTournaments({ game: slug, limit: 10 }),
        api.fetchGameNews(slug),
      ])
      if (ignore) return
      const tourns = t.status === 'fulfilled' ? mapTourns(t.value.slice(0, 8)) : []
      const news = n.status === 'fulfilled' ? mapNews(n.value.slice(0, 8)) : []
      tabCache.current[slug] = { tourns, news }
      setGameTourns(tourns)
      setGameNews(news)
    })()
    return () => { ignore = true }
  }, [game])

  useEffect(() => {
    const root = rootRef.current
    if (!root || !game) return
    const q = (sel2: string) => root.querySelector(sel2) as HTMLElement | null
    const cleanups: Array<() => void> = []

    const dragX = (el: HTMLElement | null, cb: (ratio: number, release: boolean) => void) => {
      if (!el) return
      const ratioOf = (e: PointerEvent) => {
        const r = el.getBoundingClientRect()
        return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)))
      }
      let active = false
      const down = (e: PointerEvent) => { active = true; try { el.setPointerCapture(e.pointerId) } catch { /* noop */ } cb(ratioOf(e), false); e.preventDefault() }
      const move = (e: PointerEvent) => { if (active) cb(ratioOf(e), false) }
      const end = (e: PointerEvent) => { if (!active) return; active = false; cb(ratioOf(e), true) }
      el.addEventListener('pointerdown', down)
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', end)
      el.addEventListener('pointercancel', end)
      cleanups.push(() => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end) })
    }

    // ---------------- PRICE CHART (real, time-based) ----------------
    const scrub = (time: number, release: boolean) => {
      const c = chart.current
      if (!c) return
      time = Math.max(c.t0, Math.min(c.t1, time))
      tmT.current = time
      const price = c.priceAt(time)
      const x = c.xOf(time)
      const y = c.yOf(price)
      const lx = `${(x / 700) * 100}%`
      const ly = `${(y / 240) * 100}%`
      const spring = release ? `left .42s ${SPRING},top .42s ${SPRING}` : 'none'
      const vline = q('[data-tm="vline"]'); const hdot = q('[data-tm="hdot"]'); const tag = q('[data-tm="tag"]')
      if (vline) { vline.style.transition = release ? `left .42s ${SPRING}` : 'none'; vline.style.left = lx }
      if (hdot) { hdot.style.transition = spring; hdot.style.left = lx; hdot.style.top = ly }
      if (tag) { tag.style.transition = spring; tag.style.left = lx; tag.style.top = ly; tag.textContent = fmtMoney(price, game.currency) }
      const pr = q('[data-tm="price"]'); if (pr) pr.textContent = fmtMoney(price, game.currency)
      const dt = q('[data-tm="date"]'); if (dt) dt.textContent = shortDate(time)
      const ref = game.regular || game.points[0].amount
      const pct = Math.round((1 - price / ref) * 100)
      const dl = q('[data-tm="delta"]'); if (dl) { dl.textContent = `${pct >= 0 ? `−${pct}` : `+${-pct}`}% vs list price`; dl.style.background = pct >= 50 ? 'var(--lime)' : pct > 0 ? 'var(--cyan)' : 'var(--line2,#3a3460)' }
      const low = q('[data-tm="low"]'); if (low) low.textContent = fmtMoney(c.min, game.currency)
    }

    const drawChart = () => {
      const pts = game.points
      const n = pts.length
      const X0 = 34, X1 = 668, Y0 = 24, Y1 = 196
      const t0 = pts[0].t, t1 = pts[n - 1].t
      const min = Math.min(...pts.map((p) => p.amount))
      const max = Math.max(...pts.map((p) => p.amount))
      const span = Math.max(1, max - min)
      const xOf = (time: number) => X0 + ((time - t0) / Math.max(1, t1 - t0)) * (X1 - X0)
      const yOf = (v: number) => Y1 - ((v - min) / span) * (Y1 - Y0)
      const timeAt = (ratio: number) => t0 + ratio * (t1 - t0)
      const priceAt = (time: number) => {
        if (time <= t0) return pts[0].amount
        if (time >= t1) return pts[n - 1].amount
        let i = 1
        while (i < n && pts[i].t < time) i++
        const a = pts[i - 1], b = pts[i]
        const f = (time - a.t) / Math.max(1, b.t - a.t)
        return a.amount + (b.amount - a.amount) * f
      }
      chart.current = { timeAt, priceAt, xOf, yOf, t0, t1, min, X0, X1 }
      let grid = ''
      for (let g2 = 0; g2 <= 3; g2++) {
        const y = Y0 + (g2 / 3) * (Y1 - Y0)
        grid += `<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="var(--line2,#3a3460)" stroke-width="1" stroke-dasharray="2 7" vector-effect="non-scaling-stroke"/>`
      }
      const linePts = pts.map((p) => `${xOf(p.t)},${yOf(p.amount)}`).join(' ')
      const area = `M ${X0},${Y1} ${pts.map((p) => `L ${xOf(p.t)},${yOf(p.amount)}`).join(' ')} L ${X1},${Y1} Z`
      const dots = pts.map((p) => `<circle cx="${xOf(p.t)}" cy="${yOf(p.amount)}" r="3.1" fill="var(--card,#1a1630)" stroke="var(--vio)" stroke-width="2.2" vector-effect="non-scaling-stroke"/>`).join('')
      // ~6 evenly spaced date ticks across the real span
      const ticks = 5
      let labels = ''
      for (let i = 0; i <= ticks; i++) {
        const tt = t0 + (i / ticks) * (t1 - t0)
        labels += `<text x="${xOf(tt)}" y="220" fill="var(--tx3,#736c92)" font-size="11" font-family="JetBrains Mono,monospace" text-anchor="middle">${new Date(tt).toLocaleDateString('en-US', { month: 'short' })}</text>`
      }
      const svg = q('[data-tm="svg"]'); if (!svg) return
      svg.innerHTML = `<defs><linearGradient id="tmArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a24dff" stop-opacity="0.45"/><stop offset="1" stop-color="#a24dff" stop-opacity="0"/></linearGradient><linearGradient id="tmLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff2e6e"/><stop offset="0.5" stop-color="#a24dff"/><stop offset="1" stop-color="#1fd7ff"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#tmArea)"/><polyline data-tm="line" points="${linePts}" fill="none" stroke="url(#tmLine)" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>${dots}${labels}`
      const line = q('[data-tm="line"]') as unknown as SVGPolylineElement | null
      if (line && line.getTotalLength) {
        try {
          const L = line.getTotalLength()
          line.style.transition = 'none'
          line.style.strokeDasharray = String(L)
          line.style.strokeDashoffset = String(L)
          requestAnimationFrame(() => { line.style.transition = 'stroke-dashoffset 1.05s var(--ease,cubic-bezier(.16,1,.3,1))'; line.style.strokeDashoffset = '0' })
        } catch { /* noop */ }
      }
      const ov = q('[data-tm="overlay"]')
      if (ov) {
        ov.innerHTML =
          '<div data-tm="vline" style="position:absolute;top:0;bottom:20px;width:2px;background:var(--bd,#f6f4ff);opacity:.5;transform:translateX(-1px)"></div>' +
          '<div data-tm="lowb" style="position:absolute;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:4px;background:var(--cyan);border:2px solid var(--bd,#f6f4ff);box-shadow:1px 1px 0 var(--hard)"></div>' +
          '<div data-tm="hdot" style="position:absolute;width:18px;height:18px;border-radius:50%;background:var(--lime);border:3px solid var(--bd,#f6f4ff);box-shadow:2px 2px 0 var(--hard);transform:translate(-50%,-50%)"></div>' +
          '<div data-tm="tag" style="position:absolute;transform:translate(-50%,-145%);background:var(--bd,#f6f4ff);color:var(--bg,#0b0a12);font-family:JetBrains Mono,monospace;font-weight:700;font-size:13px;padding:4px 9px;border-radius:9px;white-space:nowrap">—</div>'
        const lowPt = pts.reduce((best, p) => (p.amount < best.amount ? p : best), pts[0])
        const lb = q('[data-tm="lowb"]'); if (lb) { lb.style.left = `${(xOf(lowPt.t) / 700) * 100}%`; lb.style.top = `${(yOf(lowPt.amount) / 240) * 100}%` }
      }
    }

    // ---------------- SCRUB TRACKS (this game's tournaments / news) --------
    const now = Date.now()
    const tItems = (gameTourns || []).slice().sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    const nItems = (gameNews || []).slice().sort((a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt))
    // dynamic windows sized to the data (min 10 days ahead / 5 days back)
    const tWindow = Math.max(10 * DAY, ...tItems.map((t) => +new Date(t.startsAt) - now))
    const nWindow = Math.max(5 * DAY, ...nItems.map((t) => now - +new Date(t.publishedAt)))
    const tRatios = tItems.map((t) => Math.max(0.03, Math.min(0.97, (+new Date(t.startsAt) - now) / tWindow)))
    const nRatios = nItems.map((t) => Math.max(0.03, Math.min(0.97, 1 - (now - +new Date(t.publishedAt)) / nWindow)))
    const tDays = Math.ceil(tWindow / DAY)
    const nDays = Math.ceil(nWindow / DAY)
    const twl = q('[data-tm="twlabel"]'); if (twl) twl.textContent = `+${tDays} days`
    const nwl = q('[data-tm="nwlabel"]'); if (nwl) nwl.textContent = `${nDays} days ago`

    const paintTrack = (kind: 't' | 'n') => {
      const track = q(kind === 't' ? '[data-tm="ttrack"]' : '[data-tm="ntrack"]'); if (!track) return
      const items = kind === 't' ? tItems : nItems
      const ratios = kind === 't' ? tRatios : nRatios
      const si = kind === 't' ? tSel.current : nSel.current
      const selRatio = ratios[si] ?? 0
      const notches = items.map((it, i) => {
        const live = kind === 't' && (it as TournVM).live
        const col = live ? 'var(--pink)' : kind === 't' ? 'var(--cyan)' : 'var(--amber)'
        const shp = kind === 't' ? '3px' : '50%'
        const sc = i === si ? 'transform:translate(-50%,-50%) scale(1.35);' : 'transform:translate(-50%,-50%);'
        return `<div style="position:absolute;left:${ratios[i] * 100}%;top:50%;${sc}width:13px;height:13px;border-radius:${shp};background:${col};border:2px solid var(--bd,#f6f4ff);transition:transform .3s var(--ease,ease)"></div>`
      }).join('')
      track.innerHTML = `<div style="position:absolute;left:0;right:0;top:50%;height:4px;transform:translateY(-50%);background:var(--line2,#3a3460);border-radius:4px"></div>${notches}<div data-tm="${kind}head" style="position:absolute;top:50%;left:${selRatio * 100}%;transform:translate(-50%,-50%);width:22px;height:34px;border-radius:9px;background:var(--lime);border:2.5px solid var(--bd,#f6f4ff);box-shadow:2px 2px 0 var(--hard);transition:left .45s ${SPRING}"></div>`
    }

    const fillTourn = (t?: TournVM) => {
      if (!t) return
      const ms = +new Date(t.startsAt) - now
      const frac = Math.max(0.06, Math.min(1, 1 - ms / tWindow))
      const ring = q('[data-tm="tring"]'); if (ring) { const C = 264; ring.style.strokeDashoffset = String(C * (1 - (t.live ? 1 : frac))); ring.style.stroke = t.live ? 'var(--pink)' : 'var(--cyan)' }
      const days = q('[data-tm="tdays"]'); if (days) days.textContent = t.live || ms <= 0 ? 'LIVE' : `${Math.max(1, Math.ceil(ms / DAY))}d`
      const g = q('[data-tm="tgame"]'); if (g) g.textContent = t.game
      const ti = q('[data-tm="ttitle"]'); if (ti) ti.textContent = t.title
      const wh = q('[data-tm="twhen"]'); if (wh) wh.textContent = t.live ? 'On air now' : `starts ${t.rel}`
      const st = q('[data-tm="tstatus"]'); if (st) { st.textContent = t.statusLabel; st.style.background = t.live ? 'var(--pink)' : 'rgba(0,0,0,.55)' }
    }

    const fillNews = (n: NewsVM | undefined, idx: number, total: number) => {
      if (!n) return
      const src = q('[data-tm="nsource"]'); if (src) { src.textContent = (n.source || '').toUpperCase(); src.style.background = n.srcColor }
      const hd = q('[data-tm="nheadline"]'); if (hd) hd.textContent = n.title
      const tm = q('[data-tm="ntime"]'); if (tm) tm.textContent = n.time || relPast(n.publishedAt, now)
      const ix = q('[data-tm="nidx"]'); if (ix) ix.textContent = `Story ${idx + 1} of ${total}`
    }

    const trackScrub = (kind: 't' | 'n', ratio: number, release: boolean) => {
      const items = kind === 't' ? tItems : nItems
      const ratios = kind === 't' ? tRatios : nRatios
      if (!items.length) return
      let bi = 0, bd = 2
      ratios.forEach((r, i) => { const d = Math.abs(r - ratio); if (d < bd) { bd = d; bi = i } })
      if (kind === 't') tSel.current = bi; else nSel.current = bi
      const head = q(kind === 't' ? '[data-tm="thead"]' : '[data-tm="nhead"]')
      const target = release ? ratios[bi] : ratio
      if (head) { head.style.transition = release ? `left .45s ${SPRING}` : 'none'; head.style.left = `${target * 100}%` }
      if (release) paintTrack(kind)
      if (kind === 't') fillTourn(items[bi] as TournVM); else fillNews(items[bi] as NewsVM, bi, items.length)
    }

    // ---- wire up the active panel ----
    if (tab === 'deals') {
      drawChart()
      const c = chart.current
      scrub(tmT.current == null ? (c ? c.t1 : Date.now()) : tmT.current, true)
      dragX(q('[data-tm="chartwrap"]'), (ratio, release) => {
        const c2 = chart.current; if (!c2) return
        const sx = ratio * 700
        const time = c2.timeAt((sx - c2.X0) / (c2.X1 - c2.X0))
        scrub(time, release)
      })
    } else if (tab === 'tournaments' && tItems.length) {
      tSel.current = Math.min(tSel.current, tItems.length - 1)
      paintTrack('t')
      fillTourn(tItems[tSel.current])
      dragX(q('[data-tm="ttrack"]'), (ratio, release) => trackScrub('t', ratio, release))
    } else if (tab === 'news' && nItems.length) {
      nSel.current = nItems.length - 1
      paintTrack('n')
      fillNews(nItems[nSel.current], nSel.current, nItems.length)
      dragX(q('[data-tm="ntrack"]'), (ratio, release) => trackScrub('n', ratio, release))
    }

    return () => cleanups.forEach((c) => c())
  }, [tab, game, gameTourns, gameNews])

  const tabBtn = (key: Tab, label: string) => {
    const on = tab === key
    return (
      <button key={key} onClick={() => setTab(key)} style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 15px', background: on ? 'var(--lime)' : 'transparent', color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{label}</button>
    )
  }

  const gameChip = (g: TMGame) => {
    const on = game?.slug === g.slug
    return (
      <button key={g.slug} onClick={() => { tmT.current = null; tSel.current = 0; setSel(g.slug) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: 'pointer', borderRadius: 100, padding: '5px 13px 5px 5px', border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, background: on ? 'var(--lime)' : 'transparent', color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>
        <span style={{ position: 'relative', width: 26, height: 26, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: 'var(--card2,#221c3c)', border: `1.5px solid ${on ? '#0b0a12' : 'var(--line2,#3a3460)'}`, display: 'grid', placeItems: 'center', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 11 }}>
          {g.image ? <img src={g.image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : g.title[0]}
        </span>
        <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
      </button>
    )
  }

  const emptyTab = (label: string, cta: string, to: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '42px 22px', textAlign: 'center' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 54, height: 54, borderRadius: 16, background: 'var(--card2,#221c3c)', border: '2.5px solid var(--line2,#3a3460)', color: 'var(--tx3,#736c92)' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
      </span>
      <div style={{ fontSize: 14.5, color: 'var(--tx2,#aaa3c6)', lineHeight: 1.5, maxWidth: '38ch' }}>{label}</div>
      <button className="press" onClick={() => navigate(to)} style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '10px 16px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)' }}>{cta}</button>
    </div>
  )

  const loadingTab = (
    <div style={{ display: 'grid', placeItems: 'center', padding: '52px 22px', fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--tx3,#736c92)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--vio)', animation: 'pw-blink 1s ease-in-out infinite' }} />Loading {game?.title}…
      </span>
    </div>
  )

  return (
    <section id="timemachine" style={{ maxWidth: 1200, margin: '0 auto', padding: '104px 26px 0' }}>
      <div ref={rootRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 22 }}>
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(28px,4.4vw,50px)', fontWeight: 800, letterSpacing: '-.03em', margin: '7px 0 0', lineHeight: 0.98 }}>Rewind the<br />timeline.</h2>
            <p style={{ fontSize: 15.5, color: 'var(--tx2,#aaa3c6)', margin: '14px 0 0', lineHeight: 1.5 }}>Pick a game — a fresh set every visit — then drag the playhead through its real price history, brackets and headlines.</p>
          </div>
          <div style={{ display: 'inline-flex', gap: 5, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 14, padding: 5, boxShadow: '4px 4px 0 var(--hard)' }}>
            {tabBtn('deals', 'Price')}
            {tabBtn('tournaments', 'Tourneys')}
            {tabBtn('news', 'News')}
          </div>
        </div>

        <div style={{ background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 24, boxShadow: '9px 9px 0 var(--hard)', overflow: 'hidden' }}>
          {/* rotating game picker (shared by all tabs) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '18px 24px 0' }}>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', alignSelf: 'center', marginRight: 2 }}>GAME</span>
            {probing && !games.length ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx3,#736c92)', padding: '7px 4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--vio)', animation: 'pw-blink 1s ease-in-out infinite' }} />finding games with price history…
              </span>
            ) : (
              games.map(gameChip)
            )}
          </div>

          {game && tab === 'deals' && (
            <div style={{ padding: '18px 24px 24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26 }}>
                <div style={{ flex: '0 0 200px', minWidth: 180 }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Price on <span data-tm="date" style={{ color: 'var(--tx,#f6f4ff)', fontWeight: 700 }}>—</span></div>
                  <div data-tm="price" style={{ fontFamily: 'var(--fd)', fontSize: 44, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, marginTop: 8, color: 'var(--lime)' }}>—</div>
                  <div data-tm="delta" style={{ display: 'inline-block', fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, marginTop: 12, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '4px 10px' }}>—</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--tx2,#aaa3c6)' }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--cyan)', border: '1.5px solid var(--bd,#f6f4ff)' }} />Lowest ever <b data-tm="low" style={{ color: 'var(--tx,#f6f4ff)' }}>—</b>
                  </div>
                  <button className="press" onClick={() => navigate(`/games/${game.slug}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 16, fontFamily: 'var(--ff)', fontSize: 12.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 10, padding: '8px 13px', cursor: 'pointer' }}>
                    View game<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                </div>
                <div data-tm="chartwrap" style={{ position: 'relative', flex: '1 1 360px', minWidth: 280, touchAction: 'none', cursor: 'ew-resize', alignSelf: 'stretch' }}>
                  <svg data-tm="svg" viewBox="0 0 700 240" preserveAspectRatio="none" style={{ width: '100%', height: 236, display: 'block', overflow: 'visible' }} />
                  <div data-tm="overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
          )}

          {game && tab === 'tournaments' && (
            <div style={{ padding: '18px 24px 24px' }}>
              {gameTourns === null ? loadingTab : gameTourns.length === 0 ? (
                emptyTab(`No open brackets for ${game.title} right now — we watch start.gg, FACEIT, Battlefy & Discord around the clock.`, 'Browse all tournaments →', '/tournaments')
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 26, alignItems: 'center' }}>
                  <div style={{ flex: '1 1 320px', minWidth: 280, background: 'var(--card2,#221c3c)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 18, padding: 20, boxShadow: '5px 5px 0 var(--hard)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
                        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                          <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line2,#3a3460)" strokeWidth="9" />
                          <circle data-tm="tring" cx="50" cy="50" r="42" fill="none" stroke="var(--cyan)" strokeWidth="9" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="120" style={{ transition: 'stroke-dashoffset .5s var(--ease),stroke .3s' }} />
                        </svg>
                        <div data-tm="tdays" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 15 }}>—</div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div data-tm="tstatus" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 10, letterSpacing: '.08em', color: '#fff', background: 'rgba(0,0,0,.55)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '3px 8px', marginBottom: 9 }}>UPCOMING</div>
                        <div data-tm="tgame" style={{ fontFamily: 'var(--fd)', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>{game.title}</div>
                        <div data-tm="ttitle" style={{ fontSize: 13.5, color: 'var(--tx2,#aaa3c6)', marginTop: 4, lineHeight: 1.3 }}>—</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--tx2,#aaa3c6)', borderTop: '2px solid var(--line)', paddingTop: 14 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--amber)' }} /><span data-tm="twhen" style={{ fontWeight: 700, color: 'var(--tx,#f6f4ff)' }}>—</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 260 }}>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Scrub {game.title}'s upcoming brackets →</div>
                    <div data-tm="ttrack" style={{ position: 'relative', height: 64, cursor: 'ew-resize', touchAction: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', marginTop: 6 }}><span>Now</span><span data-tm="twlabel">+10 days</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {game && tab === 'news' && (
            <div style={{ padding: '18px 24px 24px' }}>
              {gameNews === null ? loadingTab : gameNews.length === 0 ? (
                emptyTab(`No headlines for ${game.title} in the feed yet — sources update every 30 minutes.`, 'Browse all news →', '/news')
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 26, alignItems: 'center' }}>
                  <div style={{ flex: '1 1 320px', minWidth: 280, background: 'var(--card2,#221c3c)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 18, padding: 20, boxShadow: '5px 5px 0 var(--hard)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                      <span data-tm="nsource" style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em', color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '4px 10px' }}>—</span>
                      <span data-tm="ntime" style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx3,#736c92)' }}>—</span>
                    </div>
                    <div data-tm="nheadline" style={{ fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.18 }}>—</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx3,#736c92)', borderTop: '2px solid var(--line)', paddingTop: 13 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pink)', animation: 'pw-blink 1.3s ease-in-out infinite' }} /><span data-tm="nidx">—</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 300px', minWidth: 260 }}>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>⟲ Rewind {game.title}'s feed →</div>
                    <div data-tm="ntrack" style={{ position: 'relative', height: 64, cursor: 'ew-resize', touchAction: 'none' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', marginTop: 6 }}><span data-tm="nwlabel">5 days ago</span><span>Now</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
