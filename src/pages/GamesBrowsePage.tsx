import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { api } from '../lib/api'
import { useShell } from '../context/ShellContext'
import {
  CHART_WINDOWS,
  PLATFORMS,
  buildGenres,
  chartRank,
  fallbackGames,
  genreColor,
  mapX,
  mapY,
  matchesPlatform,
  movement,
  normalize,
  seededShuffle,
  type ChartWindow,
  type Game,
  type LibGame,
  type Sort,
} from '../lib/gamesData'

const PER_PAGE = 12

function AutoRail({ vel, children }: { vel: number; children: ReactNode }) {
  const { velFactor } = useShell()
  const velRef = useRef(velFactor)
  velRef.current = velFactor
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let paused = false
    let idle: number | undefined
    let pos = el.scrollLeft
    let raf = 0
    const pause = () => { paused = true; window.clearTimeout(idle); idle = window.setTimeout(() => { paused = false }, 2400) }
    const onEnter = () => { paused = true }
    const onLeave = () => { paused = false }
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('pointerdown', pause)
    el.addEventListener('wheel', pause, { passive: true })
    const step = () => {
      if (!paused && el.scrollWidth > el.clientWidth + 4) {
        pos += vel * velRef.current
        if (pos >= el.scrollWidth - el.clientWidth) pos = 0
        el.scrollLeft = pos
      } else { pos = el.scrollLeft }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(idle); el.removeEventListener('mouseenter', onEnter); el.removeEventListener('mouseleave', onLeave); el.removeEventListener('pointerdown', pause); el.removeEventListener('wheel', pause) }
  }, [vel])
  return <div ref={ref} className="rail" style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '16px 2px 6px' }}>{children}</div>
}

const card = { background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)' } as const
const SORTS: Array<[Sort, string]> = [['rated', 'Top Rated'], ['popular', 'Popular'], ['az', 'A–Z'], ['new', 'New']]
const PLAT_CHIPS = ['All', ...PLATFORMS]

