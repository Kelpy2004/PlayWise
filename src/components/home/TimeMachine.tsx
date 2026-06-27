import { useEffect, useRef, useState } from 'react'

import {
  PRICE_HISTORY,
  TM_GAMES,
  TM_MONTHS,
  fallbackNews,
  fallbackTourns,
  type NewsVM,
  type TournVM,
} from '../../lib/homeData'

type Tab = 'deals' | 'tournaments' | 'news'

const SPRING = 'cubic-bezier(.34,1.56,.64,1)'

export default function TimeMachine({ tourns, news }: { tourns: TournVM[]; news: NewsVM[] }) {
  const [tab, setTab] = useState<Tab>('deals')
  const [game, setGame] = useState<string>(TM_GAMES[0])
  const rootRef = useRef<HTMLDivElement>(null)

  // imperative state kept in refs so dragging never triggers React re-renders
  const chart = useRef<{ tx: (i: number) => number; py: (v: number) => number; data: number[]; n: number; X0: number; X1: number } | null>(null)
  const tmT = useRef<number | null>(null)
  const tSel = useRef(0)
  const nSel = useRef(0)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const q = (sel: string) => root.querySelector(sel) as HTMLElement | null
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

    // ---------------- PRICE CHART ----------------
    const scrub = (t: number, release: boolean) => {
      const c = chart.current
      if (!c) return
      const { data, n, tx, py } = c
      t = Math.max(0, Math.min(n - 1, t))
      if (release) t = Math.round(t)
      tmT.current = t
      const i0 = Math.floor(t)
      const i1 = Math.min(n - 1, Math.ceil(t))
      const f = t - i0
      const price = data[i0] + (data[i1] - data[i0]) * f
      const x = tx(t)
      const y = py(price)
      const lx = `${(x / 700) * 100}%`
      const ly = `${(y / 240) * 100}%`
      const spring = release ? `left .42s ${SPRING},top .42s ${SPRING}` : 'none'
      const vline = q('[data-tm="vline"]'); const hdot = q('[data-tm="hdot"]'); const tag = q('[data-tm="tag"]')
      if (vline) { vline.style.transition = release ? `left .42s ${SPRING}` : 'none'; vline.style.left = lx }
      if (hdot) { hdot.style.transition = spring; hdot.style.left = lx; hdot.style.top = ly }
      if (tag) { tag.style.transition = spring; tag.style.left = lx; tag.style.top = ly; tag.textContent = `$${price.toFixed(2)}` }
      const mi = Math.round(t)
      const pr = q('[data-tm="price"]'); if (pr) pr.textContent = `$${price.toFixed(2)}`
      const dt = q('[data-tm="date"]'); if (dt) dt.textContent = `${TM_MONTHS[mi]} ${mi < 6 ? '2025' : '2026'}`
      const pct = Math.round((1 - price / data[0]) * 100)
      const dl = q('[data-tm="delta"]'); if (dl) { dl.textContent = `${pct >= 0 ? `−${pct}` : `+${-pct}`}% vs launch`; dl.style.background = pct >= 50 ? 'var(--lime)' : pct > 0 ? 'var(--cyan)' : 'var(--line2,#3a3460)' }
      const low = q('[data-tm="low"]'); if (low) low.textContent = `$${Math.min(...data).toFixed(2)}`
    }

    const drawChart = (g: string) => {
      const data = PRICE_HISTORY[g]
      if (!data) return
      const n = data.length
      const X0 = 34, X1 = 668, Y0 = 24, Y1 = 196
      const min = Math.min(...data), max = Math.max(...data), span = Math.max(1, max - min)
      const tx = (i: number) => X0 + (i / (n - 1)) * (X1 - X0)
      const py = (v: number) => Y1 - ((v - min) / span) * (Y1 - Y0)
      chart.current = { tx, py, data, n, X0, X1 }
      let grid = ''
      for (let g2 = 0; g2 <= 3; g2++) {
        const y = Y0 + (g2 / 3) * (Y1 - Y0)
        grid += `<line x1="${X0}" y1="${y}" x2="${X1}" y2="${y}" stroke="var(--line2,#3a3460)" stroke-width="1" stroke-dasharray="2 7" vector-effect="non-scaling-stroke"/>`
      }
      const linePts = data.map((v, i) => `${tx(i)},${py(v)}`).join(' ')
      const area = `M ${X0},${Y1} ${data.map((v, i) => `L ${tx(i)},${py(v)}`).join(' ')} L ${X1},${Y1} Z`
      const dots = data.map((v, i) => `<circle cx="${tx(i)}" cy="${py(v)}" r="3.4" fill="var(--card,#1a1630)" stroke="var(--vio)" stroke-width="2.4" vector-effect="non-scaling-stroke"/>`).join('')
      const labels = TM_MONTHS.map((m, i) => (i % 2 === 0 || i === n - 1) ? `<text x="${tx(i)}" y="220" fill="var(--tx3,#736c92)" font-size="11" font-family="JetBrains Mono,monospace" text-anchor="middle">${m}</text>` : '').join('')
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
          '<div data-tm="tag" style="position:absolute;transform:translate(-50%,-145%);background:var(--bd,#f6f4ff);color:var(--bg,#0b0a12);font-family:JetBrains Mono,monospace;font-weight:700;font-size:13px;padding:4px 9px;border-radius:9px;white-space:nowrap">$0</div>'
        const li = data.indexOf(min)
        const lb = q('[data-tm="lowb"]'); if (lb) { lb.style.left = `${(tx(li) / 700) * 100}%`; lb.style.top = `${(py(min) / 240) * 100}%` }
      }
    }

    // ---------------- SCRUB TRACKS (tournaments / news) ----------------
    const now = Date.now()
    const tItems = (tourns.length ? tourns : fallbackTourns(now)).slice().sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    const nItems = (news.length ? news : fallbackNews(now)).slice().sort((a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt))
    const tRatios = tItems.map((t) => Math.max(0.03, Math.min(0.97, (+new Date(t.startsAt) - now) / (10 * 86400000))))
    const nRatios = nItems.map((t) => Math.max(0.03, Math.min(0.97, 1 - (now - +new Date(t.publishedAt)) / (5 * 86400000))))

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
      const frac = Math.max(0.06, Math.min(1, 1 - ms / (10 * 86400000)))
      const ring = q('[data-tm="tring"]'); if (ring) { const C = 264; ring.style.strokeDashoffset = String(C * (1 - (t.live ? 1 : frac))); ring.style.stroke = t.live ? 'var(--pink)' : 'var(--cyan)' }
      const days = q('[data-tm="tdays"]'); if (days) days.textContent = t.live || ms <= 0 ? 'LIVE' : `${Math.max(1, Math.ceil(ms / 86400000))}d`
      const g = q('[data-tm="tgame"]'); if (g) g.textContent = t.game
      const ti = q('[data-tm="ttitle"]'); if (ti) ti.textContent = t.title
      const wh = q('[data-tm="twhen"]'); if (wh) wh.textContent = t.live ? 'On air now' : `starts ${t.rel}`
      const st = q('[data-tm="tstatus"]'); if (st) { st.textContent = t.statusLabel; st.style.background = t.live ? 'var(--pink)' : 'rgba(0,0,0,.55)' }
    }

    const fillNews = (n: NewsVM | undefined, idx: number, total: number) => {
      if (!n) return
      const src = q('[data-tm="nsource"]'); if (src) { src.textContent = (n.source || '').toUpperCase(); src.style.background = n.srcColor }
      const hd = q('[data-tm="nheadline"]'); if (hd) hd.textContent = n.title
      const tm = q('[data-tm="ntime"]'); if (tm) tm.textContent = n.time
      const ix = q('[data-tm="nidx"]'); if (ix) ix.textContent = `Story ${idx + 1} of ${total}`
    }

    const trackScrub = (kind: 't' | 'n', ratio: number, release: boolean) => {
      const items = kind === 't' ? tItems : nItems
      const ratios = kind === 't' ? tRatios : nRatios
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
      drawChart(game)
      scrub(tmT.current == null ? (chart.current ? chart.current.n - 1 : 0) : tmT.current, true)
      dragX(q('[data-tm="chartwrap"]'), (ratio, release) => {
        const c = chart.current; if (!c) return
        const sx = ratio * 700
        const t = ((sx - c.X0) / (c.X1 - c.X0)) * (c.n - 1)
        scrub(t, release)
      })
    } else if (tab === 'tournaments') {
      paintTrack('t')
      fillTourn(tItems[tSel.current])
      dragX(q('[data-tm="ttrack"]'), (ratio, release) => trackScrub('t', ratio, release))
    } else if (tab === 'news') {
      nSel.current = nItems.length - 1
      paintTrack('n')
      fillNews(nItems[nSel.current], nSel.current, nItems.length)
      dragX(q('[data-tm="ntrack"]'), (ratio, release) => trackScrub('n', ratio, release))
    }

    return () => cleanups.forEach((c) => c())
  }, [tab, game, tourns, news])

  const tabBtn = (key: Tab, label: string) => {
    const on = tab === key
    return (
      <button key={key} onClick={() => setTab(key)} style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '9px 15px', background: on ? 'var(--lime)' : 'transparent', color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{label}</button>
    )
  }

  const gameChip = (g: string) => {
    const on = game === g
    return (
      <button key={g} onClick={() => { tmT.current = null; setGame(g) }} style={{ font: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: 'pointer', borderRadius: 100, padding: '7px 13px', border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, background: on ? 'var(--lime)' : 'transparent', color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{g === 'Red Dead Redemption 2' ? 'Red Dead 2' : g}</button>
    )
  }

  return (
    <section id="timemachine" style={{ maxWidth: 1200, margin: '0 auto', padding: '104px 26px 0' }}>
      <div ref={rootRef} style={{ position: 'relative' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 22 }}>
          <div style={{ maxWidth: 560 }}>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(28px,4.4vw,50px)', fontWeight: 800, letterSpacing: '-.03em', margin: '7px 0 0', lineHeight: 0.98 }}>Rewind the<br />timeline.</h2>
            <p style={{ fontSize: 15.5, color: 'var(--tx2,#aaa3c6)', margin: '14px 0 0', lineHeight: 1.5 }}>Drag the playhead to watch prices crash, tournaments count down, and headlines rewind. Grab the handle — it's springy.</p>
          </div>
          <div style={{ display: 'inline-flex', gap: 5, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 14, padding: 5, boxShadow: '4px 4px 0 var(--hard)' }}>
            {tabBtn('deals', 'Price')}
            {tabBtn('tournaments', 'Tourneys')}
            {tabBtn('news', 'News')}
          </div>
        </div>

        <div style={{ background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 24, boxShadow: '9px 9px 0 var(--hard)', overflow: 'hidden' }}>
          {tab === 'deals' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', alignSelf: 'center', marginRight: 2 }}>GAME</span>
                {TM_GAMES.map(gameChip)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26 }}>
                <div style={{ flex: '0 0 200px', minWidth: 180 }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Price on <span data-tm="date" style={{ color: 'var(--tx,#f6f4ff)', fontWeight: 700 }}>Jun 2026</span></div>
                  <div data-tm="price" style={{ fontFamily: 'var(--fd)', fontSize: 54, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1, marginTop: 6, color: 'var(--lime)' }}>$8.99</div>
                  <div data-tm="delta" style={{ display: 'inline-block', fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, marginTop: 12, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '4px 10px' }}>−85% vs launch</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--tx2,#aaa3c6)' }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: 'var(--cyan)', border: '1.5px solid var(--bd,#f6f4ff)' }} />Lowest ever <b data-tm="low" style={{ color: 'var(--tx,#f6f4ff)' }}>$8.99</b>
                  </div>
                </div>
                <div data-tm="chartwrap" style={{ position: 'relative', flex: '1 1 360px', minWidth: 280, touchAction: 'none', cursor: 'ew-resize', alignSelf: 'stretch' }}>
                  <svg data-tm="svg" viewBox="0 0 700 240" preserveAspectRatio="none" style={{ width: '100%', height: 236, display: 'block', overflow: 'visible' }} />
                  <div data-tm="overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
          )}

          {tab === 'tournaments' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 26, alignItems: 'center' }}>
                <div style={{ flex: '1 1 320px', minWidth: 280, background: 'var(--card2,#221c3c)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 18, padding: 20, boxShadow: '5px 5px 0 var(--hard)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line2,#3a3460)" strokeWidth="9" />
                        <circle data-tm="tring" cx="50" cy="50" r="42" fill="none" stroke="var(--cyan)" strokeWidth="9" strokeLinecap="round" strokeDasharray="264" strokeDashoffset="120" style={{ transition: 'stroke-dashoffset .5s var(--ease),stroke .3s' }} />
                      </svg>
                      <div data-tm="tdays" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 15 }}>2d</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div data-tm="tstatus" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 10, letterSpacing: '.08em', color: '#fff', background: 'rgba(0,0,0,.55)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '3px 8px', marginBottom: 9 }}>UPCOMING</div>
                      <div data-tm="tgame" style={{ fontFamily: 'var(--fd)', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>Valorant</div>
                      <div data-tm="ttitle" style={{ fontSize: 13.5, color: 'var(--tx2,#aaa3c6)', marginTop: 4, lineHeight: 1.3 }}>Valorant Champions 2026</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--tx2,#aaa3c6)', borderTop: '2px solid var(--line)', paddingTop: 14 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--amber)' }} /><span data-tm="twhen" style={{ fontWeight: 700, color: 'var(--tx,#f6f4ff)' }}>starts in 2d 6h</span>
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', minWidth: 260 }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>Scrub the next 10 days →</div>
                  <div data-tm="ttrack" style={{ position: 'relative', height: 64, cursor: 'ew-resize', touchAction: 'none' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', marginTop: 6 }}><span>Now</span><span>+10 days</span></div>
                </div>
              </div>
            </div>
          )}

          {tab === 'news' && (
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap-reverse', gap: 26, alignItems: 'center' }}>
                <div style={{ flex: '1 1 320px', minWidth: 280, background: 'var(--card2,#221c3c)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 18, padding: 20, boxShadow: '5px 5px 0 var(--hard)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
                    <span data-tm="nsource" style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em', color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '4px 10px' }}>STEAM</span>
                    <span data-tm="ntime" style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx3,#736c92)' }}>now</span>
                  </div>
                  <div data-tm="nheadline" style={{ fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.18 }}>Steam Summer Sale goes live with record discounts</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx3,#736c92)', borderTop: '2px solid var(--line)', paddingTop: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pink)', animation: 'pw-blink 1.3s ease-in-out infinite' }} /><span data-tm="nidx">Story 1 of 8</span>
                  </div>
                </div>
                <div style={{ flex: '1 1 300px', minWidth: 260 }}>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 14 }}>⟲ Rewind the feed →</div>
                  <div data-tm="ntrack" style={{ position: 'relative', height: 64, cursor: 'ew-resize', touchAction: 'none' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', marginTop: 6 }}><span>5 days ago</span><span>Now</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
