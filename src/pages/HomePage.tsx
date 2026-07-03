import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../lib/api'
import { useShell } from '../context/ShellContext'
import {
  buildCoverMap,
  fallbackDeals,
  fallbackNews,
  fallbackTourns,
  mapDeals,
  mapNews,
  mapTourns,
  type DealVM,
  type NewsVM,
  type TournVM,
} from '../lib/homeData'
import TimeMachine from '../components/home/TimeMachine'

// ---- animated count-up (fires once the intro is done) ----------------------
function StatCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const { ready } = useShell()
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!ready) return
    const dur = 1500
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * e))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, target])
  return <>{val.toLocaleString('en-US')}{suffix}</>
}

// ---- auto-scrolling rail ----------------------------------------------------
function Rail({ vel, children }: { vel: number; children: ReactNode }) {
  const { velFactor } = useShell()
  const velRef = useRef(velFactor)
  velRef.current = velFactor
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let paused = false
    let idle: number | undefined
    let pos = 0
    let raf = 0
    const pause = () => { paused = true; window.clearTimeout(idle); idle = window.setTimeout(() => { paused = false }, 2600) }
    const onEnter = () => { paused = true }
    const onLeave = () => { paused = false }
    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('pointerdown', pause)
    el.addEventListener('touchstart', pause, { passive: true })
    el.addEventListener('wheel', pause, { passive: true })
    const step = () => {
      if (!paused && el.scrollWidth > el.clientWidth + 4) {
        pos += vel * velRef.current
        const half = el.scrollWidth / 2
        if (pos >= half) pos -= half
        el.scrollLeft = pos
      } else {
        pos = el.scrollLeft
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(idle)
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('pointerdown', pause)
      el.removeEventListener('touchstart', pause)
      el.removeEventListener('wheel', pause)
    }
  }, [vel])
  return (
    <div ref={ref} className="rail" style={{ display: 'flex', gap: 18, overflowX: 'auto', padding: '6px 26px 18px' }}>
      {children}
    </div>
  )
}

function SectionHead({ kicker, kickerColor, title, action, onAction }: { kicker: string; kickerColor: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, padding: '0 26px', marginBottom: 20 }}>
      <div>
        <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: kickerColor }}>{kicker}</div>
        <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(28px,4.2vw,48px)', fontWeight: 800, letterSpacing: '-.03em', margin: '7px 0 0' }}>{title}</h2>
      </div>
      {action && (
        <button className="press" onClick={onAction} style={{ fontFamily: 'var(--ff)', fontSize: 13.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '10px 16px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>{action}</button>
      )}
    </div>
  )
}