function coverStyle(g: Game): CSSProperties {
  return g.image
    ? { backgroundImage: `linear-gradient(180deg,rgba(11,10,18,.05),rgba(11,10,18,.5)), url("${g.image}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: g.cover }
}

function Ring({ score, color, size = 40 }: { score: number; color: string; size?: number }) {
  const r = size / 2 - 2.5
  const C = 2 * Math.PI * r
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="var(--card2,#221c3c)" stroke="var(--line2,#3a3460)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - score / 10)} />
      </svg>
      <span style={{ position: 'absolute', fontFamily: 'var(--fm)', fontWeight: 700, fontSize: size * 0.3, color: 'var(--tx,#f6f4ff)' }}>{score.toFixed(1)}</span>
    </span>
  )
}

function Move({ slug }: { slug: string }) {
  const m = movement(slug)
  if (m.dir === 'new') return <span style={{ fontFamily: 'var(--fm)', fontSize: 9.5, fontWeight: 700, color: '#0b0a12', background: 'var(--cyan)', border: '1.5px solid var(--bd,#f6f4ff)', borderRadius: 6, padding: '1px 6px' }}>NEW</span>
  if (m.dir === 'same') return <span style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx3,#736c92)' }}>–</span>
  const up = m.dir === 'up'
  return <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: up ? 'var(--lime)' : 'var(--pink)' }}>{up ? '▲' : '▼'}{m.n}</span>
}

const chipMeta: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 9.5, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'var(--bg,#0b0a12)', border: '1.5px solid var(--line2,#3a3460)', borderRadius: 6, padding: '2px 6px' }
const pagerBtn = (disabled: boolean): CSSProperties => ({ fontFamily: 'var(--ff)', fontSize: 13, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '8px 14px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, boxShadow: '2px 2px 0 var(--hard)' })

function StackCard({ g, accent, onClick }: { g: Game; accent: string; onClick: () => void }) {
  return (
    <div style={{ flex: '0 0 196px' }}>
      <div className="gcard" onClick={onClick} style={{ height: '100%', ...card, borderRadius: 16, overflow: 'hidden', boxShadow: '4px 5px 0 var(--hard)' }}>
        <div style={{ position: 'relative', height: 150, overflow: 'hidden', borderBottom: '2.5px solid var(--bd,#f6f4ff)', ...coverStyle(g) }}>
          {!g.image && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,.22) 1.4px,transparent 1.5px)', backgroundSize: '11px 11px' }} />}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, textAlign: 'center' }}>
            <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 17, lineHeight: 1, color: 'rgba(255,255,255,.96)', letterSpacing: '-.01em', textShadow: '2px 2px 0 rgba(0,0,0,.4)' }}>{g.title}</span>
          </div>
          <span style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 11, color: '#0b0a12', background: accent, border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '2px 7px', boxShadow: '2px 2px 0 rgba(0,0,0,.35)' }}>{g.score.toFixed(1)}</span>
          {g.year ? <span style={{ position: 'absolute', bottom: 8, left: 8, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 10, color: '#fff', background: 'rgba(0,0,0,.5)', border: '1.5px solid rgba(255,255,255,.5)', borderRadius: 6, padding: '2px 7px' }}>{g.year}</span> : null}
        </div>
        <div style={{ padding: '11px 12px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx2,#aaa3c6)', marginTop: 4 }}>{g.genres.slice(0, 2).join(' · ')}</div>
          <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>{g.platforms.slice(0, 3).map((p) => <span key={p} style={chipMeta}>{p}</span>)}</div>
        </div>
      </div>
    </div>
  )
}

export default function GamesBrowsePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [all, setAll] = useState<Game[]>(() => fallbackGames())
  const [sort, setSort] = useState<Sort>('rated')
  const [query, setQuery] = useState(params.get('q') || '')
  const [plat, setPlat] = useState('All')
  const [chartWin, setChartWin] = useState<ChartWindow>('all')
  const [hover, setHover] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pageByGenre, setPageByGenre] = useState<Record<string, number>>({})
  const open = useRef<HTMLDivElement>(null)
  // fresh sample on every visit (stable within the visit)
  const [mapSeed] = useState(() => Math.floor(Math.random() * 1e6) + 1)

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const res = await api.fetchLibrary({ limit: 150 })
        if (!ignore && res.games?.length) setAll(normalize(res.games as LibGame[]))
      } catch {
        /* keep fallback */
      }
    })()
    return () => { ignore = true }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((g) => (!q || g.title.toLowerCase().includes(q)) && (plat === 'All' || matchesPlatform(g, plat)))
  }, [all, query, plat])

  const chart = useMemo(() => chartRank(filtered, chartWin).slice(0, 10), [filtered, chartWin])
  const spotlight = chart[0]
  const genres = useMemo(() => buildGenres(filtered, sort), [filtered, sort])
  const mapNodes = useMemo(() => seededShuffle(filtered, mapSeed).slice(0, 60), [filtered, mapSeed])
  const hoveredGame = hover ? filtered.find((g) => g.slug === hover) : null
  const isHot = (g: Game) => (sort === 'rated' ? g.score >= 8.5 : sort === 'popular' ? g.pop >= 80 : true)

  const go = (slug: string) => navigate(`/games/${slug}`)
  const toggleGenre = (key: string) => setExpanded((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else { n.add(key); setPageByGenre((p) => ({ ...p, [key]: 1 })) } return n })
  const setPage = (key: string, p: number) => setPageByGenre((prev) => ({ ...prev, [key]: p }))

  return (
    <div ref={open} style={{ maxWidth: 1340, margin: '0 auto', padding: '40px 26px 0' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--vio)' }}><span style={{ width: 18, height: 2, background: 'var(--vio)' }} />ALL GAMES · {filtered.length} TITLES</div>
      <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(34px,5vw,64px)', lineHeight: 0.95, fontWeight: 800, letterSpacing: '-.04em', margin: '12px 0 0' }}>Don't just scroll.<br /><span style={{ display: 'inline-block', background: 'var(--lime)', color: '#0b0a12', padding: '0 .12em', marginTop: '.08em', border: '3px solid var(--bd)', boxShadow: '6px 6px 0 var(--hard)', transform: 'rotate(-1.4deg)' }}>explore.</span></h1>
      <p style={{ fontSize: 'clamp(15px,1.6vw,18px)', color: 'var(--tx2,#aaa3c6)', maxWidth: '58ch', margin: '18px 0 0', lineHeight: 1.55 }}>The whole library, mapped by <b style={{ color: 'var(--tx)' }}>rating</b> &amp; <b style={{ color: 'var(--tx)' }}>popularity</b> — then charted and stacked. Hunt the <b style={{ color: 'var(--lime)' }}>hidden gems</b>, scan the chart, dive the tiers.</p>

      {/* ── CONSTELLATION MAP ── */}
      <div style={{ position: 'relative', height: 460, ...card, borderRadius: 20, boxShadow: '7px 7px 0 var(--hard)', overflow: 'hidden', padding: '14px 14px 30px 34px', marginTop: 26 }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--line2,#3a3460) 1px,transparent 1.2px)', backgroundSize: '26px 26px', opacity: 0.4 }} />
        <div style={{ position: 'absolute', left: '52%', top: 12, bottom: 30, width: 0, borderLeft: '2px dashed var(--line2,#3a3460)' }} />
        <div style={{ position: 'absolute', left: 34, right: 14, top: '46%', height: 0, borderTop: '2px dashed var(--line2,#3a3460)' }} />
        <div aria-hidden style={{ position: 'absolute', left: 34, top: 12, width: '46%', height: '40%', background: 'rgba(202,255,63,.06)', borderRadius: 12 }} />
        {([['★ HIDDEN GEMS', 'var(--lime)', '#0b0a12', { left: 42, top: 16 }, '-2deg'], ['BLOCKBUSTERS', 'var(--cyan)', '#0b0a12', { right: 16, top: 16 }, '2deg'], ['NICHE / DEEP CUTS', 'var(--vio)', '#fff', { left: 42, bottom: 34 }, '2deg'], ['OVERHYPED', 'var(--amber)', '#0b0a12', { right: 16, bottom: 34 }, '-2deg']] as const).map(([t, bg, fg, pos, rot]) => (
          <div key={t} style={{ position: 'absolute', ...(pos as CSSProperties), fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 11, letterSpacing: '.06em', padding: '4px 9px', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, background: bg, color: fg, transform: `rotate(${rot})`, zIndex: 2 }}>{t}</div>
        ))}
        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'rotate(-90deg) translateX(50%)', transformOrigin: 'left center', fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--tx3,#736c92)', whiteSpace: 'nowrap' }}>← RATING →</div>
        <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--tx3,#736c92)', whiteSpace: 'nowrap' }}>← NICHE · POPULARITY · MAINSTREAM →</div>

        <div style={{ position: 'absolute', left: 34, right: 14, top: 12, bottom: 30 }}>
          {mapNodes.map((g) => {
            const hot = isHot(g)
            const isH = hover === g.slug
            const size = 14 + (g.pop / 100) * 12
            return <button key={g.slug} onMouseEnter={() => setHover(g.slug)} onMouseLeave={() => setHover((h) => (h === g.slug ? null : h))} onClick={() => go(g.slug)} aria-label={g.title} style={{ position: 'absolute', left: `${mapX(g.pop)}%`, top: `${mapY(g.score)}%`, transform: `translate(-50%,-50%) ${isH ? 'scale(1.5)' : 'scale(1)'}`, width: size, height: size, borderRadius: 5, background: genreColor(g.genre), border: '2px solid var(--bd,#f6f4ff)', boxShadow: isH ? '0 0 0 4px rgba(255,255,255,.12)' : '1.5px 1.5px 0 rgba(0,0,0,.4)', cursor: 'pointer', padding: 0, opacity: hot ? 1 : 0.32, transition: 'transform .15s var(--ease), opacity .2s', zIndex: isH ? 6 : hot ? 3 : 1 }} />
          })}
          {hoveredGame && (
            <div style={{ position: 'absolute', left: `${Math.max(16, Math.min(82, mapX(hoveredGame.pop)))}%`, top: `${mapY(hoveredGame.score)}%`, transform: 'translate(-50%,calc(-100% - 14px))', zIndex: 8, width: 210, pointerEvents: 'none', ...card, borderRadius: 14, boxShadow: '5px 5px 0 var(--hard)', padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Ring score={hoveredGame.score} color={genreColor(hoveredGame.genre)} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, letterSpacing: '-.01em', lineHeight: 1.15 }}>{hoveredGame.title}</div>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--tx2,#aaa3c6)', marginTop: 3 }}>{hoveredGame.genres[0]}{hoveredGame.year ? ` · ${hoveredGame.year}` : ''}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── STICKY TOOLBAR ── */}
      <div style={{ position: 'sticky', top: 70, zIndex: 150, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', margin: '18px -8px 0', padding: '10px 8px', background: 'var(--bg,#0b0a12)' }}>
        <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 12, ...card, borderRadius: 14, padding: '9px 16px', boxShadow: '5px 5px 0 var(--hard)' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 15 }} />
        </div>
        <div style={{ display: 'inline-flex', gap: 5, ...card, borderRadius: 13, padding: 5, boxShadow: '4px 4px 0 var(--hard)' }}>
          {SORTS.map(([k, lbl]) => {
            const on = sort === k
            return <button key={k} onClick={() => setSort(k)} style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'transparent'}`, cursor: 'pointer', borderRadius: 9, padding: '8px 13px', background: on ? 'var(--lime)' : 'transparent', color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{lbl}</button>
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase' }}>Platform</span>
        {PLAT_CHIPS.map((p) => {
          const on = plat === p
          return <button key={p} className="chip" onClick={() => setPlat(p)} style={{ font: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600, cursor: 'pointer', borderRadius: 100, padding: '6px 13px', border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, background: on ? 'var(--lime)' : 'transparent', color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{p}</button>
        })}
      </div>

      {/* ── THE CHART ── */}
      {spotlight && (
        <div style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'var(--pink)' }}>THE CHART</div>
              <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(24px,3.4vw,40px)', fontWeight: 800, letterSpacing: '-.03em', margin: '6px 0 0' }}>Most played</h2>
            </div>
            <div style={{ display: 'inline-flex', gap: 5, ...card, borderRadius: 13, padding: 5, boxShadow: '4px 4px 0 var(--hard)' }}>
              {CHART_WINDOWS.map(([k, lbl]) => {
                const on = chartWin === k
                return <button key={k} onClick={() => setChartWin(k)} style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'transparent'}`, cursor: 'pointer', borderRadius: 9, padding: '8px 13px', background: on ? 'var(--pink)' : 'transparent', color: on ? '#fff' : 'var(--tx2,#aaa3c6)' }}>{lbl}</button>
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
            {/* spotlight #1 */}
            <div style={{ flex: '1 1 360px', minWidth: 300, display: 'flex', gap: 18, ...card, borderRadius: 20, boxShadow: '9px 9px 0 var(--lime)', padding: 18 }}>
              <div onClick={() => go(spotlight.slug)} style={{ flex: '0 0 150px', minWidth: 130, position: 'relative', borderRadius: 14, border: '3px solid var(--bd,#f6f4ff)', boxShadow: '5px 5px 0 var(--hard)', overflow: 'hidden', cursor: 'pointer', transform: 'rotate(-1.5deg)', ...coverStyle(spotlight) }}>
                {!spotlight.image && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 12 }}><span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 20, color: 'rgba(255,255,255,.96)', textAlign: 'center', lineHeight: 0.95, textShadow: '2px 2px 0 rgba(0,0,0,.35)' }}>{spotlight.title}</span></div>}
                <span style={{ position: 'absolute', top: 8, left: 8, fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 9, padding: '2px 9px', boxShadow: '2px 2px 0 rgba(0,0,0,.35)' }}>#1</span>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start', fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 100, padding: '4px 11px', transform: 'rotate(-1deg)' }}>★ MOST PLAYED · {(CHART_WINDOWS.find(([k]) => k === chartWin)?.[1] || 'All-time').toUpperCase()}</div>
                <h3 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, letterSpacing: '-.02em', margin: '10px 0 0', lineHeight: 1 }}>{spotlight.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                  <Ring score={spotlight.score} color="var(--lime)" />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {spotlight.genres.slice(0, 3).map((x) => <span key={x} style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--tx2,#aaa3c6)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 8, padding: '4px 9px' }}>{x}</span>)}
                  </div>
                </div>
                <button className="press" onClick={() => go(spotlight.slug)} style={{ alignSelf: 'flex-start', marginTop: 16, fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: '#0b0a12', background: 'var(--cyan)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '10px 16px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)' }}>View game →</button>
              </div>
            </div>
            {/* ranked 2–10 */}
            <div style={{ flex: '1 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {chart.slice(1).map((g, i) => {
                const isH = hover === g.slug
                return (
                  <div key={g.slug} onMouseEnter={() => setHover(g.slug)} onMouseLeave={() => setHover((h) => (h === g.slug ? null : h))} onClick={() => go(g.slug)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 12, cursor: 'pointer', background: isH ? 'var(--card2,#221c3c)' : 'var(--card,#1a1630)', border: `2px solid ${isH ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, transition: 'background .15s,border-color .15s' }}>
                    <span style={{ fontFamily: 'var(--fd)', fontSize: 19, fontWeight: 800, color: 'var(--tx3,#736c92)', minWidth: 26, textAlign: 'center' }}>{i + 2}</span>
                    <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 9, border: '2px solid var(--bd,#f6f4ff)', ...coverStyle(g) }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</div>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--tx3,#736c92)', marginTop: 2 }}>{g.genres[0]}{g.year ? ` · ${g.year}` : ''}</div>
                    </div>
                    <Move slug={g.slug} />
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, color: g.score >= 9 ? 'var(--lime)' : g.score >= 8 ? 'var(--cyan)' : 'var(--tx2,#aaa3c6)' }}>{g.score.toFixed(1)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── THE STACKS (by genre) ── */}
      <div style={{ marginTop: 40 }}>
        <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'var(--cyan)' }}>THE STACKS</div>
        <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(24px,3.4vw,40px)', fontWeight: 800, letterSpacing: '-.03em', margin: '6px 0 4px' }}>Browse by genre</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 16 }}>
          {genres.map((sec) => {
            const isExp = expanded.has(sec.genre)
            const pages = Math.max(1, Math.ceil(sec.games.length / PER_PAGE))
            const page = Math.min(pageByGenre[sec.genre] || 1, pages)
            const pageGames = sec.games.slice((page - 1) * PER_PAGE, page * PER_PAGE)
            return (
              <section key={sec.genre}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '2px solid var(--line)', paddingBottom: 13 }}>
                  <span style={{ width: 50, height: 50, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 14, background: sec.accent, border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--hard)', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 14, color: '#0b0a12', transform: 'rotate(-3deg)' }}>{sec.stamp}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(19px,2.4vw,26px)', fontWeight: 800, letterSpacing: '-.02em', margin: 0, lineHeight: 1 }}>{sec.genre}</h3>
                    <div style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx2,#aaa3c6)', marginTop: 4 }}>{sec.games.length} game{sec.games.length === 1 ? '' : 's'}{isExp && pages > 1 ? ` · page ${page} of ${pages}` : ''}</div>
                  </div>
                  <button className="press" onClick={() => toggleGenre(sec.genre)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fd)', fontSize: 12.5, fontWeight: 700, color: isExp ? '#0b0a12' : 'var(--tx,#f6f4ff)', background: isExp ? 'var(--lime)' : 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)' }}>
                    {isExp ? 'Collapse' : `Browse all ${sec.games.length}`}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform .25s', transform: isExp ? 'rotate(180deg)' : 'none' }}><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                </div>

                {isExp ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 16, margin: '18px 0 0' }}>
                      {pageGames.map((g) => <StackCard key={g.slug} g={g} accent={sec.accent} onClick={() => go(g.slug)} />)}
                    </div>
                    {pages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
                        <button className="press" onClick={() => setPage(sec.genre, Math.max(1, page - 1))} disabled={page <= 1} style={pagerBtn(page <= 1)}>← Prev</button>
                        {pages <= 8 && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {Array.from({ length: pages }).map((_, i) => {
                              const on = page === i + 1
                              return <button key={i} onClick={() => setPage(sec.genre, i + 1)} aria-label={`Page ${i + 1}`} style={{ width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--fm)', fontSize: 12.5, fontWeight: 700, border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, background: on ? 'var(--lime)' : 'var(--card,#1a1630)', color: on ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>{i + 1}</button>
                            })}
                          </div>
                        )}
                        <button className="press" onClick={() => setPage(sec.genre, Math.min(pages, page + 1))} disabled={page >= pages} style={pagerBtn(page >= pages)}>Next →</button>
                      </div>
                    )}
                  </>
                ) : (
                  <AutoRail vel={0.4}>
                    {sec.games.slice(0, 16).map((g) => <StackCard key={g.slug} g={g} accent={sec.accent} onClick={() => go(g.slug)} />)}
                  </AutoRail>
                )}
              </section>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 22px', ...card, border: '2.5px dashed var(--line2,#3a3460)', borderRadius: 18 }}>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em' }}>No games match</div>
              <div style={{ fontSize: 14, color: 'var(--tx2,#aaa3c6)', marginTop: 9 }}>Try a different search or platform.</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, margin: '34px 0 0', background: 'var(--panel,#120f1f)', border: '2px solid var(--line)', borderRadius: 14, padding: '14px 18px', color: 'var(--tx2,#aaa3c6)', fontSize: 13, lineHeight: 1.5 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
        Game data powered by IGDB &amp; NVIDIA GeForce NOW. Cover art belongs to their respective publishers.
      </div>
    </div>
  )
}
