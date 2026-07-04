import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ShellContext, DIR_LABELS, DIR_VEL, useShell, type Direction } from '../context/ShellContext'
import { api } from '../lib/api'
import { readCache, writeCache } from '../lib/cache'
import { buildTicker, type TickerItem } from '../lib/homeData'
import { trackEvent } from '../lib/telemetry'
import IntroLoader from './shell/IntroLoader'
import AskPlayWise from './shell/AskPlayWise'

const INTRO_FLAG = 'pw.intro.played'

// Fallback strip shown until the live deals/tournaments/news load (or if offline).
const TICKER_ITEMS: TickerItem[] = [
  { label: '−85%', color: 'var(--lime)', text: 'Cyberpunk 2077 · Steam' },
  { label: 'FREE', color: 'var(--cyan)', text: 'Fall Guys · Epic' },
  { label: '−40%', color: 'var(--amber)', text: 'Elden Ring · GOG' },
  { label: 'LIVE', color: 'var(--pink)', text: 'Valorant Champions' },
  { label: '−60%', color: 'var(--lime)', text: "Baldur's Gate 3 · GOG" },
  { label: '−75%', color: 'var(--cyan)', text: 'Hades II · Steam' },
  { label: 'NEW', color: 'var(--amber)', text: 'NVIDIA driver 566' },
]

function DecorBg() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--line) 1.2px,transparent 1.4px)', backgroundSize: '24px 24px', opacity: 0.55, maskImage: 'radial-gradient(ellipse 100% 70% at 50% 0%,#000,transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 100% 70% at 50% 0%,#000,transparent 80%)' }} />
      <div style={{ position: 'absolute', top: '8%', right: -90, width: 340, height: 340, border: '2px solid var(--vio)', borderRadius: 42, opacity: 0.18, transform: 'rotate(18deg)' }} />
      <div style={{ position: 'absolute', bottom: '12%', left: -70, width: 240, height: 240, border: '2px solid var(--cyan)', borderRadius: '50%', opacity: 0.16 }} />
      <div style={{ position: 'absolute', top: '42%', left: '46%', width: 120, height: 120, border: '2px solid var(--pink)', opacity: 0.14, transform: 'rotate(24deg)' }} />
    </div>
  )
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="navlink" onClick={onClick} style={{ font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer', padding: '9px 11px', borderRadius: 8 }}>
      {label}
    </button>
  )
}