function DealCard({ d, onClick }: { d: DealVM; onClick: () => void }) {
  return (
    <div style={{ flex: '0 0 230px' }}>
      <div onClick={onClick} className="gcard" style={{ height: '100%', background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 17, overflow: 'hidden', boxShadow: '4px 4px 0 var(--hard)' }}>
        <div style={{ position: 'relative', height: 148, background: d.cover, overflow: 'hidden', borderBottom: '2.5px solid var(--bd,#f6f4ff)' }}>
          {d.image ? (
            <img src={d.image} alt={d.title} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,.22) 1.4px,transparent 1.5px)', backgroundSize: '11px 11px' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, textAlign: 'center' }}>
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 19, lineHeight: 1, color: 'rgba(255,255,255,.96)', letterSpacing: '-.01em', textShadow: '2px 2px 0 rgba(0,0,0,.3)', maxHeight: '100%', overflow: 'hidden' }}>{d.title}</span>
              </div>
            </>
          )}
          <span style={{ position: 'absolute', top: 9, right: 9, fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 12.5, color: '#0b0a12', background: d.badgeColor, border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '3px 8px', boxShadow: '2px 2px 0 rgba(0,0,0,.35)', transform: 'rotate(4deg)' }}>{d.badge}</span>
        </div>
        <div style={{ padding: '12px 13px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'var(--tx2,#aaa3c6)', textTransform: 'uppercase' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.storeColor }} />{d.store}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 9 }}>
            <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 18, color: 'var(--lime)' }}>{d.priceText}</span>
            {d.origText && <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx3,#736c92)', textDecoration: 'line-through' }}>{d.origText}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function TournCard({ t, onClick }: { t: TournVM; onClick: () => void }) {
  return (
    <div style={{ flex: '0 0 248px' }}>
      <div onClick={onClick} className="gcard" style={{ height: '100%', background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 17, overflow: 'hidden', boxShadow: '4px 4px 0 var(--hard)' }}>
        <div style={{ position: 'relative', height: 128, background: t.cover, overflow: 'hidden', borderBottom: '2.5px solid var(--bd,#f6f4ff)' }}>
          {t.image ? (
            <>
              <img src={t.image} alt={t.game} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,5,12,.82), rgba(6,5,12,.08) 55%, transparent)' }} />
              <span style={{ position: 'absolute', bottom: 9, left: 10, right: 10, fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 15, lineHeight: 1, color: '#fff', letterSpacing: '-.01em', textShadow: '2px 2px 0 rgba(0,0,0,.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.game}</span>
            </>
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,.22) 1.4px,transparent 1.5px)', backgroundSize: '11px 11px' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, textAlign: 'center' }}>
                <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 20, lineHeight: 0.95, color: 'rgba(255,255,255,.96)', letterSpacing: '-.01em', textShadow: '2px 2px 0 rgba(0,0,0,.3)', overflow: 'hidden', maxHeight: '100%' }}>{t.game}</span>
              </div>
            </>
          )}
          <span style={{ position: 'absolute', top: 9, left: 9, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 10, letterSpacing: '.08em', color: '#fff', background: t.statusColor, border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '3px 8px' }}>
            {t.live && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pw-blink 1.1s ease-in-out infinite' }} />}{t.statusLabel}
          </span>
        </div>
        <div style={{ padding: '12px 13px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 35 }}>{t.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx2,#aaa3c6)' }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--amber)' }} /><span style={{ fontWeight: 700, color: 'var(--tx,#f6f4ff)' }}>{t.when}</span><span style={{ color: 'var(--tx3,#736c92)' }}>· {t.rel}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  { color: 'var(--lime)', ink: '#0b0a12', title: '7 stores, 1 screen', body: 'Steam, Epic, Xbox, GOG, EA, Ubisoft & GeForce NOW — unified.', icon: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  { color: 'var(--cyan)', ink: '#0b0a12', title: 'Price-drop radar', body: 'Track any game and get pinged the moment it hits your price.', icon: <><path d="M3 17l5-5 4 3 8-9" /><path d="M21 6v5h-5" /></> },
  { color: 'var(--amber)', ink: '#0b0a12', title: 'Never miss free', body: 'Every free game across stores, surfaced the day it drops.', icon: <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.2l1-5.8L3.5 9.2l5.9-.9z" /> },
  { color: 'var(--pink)', ink: '#fff', title: 'Live esports', body: 'Tournaments flagged LIVE the second the match goes on air.', icon: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M6 3h12v6a6 6 0 0 1-12 0z" /><path d="M9 21h6M12 15v6" /></> },
]

export default function HomePage() {
  const navigate = useNavigate()
  const heroSearchRef = useRef<HTMLInputElement>(null)
  const [deals, setDeals] = useState<DealVM[]>(() => fallbackDeals())
  const [tourns, setTourns] = useState<TournVM[]>(() => fallbackTourns())
  const [news, setNews] = useState<NewsVM[]>(() => fallbackNews())
  const [stats, setStats] = useState<{ games: number; stores: number; deals: number }>({ games: 5600, stores: 7, deals: 248 })

  useEffect(() => {
    let ignore = false
    void (async () => {
      const [d, t, n, s] = await Promise.allSettled([
        api.fetchDeals(),
        api.fetchTournaments({ limit: 12 }),
        api.fetchNews({ limit: 8 }),
        api.fetchStats(),
      ])
      if (ignore) return
      if (d.status === 'fulfilled' && d.value.length) setDeals(mapDeals(d.value.slice(0, 12)))
      if (t.status === 'fulfilled' && t.value.length) setTourns(mapTourns(t.value.slice(0, 8)))
      if (n.status === 'fulfilled' && n.value.length) setNews(mapNews(n.value.slice(0, 8)))
      if (s.status === 'fulfilled') setStats({ games: s.value.gameCount || 5600, stores: s.value.storeCount || 7, deals: s.value.dealCount || 248 })

      // second pass: resolve real cover art for the tournaments' games
      if (t.status === 'fulfilled' && t.value.length) {
        const shown = t.value.slice(0, 8)
        const slugs = [...new Set(shown.map((x) => x.gameSlug).filter((x): x is string => Boolean(x)))]
        const details = await Promise.allSettled(slugs.map((sl) => api.fetchGameDetails(sl)))
        if (ignore) return
        const covers = buildCoverMap(details.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])))
        if (Object.keys(covers).length) setTourns(mapTourns(shown, Date.now(), covers))
      }
    })()
    return () => { ignore = true }
  }, [])

  const search = (q: string) => navigate({ pathname: '/games', search: q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '' })
  const openDeal = (d: DealVM) => { if (d.url) window.open(d.url, '_blank', 'noopener,noreferrer'); else navigate('/games') }
  const openNews = (n: NewsVM) => { if (n.url) window.open(n.url, '_blank', 'noopener,noreferrer'); else navigate('/news') }

  const dod = deals[0]
  const dealsLoop = [...deals, ...deals]
  const tournLoop = [...tourns, ...tourns]
  const newsLead = news[0]
  const newsRest = news.slice(1, 6).map((n, i) => ({ ...n, rank: `0${i + 2}` }))

  return (
    <>
      {/* HERO */}
      <section id="top" style={{ maxWidth: 1280, margin: '0 auto', padding: '62px 26px 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 46 }}>
        <div style={{ flex: '1 1 460px', minWidth: 330 }}>
          <div className="rise" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 100, padding: '7px 14px', boxShadow: '3px 3px 0 var(--cyan)', transform: 'rotate(-1.5deg)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lime)' }} />7 STORES · ONE SCREEN
          </div>
          <h1 className="rise" style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(46px,7vw,92px)', lineHeight: 0.92, fontWeight: 800, letterSpacing: '-.04em', margin: '22px 0 0', transitionDelay: '.05s' }}>
            STOP<br />
            <span style={{ display: 'inline-block', background: 'var(--lime)', color: '#0b0a12', padding: '0 .1em', marginTop: '.08em', border: '3px solid var(--bd)', boxShadow: '6px 6px 0 var(--hard)', transform: 'rotate(-1.5deg)' }}>SITE-HOPPING.</span>
          </h1>
          <p className="rise" style={{ fontSize: 'clamp(16px,1.8vw,19px)', color: 'var(--tx2,#aaa3c6)', maxWidth: '46ch', margin: '30px 0 0', lineHeight: 1.55, transitionDelay: '.1s' }}>
            Every deal, free game, tournament and news drop — from Steam, Epic, Xbox &amp; 4 more stores, tracked live on one screen.
          </p>
          <div className="rise" style={{ marginTop: 30, maxWidth: 540, transitionDelay: '.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 15, padding: '7px 7px 7px 16px', boxShadow: '6px 6px 0 var(--hard)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
              <input ref={heroSearchRef} onKeyDown={(e) => { if (e.key === 'Enter') search((e.target as HTMLInputElement).value) }} placeholder="Search 5,600+ games…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 16 }} />
              <button className="press" onClick={() => search(heroSearchRef.current?.value || '')} style={{ fontFamily: 'var(--fd)', fontSize: 14, fontWeight: 700, color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '11px 20px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>GO</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 15, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', letterSpacing: '.08em' }}>TRENDING</span>
              {['Cyberpunk 2077', "Baldur's Gate 3", 'Free games'].map((c) => (
                <button key={c} className="chip" onClick={() => search(c)} style={{ font: 'inherit', fontSize: 12.5, fontWeight: 600, color: 'var(--tx2,#aaa3c6)', background: 'var(--card,#1a1630)', border: '2px solid var(--line2,#3a3460)', borderRadius: 100, padding: '6px 13px', cursor: 'pointer', transition: 'transform .15s,border-color .15s,color .15s' }}>{c}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Deal of the day */}
        {dod && (
          <div className="rise" style={{ flex: '0 1 340px', minWidth: 280, display: 'flex', justifyContent: 'center', transitionDelay: '.2s' }}>
            <div style={{ position: 'relative', width: 300 }}>
              <div style={{ position: 'absolute', top: -22, left: -20, zIndex: 3, fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 26, color: '#0b0a12', background: 'var(--lime)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 13, padding: '8px 13px', boxShadow: '4px 4px 0 var(--hard)', transform: 'rotate(-9deg)' }}>{dod.badge}</div>
              <div style={{ position: 'absolute', top: -16, right: -14, zIndex: 3, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 11, letterSpacing: '.08em', color: '#fff', background: 'var(--pink)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '6px 10px', transform: 'rotate(6deg)' }}>DEAL OF THE DAY</div>
              <div className="dealcard" onClick={() => openDeal(dod)} style={{ cursor: 'pointer', background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 20, boxShadow: '11px 11px 0 var(--vio)', overflow: 'hidden', transform: 'rotate(2.5deg)', transition: 'transform .35s cubic-bezier(.16,1,.3,1)' }}>
                <div style={{ position: 'relative', height: 188, background: dod.cover, overflow: 'hidden', borderBottom: '3px solid var(--bd,#f6f4ff)' }}>
                  {dod.image ? (
                    <img src={dod.image} alt={dod.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <>
                      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,.22) 1.5px,transparent 1.6px)', backgroundSize: '13px 13px' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 18 }}>
                        <span style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 30, color: 'rgba(255,255,255,.95)', textAlign: 'center', lineHeight: 0.95, letterSpacing: '-.02em', transform: 'rotate(-4deg)', textShadow: '3px 3px 0 rgba(0,0,0,.25)' }}>{dod.title}</span>
                      </div>
                    </>
                  )}
                  <span style={{ position: 'absolute', bottom: 11, left: 11, fontFamily: 'var(--fm)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', color: '#fff', background: 'rgba(0,0,0,.45)', border: '1.5px solid rgba(255,255,255,.6)', borderRadius: 6, padding: '4px 8px' }}>{dod.store.toUpperCase()}</span>
                </div>
                <div style={{ padding: '16px 17px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 16.5, letterSpacing: '-.01em' }}>{dod.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--tx3,#736c92)', marginTop: 3 }}>Best price across {stats.stores} stores</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                      <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 23, color: 'var(--lime)' }}>{dod.priceText}</span>
                      {dod.origText && <span style={{ fontFamily: 'var(--fm)', fontSize: 13, color: 'var(--tx3,#736c92)', textDecoration: 'line-through' }}>{dod.origText}</span>}
                    </div>
                    <button className="press" onClick={(e) => { e.stopPropagation(); openDeal(dod) }} style={{ fontFamily: 'var(--fd)', fontSize: 12.5, fontWeight: 700, color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 9, padding: '8px 13px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>GET IT</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* STATS */}
      <section style={{ maxWidth: 1100, margin: '30px auto 0', padding: '0 26px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <div style={{ background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 17, padding: '22px 18px', boxShadow: '5px 5px 0 var(--pink)' }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(30px,4.4vw,46px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}><StatCounter target={stats.games} suffix="+" /></div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 500, letterSpacing: '.04em', color: 'var(--tx2,#aaa3c6)', marginTop: 8, textTransform: 'uppercase' }}>Games tracked</div>
          </div>
          <div style={{ background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 17, padding: '22px 18px', boxShadow: '5px 5px 0 var(--cyan)' }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(30px,4.4vw,46px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}><StatCounter target={stats.stores} /></div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 500, letterSpacing: '.04em', color: 'var(--tx2,#aaa3c6)', marginTop: 8, textTransform: 'uppercase' }}>Store sources</div>
          </div>
          <div style={{ background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 17, padding: '22px 18px', boxShadow: '5px 5px 0 var(--lime)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(30px,4.4vw,46px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}><StatCounter target={stats.deals} /></span>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--pink)', animation: 'pw-blink 1.3s ease-in-out infinite' }} />
            </div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 500, letterSpacing: '.04em', color: 'var(--tx2,#aaa3c6)', marginTop: 8, textTransform: 'uppercase' }}>Live deals now</div>
          </div>
        </div>
      </section>

      {/* DEALS RAIL */}
      <section id="deals" style={{ maxWidth: 1320, margin: '0 auto', padding: '78px 0 0' }}>
        <SectionHead kicker="HOT DEALS" kickerColor="var(--pink)" title="Deals" action="View all deals →" onAction={() => navigate('/deals')} />
        <Rail vel={0.5}>
          {dealsLoop.map((d, i) => <DealCard key={`${d.title}-${i}`} d={d} onClick={() => openDeal(d)} />)}
        </Rail>
      </section>

      {/* TOURNAMENTS RAIL */}
      <section id="tournaments" style={{ maxWidth: 1320, margin: '0 auto', padding: '78px 0 0' }}>
        <SectionHead kicker="LIVE & UPCOMING" kickerColor="var(--cyan)" title="Tournaments" action="View all tournaments →" onAction={() => navigate('/tournaments')} />
        <Rail vel={0.45}>
          {tournLoop.map((t, i) => <TournCard key={`${t.title}-${i}`} t={t} onClick={() => navigate('/tournaments')} />)}
        </Rail>
      </section>

      {/* NEWS */}
      <section id="news" style={{ maxWidth: 1320, margin: '0 auto', padding: '78px 0 0' }}>
        <div style={{ padding: '0 26px', marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'var(--amber)' }}>FRESH DROPS</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(28px,4.2vw,48px)', fontWeight: 800, letterSpacing: '-.03em', margin: '7px 0 0' }}>Latest News</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx2,#aaa3c6)', paddingBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pink)', boxShadow: '0 0 8px var(--pink)', animation: 'pw-blink 1.3s ease-in-out infinite' }} />Updated live · {stats.stores} sources
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: '0 26px' }}>
          {newsLead && (
            <div className="leadcard" onClick={() => openNews(newsLead)} style={{ flex: '1 1 440px', minWidth: 300, display: 'flex', flexDirection: 'column', background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', borderRadius: 20, overflow: 'hidden', boxShadow: '7px 7px 0 var(--hard)', cursor: 'pointer' }}>
              <div style={{ position: 'relative', height: 'clamp(220px,28vw,310px)', overflow: 'hidden', borderBottom: '3px solid var(--bd,#f6f4ff)' }}>
                {newsLead.image ? (
                  <div className="lead-img-zoom" style={{ position: 'absolute', inset: 0 }}>
                    <img src={newsLead.image} alt={newsLead.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,5,12,.55), transparent 45%)' }} />
                  </div>
                ) : (
                  <div className="lead-img-zoom" style={{ position: 'absolute', inset: 0, background: newsLead.cover }}>
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(0,0,0,.22) 1.6px,transparent 1.7px)', backgroundSize: '15px 15px' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 'clamp(48px,8vw,84px)', color: 'rgba(255,255,255,.14)', letterSpacing: '.02em' }}>{newsLead.source}</span>
                    </div>
                  </div>
                )}
                <span style={{ position: 'absolute', top: 13, left: 13, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 11, letterSpacing: '.07em', color: '#0b0a12', background: newsLead.srcColor, border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '4px 11px' }}>{newsLead.source}</span>
                <span style={{ position: 'absolute', top: 13, right: 13, fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 12, letterSpacing: '.04em', color: '#0b0a12', background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 9, padding: '5px 11px', boxShadow: '3px 3px 0 rgba(0,0,0,.35)', transform: 'rotate(3deg)' }}>TOP STORY</span>
                <span style={{ position: 'absolute', bottom: 13, left: 13, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--fm)', fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.5)', border: '1.5px solid rgba(255,255,255,.5)', borderRadius: 8, padding: '5px 10px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{newsLead.time}
                </span>
              </div>
              <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(21px,2.5vw,30px)', fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.12, margin: 0 }}>{newsLead.title}</h3>
                <div style={{ flex: 1, minHeight: 14 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, borderTop: '2px solid var(--line)', paddingTop: 15 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--tx2,#aaa3c6)' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: newsLead.srcColor }} />{newsLead.source}</div>
                  <span className="lead-read" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', transition: 'gap .2s,color .2s' }}>Read story <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
                </div>
              </div>
            </div>
          )}

          <div style={{ flex: '1 1 380px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {newsRest.map((n) => (
              <div key={n.rank} className="newsrow" onClick={() => openNews(n)} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 15, padding: '13px 15px', boxShadow: '4px 4px 0 var(--hard)', cursor: 'pointer' }}>
                <span className="nrank" style={{ fontFamily: 'var(--fd)', fontSize: 25, fontWeight: 800, color: 'var(--tx3,#736c92)', minWidth: 36, textAlign: 'center', flexShrink: 0 }}>{n.rank}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 9.5, letterSpacing: '.06em', color: '#0b0a12', background: n.srcColor, border: '1.5px solid var(--bd,#f6f4ff)', borderRadius: 6, padding: '2px 7px' }}>{n.source}</span>
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)' }}>{n.time}</span>
                  </div>
                  <div className="nrh" style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.01em', lineHeight: 1.3, color: 'var(--tx,#f6f4ff)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', transition: 'color .2s' }}>{n.title}</div>
                </div>
                <svg className="nchev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}><path d="M9 6l6 6-6 6" /></svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIME MACHINE */}
      <TimeMachine />

      {/* WHY PLAYWISE */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '104px 26px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 34 }}>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: 'var(--pink)' }}>WHY PLAYWISE</div>
          <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(26px,4vw,44px)', fontWeight: 800, letterSpacing: '-.03em', margin: '9px 0 0' }}>Built to save you time.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 18, padding: 22, boxShadow: '5px 5px 0 var(--hard)' }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: f.color, border: '2px solid var(--bd,#f6f4ff)', display: 'grid', placeItems: 'center', color: f.ink, marginBottom: 15 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.01em' }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: 'var(--tx2,#aaa3c6)', marginTop: 6, lineHeight: 1.45 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