function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <defs>
        <linearGradient id="pwLogoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff2e6e" />
          <stop offset=".5" stopColor="#a24dff" />
          <stop offset="1" stopColor="#1fd7ff" />
        </linearGradient>
      </defs>
      <path d="M19 15 L34 24 L19 33 Z" fill="url(#pwLogoGrad)" />
    </svg>
  )
}

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { user, logout, token } = useAuth()
  const headerRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => {
      const h = headerRef.current
      if (h) h.style.boxShadow = window.scrollY > 12 ? '0 12px 30px -14px rgba(0,0,0,.7)' : 'none'
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const goSearch = (q: string) => {
    const trimmed = q.trim()
    navigate({ pathname: '/games', search: trimmed ? `?q=${encodeURIComponent(trimmed)}` : '' })
  }
  const openAuth = (path: '/login' | '/register') =>
    navigate(path, { state: { backgroundLocation: location, from: `${location.pathname}${location.search}` } })

  return (
    <header ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 200, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 26px', background: 'var(--bg,#0b0a12)', transition: 'box-shadow .3s ease' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'var(--grad)' }} />
      <button onClick={() => { navigate('/'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <span style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--vio)', display: 'grid', placeItems: 'center' }}>
          <Logo />
        </span>
        <span style={{ fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 800, letterSpacing: '-.03em', color: 'var(--tx,#f6f4ff)' }}>
          Play<span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Wise</span>
        </span>
      </button>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 10 }}>
        <NavBtn label="All Games" onClick={() => navigate('/games')} />
        <NavBtn label="Tournaments" onClick={() => navigate('/tournaments')} />
        <NavBtn label="Deals" onClick={() => navigate('/deals')} />
        <NavBtn label="News" onClick={() => navigate('/news')} />
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--card,#1a1630)', border: '2px solid var(--line2,#3a3460)', borderRadius: 11, padding: '8px 13px', width: 212 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
        <input
          ref={searchRef}
          onKeyDown={(e) => { if (e.key === 'Enter') goSearch((e.target as HTMLInputElement).value) }}
          placeholder="Search games"
          style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 13.5, width: '100%' }}
        />
      </div>

      <button className="press" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme" style={{ width: 42, height: 42, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, cursor: 'pointer', color: 'var(--tx,#f6f4ff)', boxShadow: '2px 2px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>
        {theme === 'dark' ? (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.3 6.3 0 0 0 9.5 9.5Z" /></svg>
        ) : (
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" /></svg>
        )}
      </button>

      {user ? (
        <>
          <span style={{ font: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--line2,#3a3460)', borderRadius: 11, padding: '9px 15px' }}>{user.username}</span>
          <button className="press" onClick={() => { void trackEvent({ category: 'auth', action: 'logout', label: user.username }, token); logout() }} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '9px 15px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>Log out</button>
        </>
      ) : (
        <>
          <button className="press" onClick={() => openAuth('/login')} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '9px 15px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>Log in</button>
          <button className="press" onClick={() => openAuth('/register')} style={{ font: 'inherit', fontSize: 13.5, fontWeight: 800, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '9px 16px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }}>Sign up</button>
        </>
      )}
    </header>
  )
}

function LiveTicker() {
  // Cache-first: last-seen real strip shows instantly; hardcoded list is only the
  // very-first-visit fallback.
  const [items, setItems] = useState<TickerItem[]>(() => readCache<TickerItem[]>('ticker') ?? TICKER_ITEMS)
  useEffect(() => {
    let ignore = false
    void (async () => {
      const [d, t, n] = await Promise.allSettled([
        api.fetchDeals(),
        api.fetchTournaments({ limit: 10 }),
        api.fetchNews({ limit: 6 }),
      ])
      if (ignore) return
      const built = buildTicker(
        d.status === 'fulfilled' ? d.value : [],
        t.status === 'fulfilled' ? t.value : [],
        n.status === 'fulfilled' ? n.value : []
      )
      if (built.length >= 4) { setItems(built); writeCache('ticker', built) }
    })()
    return () => { ignore = true }
  }, [])
  const row = [...items, ...items]
  return (
    <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'stretch', borderTop: '2px solid var(--line)', borderBottom: '2px solid var(--line)', background: 'var(--panel,#120f1f)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--pink)', color: '#fff', fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 12, letterSpacing: '.1em', padding: '11px 16px', borderRight: '2px solid var(--line)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pw-blink 1.2s ease-in-out infinite' }} />LIVE
      </div>
      <div style={{ overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 30, whiteSpace: 'nowrap', animation: 'pw-marquee 30s linear infinite', fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 500, paddingLeft: 24, color: 'var(--tx2)' }}>
          {row.map((it, i) => (
            <span key={i}><b style={{ color: it.color }}>{it.label}</b> {it.text}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Footer() {
  const { toast } = useShell()
  const chip = { font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--tx2,#aaa3c6)', background: 'var(--card,#1a1630)', border: '2px solid var(--line2,#3a3460)', borderRadius: 9, padding: '8px 13px', cursor: 'pointer', transition: 'transform .15s,border-color .15s,color .15s' } as const
  return (
    <footer style={{ position: 'relative', zIndex: 1, marginTop: 110, borderTop: '2px solid var(--line)', background: 'var(--panel,#120f1f)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '44px 26px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '3px 3px 0 var(--pink)', display: 'grid', placeItems: 'center' }}><Logo size={24} /></span>
          <div>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em' }}>Play<span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>Wise</span></div>
            <div style={{ fontSize: 13.5, color: 'var(--tx2,#aaa3c6)', marginTop: 2 }}>We're here for you.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {['Privacy', 'Terms', 'Cookie Policy'].map((l) => (
            <button key={l} className="chip" onClick={() => toast(`${l} — coming soon`)} style={chip}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ borderTop: '2px solid var(--line)', textAlign: 'center', padding: '18px 26px', fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx3,#736c92)', letterSpacing: '.04em' }}>© 2026 PLAYWISE · ALL DEALS REFRESHED LIVE</div>
    </footer>
  )
}

function MotionSwitcher() {
  const { direction, setDirection, toast } = useShell()
  const dirs: Direction[] = ['cinematic', 'arcade', 'liquid']
  return (
    <div style={{ position: 'fixed', left: 22, bottom: 22, zIndex: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 14, padding: 7, boxShadow: '4px 4px 0 var(--hard)' }}>
        <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', padding: '0 4px 0 6px' }}>MOTION</span>
        {dirs.map((d) => {
          const on = d === direction
          return (
            <button key={d} onClick={() => { setDirection(d); toast(`Motion: ${DIR_LABELS[d]}`) }} style={{ fontFamily: 'var(--fd)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', borderRadius: 9, padding: '7px 11px', background: on ? 'var(--vio)' : 'transparent', color: on ? '#fff' : 'var(--tx2,#aaa3c6)' }}>{DIR_LABELS[d]}</button>
          )
        })}
      </div>
    </div>
  )
}

function Toaster({ msg }: { msg: { text: string; key: number } }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!msg.text) return
    const t = ref.current
    if (!t) return
    t.style.opacity = '1'
    t.style.transform = 'translateX(-50%) translateY(0)'
    const id = window.setTimeout(() => {
      if (t) {
        t.style.opacity = '0'
        t.style.transform = 'translateX(-50%) translateY(30px)'
      }
    }, 2200)
    return () => window.clearTimeout(id)
  }, [msg])
  return (
    <div ref={ref} style={{ position: 'fixed', left: '50%', bottom: 32, transform: 'translateX(-50%) translateY(30px)', zIndex: 600, opacity: 0, pointerEvents: 'none', transition: 'all .35s cubic-bezier(.16,1,.3,1)', background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', color: 'var(--tx,#f6f4ff)', fontSize: 14, fontWeight: 600, padding: '12px 19px', borderRadius: 13, boxShadow: '5px 5px 0 var(--hard)' }}>
      {msg.text}
    </div>
  )
}

export default function AppShell() {
  const [direction, setDirection] = useState<Direction>('cinematic')
  const initialPlayed = typeof window !== 'undefined' && window.sessionStorage.getItem(INTRO_FLAG) === '1'
  const [ready, setReady] = useState(initialPlayed)
  const [playIntro] = useState(!initialPlayed)
  const [toastState, setToastState] = useState<{ text: string; key: number }>({ text: '', key: 0 })

  const toast = useCallback((text: string) => setToastState((s) => ({ text, key: s.key + 1 })), [])
  const handleIntroDone = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_FLAG, '1')
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [])

  const value = useMemo(
    () => ({ direction, setDirection, velFactor: DIR_VEL[direction], ready, toast }),
    [direction, ready, toast]
  )

  return (
    <ShellContext.Provider value={value}>
      <div className="pw" data-direction={direction} data-ready={ready ? '1' : undefined} style={{ position: 'relative', minHeight: '100vh', overflowX: 'clip' }}>
        <DecorBg />
        {playIntro && <IntroLoader onDone={handleIntroDone} />}
        <Header />
        <LiveTicker />
        <main style={{ position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
        <Footer />
        <MotionSwitcher />
        <AskPlayWise />
        <Toaster msg={toastState} />
      </div>
    </ShellContext.Provider>
  )
}
