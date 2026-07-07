import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'

import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useShell } from '../context/ShellContext'
import {
  CORE_GAMES,
  FILTER_DEFS,
  GAMES,
  SOURCE_KEYS,
  SRC,
  accentFor,
  enrich,
  fmtLeft,
  generated,
  mapReal,
  type TItem,
} from '../lib/tournamentData'

const TRACK_KEY = 'playwise-tourny-tracked'
const EMAIL_KEY = 'playwise-tourny-email'

function withVar(style: CSSProperties, name: string, val: string): CSSProperties {
  return { ...style, [name]: val } as CSSProperties
}

const card = { background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)' } as const

export default function TournamentsPage() {
  const { toast } = useShell()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const baseRef = useRef(Date.now())
  const [dataset, setDataset] = useState<TItem[]>(() => generated())
  const [activeGame, setActiveGame] = useState('valorant')
  const [query, setQuery] = useState('')
  const [sources, setSources] = useState<string[]>([...SOURCE_KEYS])
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [f, setF] = useState<{ date: string; fee: string; region: string }>({ date: 'all', fee: 'all', region: 'all' })
  const [tracked, setTracked] = useState<string[]>([])
  const [alertsOn, setAlertsOn] = useState<Record<string, boolean>>({})
  const [now, setNow] = useState(Date.now())
  // real cover art + catalog membership for the games in the dataset
  const [covers, setCovers] = useState<Record<string, string>>({})
  const knownGames = useMemo(() => new Set(Object.keys(covers)), [covers])
  // guest alert email + server subscription ids (logged-in)
  const [guestEmail, setGuestEmail] = useState<string>(() => { try { return localStorage.getItem(EMAIL_KEY) || '' } catch { return '' } })
  const [emailDraft, setEmailDraft] = useState('')
  const subIdsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    let ignore = false
    void (async () => {
      try {
        const t = await api.fetchTournaments({ limit: 60 })
        if (ignore || !t.length) return
        const mapped = mapReal(t, baseRef.current)
        if (mapped.length >= 3) setDataset(mapped)
        // resolve real cover art for the games these tournaments belong to
        const slugs = [...new Set(mapped.map((x) => x.gameSlug))].slice(0, 16)
        const details = await Promise.allSettled(slugs.map((sl) => api.fetchGameDetails(sl)))
        if (ignore) return
        const map: Record<string, string> = {}
        details.forEach((r) => {
          if (r.status === 'fulfilled' && r.value.slug && r.value.image) map[r.value.slug] = r.value.image
        })
        setCovers(map)
      } catch {
        /* keep representative */
      }
    })()
    try {
      const saved = JSON.parse(localStorage.getItem(TRACK_KEY) || 'null')
      if (saved && Array.isArray(saved.list)) { setTracked(saved.list); if (saved.on) setAlertsOn(saved.on) }
    } catch {
      /* ignore */
    }
    return () => { ignore = true }
  }, [])

  // logged-in: server-side subscriptions are the source of truth
  useEffect(() => {
    if (!token) return
    let ignore = false
    void (async () => {
      try {
        const subs = await api.fetchTournamentSubscriptions(token)
        if (ignore) return
        const gameSubs = subs.filter((s) => s.scope === 'GAME' && s.gameSlug)
        const ids: Record<string, string> = {}
        const on: Record<string, boolean> = {}
        const list: string[] = []
        gameSubs.forEach((s) => {
          const slug = s.gameSlug as string
          ids[slug] = s.id
          on[slug] = s.isActive
          if (!list.includes(slug)) list.push(slug)
        })
        subIdsRef.current = ids
        setTracked(list)
        setAlertsOn(on)
      } catch {
        /* keep local state */
      }
    })()
    return () => { ignore = true }
  }, [token])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!openMenu) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menuwrap]')) setOpenMenu(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [openMenu])

  // ensure active game stays valid for the dataset
  const dsGames = useMemo(() => new Set(dataset.map((t) => t.gameSlug)), [dataset])
  useEffect(() => {
    if (!dsGames.has(activeGame)) {
      const first = dataset[0]?.gameSlug
      if (first) setActiveGame(first)
    }
  }, [dsGames, activeGame, dataset])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    dataset.forEach((t) => { c[t.gameSlug] = (c[t.gameSlug] || 0) + 1 })
    return c
  }, [dataset])

  const rosterGames = useMemo(() => {
    // games that exist in the dataset, in roster order, then any extras
    const inData = GAMES.filter((g) => counts[g.slug])
    const known = new Set(inData.map((g) => g.slug))
    const extras = [...dsGames].filter((s) => !known.has(s)).map((s) => {
      const name = dataset.find((t) => t.gameSlug === s)?.game || s
      const abbr = name.split(/\s+/).map((w) => w[0]).join('').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || s.slice(0, 3).toUpperCase()
      return { slug: s, name, abbr, accent: accentFor(s) }
    })
    // most tournaments first so the rail leads with the busiest games
    return [...inData, ...extras].sort((a, b) => (counts[b.slug] || 0) - (counts[a.slug] || 0))
  }, [counts, dsGames, dataset])

  const q = query.trim().toLowerCase()
  const railGames = rosterGames
    .filter((_g, i) => showMore || i < CORE_GAMES)
    .filter((g) => !q || g.name.toLowerCase().includes(q) || g.abbr.toLowerCase().includes(q))
    .map((g) => ({ ...g, count: counts[g.slug] || 0 }))

  const ag = rosterGames.find((g) => g.slug === activeGame) || rosterGames[0] || GAMES[0]
  const agItems = useMemo(() => dataset.filter((t) => t.gameSlug === activeGame), [dataset, activeGame])

  const filtered = useMemo(() => {
    let arr = agItems.filter((t) => sources.includes(t.src))
    if (f.date !== 'all') {
      const lim = { '48h': 48, week: 168, month: 720 }[f.date] || 99999
      arr = arr.filter((t) => t.status === 'live' || (t.dlH > 0 && t.dlH <= lim))
    }
    // fee < 0 = unknown (real tournaments don't expose fees) — keep those visible
    if (f.fee === 'free') arr = arr.filter((t) => t.fee <= 0)
    else if (f.fee === 'paid') arr = arr.filter((t) => t.fee > 0 || t.fee < 0)
    if (f.region !== 'all') arr = arr.filter((t) => t.region === f.region)
    return [...arr].sort((a, b) => {
      if ((a.status === 'live') !== (b.status === 'live')) return a.status === 'live' ? -1 : 1
      return a.dlH - b.dlH
    })
  }, [agItems, sources, f])

  const cards = useMemo(() => filtered.map((t) => enrich(t, baseRef.current)), [filtered])
  const activePlatforms = new Set(agItems.map((t) => t.src)).size
  const closingSoon = agItems.filter((t) => t.status !== 'live' && t.dlH > 0 && t.dlH < 48).length
  const liveCount = dataset.filter((t) => t.status === 'live').length
  const upcomingCount = dataset.length - liveCount
  const cardKey = `${activeGame}|${view}|${sources.join(',')}|${f.date}|${f.fee}|${f.region}`

  const persistTracked = (list: string[], on: Record<string, boolean>) => {
    try { localStorage.setItem(TRACK_KEY, JSON.stringify({ list, on })) } catch { /* ignore */ }
  }
  const gameName = (slug: string) =>
    dataset.find((t) => t.gameSlug === slug)?.game || GAMES.find((x) => x.slug === slug)?.name || slug

  const addTrack = (slug: string) => {
    if (tracked.includes(slug)) return
    const list = [...tracked, slug]
    const on = { ...alertsOn, [slug]: true }
    setTracked(list); setAlertsOn(on); persistTracked(list, on)
    toast(`Added ${gameName(slug)} to Tourny Alert List`)
    if (token) {
      void api.createTournamentSubscription({ scope: 'GAME', gameSlug: slug }, token)
        .then((sub) => { subIdsRef.current[slug] = sub.id })
        .catch(() => toast('Could not sync this alert to your account'))
    } else if (guestEmail) {
      void api.subscribeTournamentAlerts({ email: guestEmail, scope: 'GAME', gameSlug: slug }).catch(() => {})
    } else {
      setAlertOpen(true)
    }
  }
  const removeTracked = (slug: string) => {
    const list = tracked.filter((x) => x !== slug)
    setTracked(list); persistTracked(list, alertsOn)
    if (token && subIdsRef.current[slug]) {
      void api.deleteTournamentSubscription(subIdsRef.current[slug], token).catch(() => {})
      delete subIdsRef.current[slug]
    } else if (guestEmail) {
      void api.unsubscribeTournamentAlerts({ email: guestEmail, gameSlug: slug }).catch(() => {})
    }
  }
  const toggleAlertOn = (slug: string) => {
    const next = alertsOn[slug] === false
    const on = { ...alertsOn, [slug]: next }
    setAlertsOn(on); persistTracked(tracked, on)
    toast(next ? 'Alerts on' : 'Alerts muted')
    if (token && subIdsRef.current[slug]) {
      void api.updateTournamentSubscription(subIdsRef.current[slug], { isActive: next }, token).catch(() => {})
    } else if (guestEmail) {
      void api.subscribeTournamentAlerts({ email: guestEmail, scope: 'GAME', gameSlug: slug, isActive: next }).catch(() => {})
    }
  }
  const saveGuestEmail = () => {
    const email = emailDraft.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Enter a valid email for alerts'); return }
    setGuestEmail(email)
    try { localStorage.setItem(EMAIL_KEY, email) } catch { /* ignore */ }
    tracked.forEach((slug) => {
      void api.subscribeTournamentAlerts({ email, scope: 'GAME', gameSlug: slug, isActive: alertsOn[slug] !== false }).catch(() => {})
    })
    toast(`Tourny alerts will go to ${email}`)
  }
  const resetFilters = () => { setSources([...SOURCE_KEYS]); setF({ date: 'all', fee: 'all', region: 'all' }); setOpenMenu(null); toast('Filters reset') }

  const deadlineText = (deadlineAt: number, status: string) => {
    if (status === 'live') return 'Live now'
    const ms = deadlineAt - now
    if (ms <= 0) return 'Reg closed'
    return fmtLeft(ms)
  }

  return (
    <div id="top">
      {/* Headline */}
      <section style={{ maxWidth: 1340, margin: '0 auto', padding: '40px 26px 0', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 28 }}>
        <div style={{ minWidth: 300, flex: '1 1 540px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--cyan)' }}><span style={{ width: 18, height: 2, background: 'var(--cyan)' }} />TOURNAMENT FINDER · 4 PLATFORMS</div>
          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(34px,5vw,62px)', lineHeight: 0.96, fontWeight: 800, letterSpacing: '-.04em', margin: '14px 0 0' }}>Every open bracket,<br /><span style={{ display: 'inline-block', background: 'var(--lime)', color: '#0b0a12', padding: '0 .12em', marginTop: '.08em', border: '3px solid var(--bd)', boxShadow: '6px 6px 0 var(--hard)', transform: 'rotate(-1.4deg)' }}>before it closes.</span></h1>
          <p style={{ fontSize: 'clamp(15px,1.7vw,18px)', color: 'var(--tx2,#aaa3c6)', maxWidth: '54ch', margin: '24px 0 0', lineHeight: 1.55 }}>PlayWise pulls open registrations from <b style={{ color: 'var(--tx)' }}>start.gg, FACEIT, Battlefy &amp; Discord</b> into one list — and counts down every deadline so you never miss the entry window. Click <b style={{ color: 'var(--tx)' }}>Register</b> to finish on the source platform.</p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ ...card, borderRadius: 17, padding: '17px 20px', boxShadow: '5px 5px 0 var(--pink)', minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}><span style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--pink)' }}>{liveCount}</span><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pink)', animation: 'pw-blink 1.3s ease-in-out infinite' }} /></div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 500, letterSpacing: '.05em', color: 'var(--tx2,#aaa3c6)', marginTop: 7, textTransform: 'uppercase' }}>Live now</div>
          </div>
          <div style={{ ...card, borderRadius: 17, padding: '17px 20px', boxShadow: '5px 5px 0 var(--cyan)', minWidth: 120 }}>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: 'var(--tx)' }}>{upcomingCount}</div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 500, letterSpacing: '.05em', color: 'var(--tx2,#aaa3c6)', marginTop: 7, textTransform: 'uppercase' }}>Open to enter</div>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <section style={{ maxWidth: 1340, margin: '28px auto 0', padding: '0 26px' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
          {/* Game rail */}
          <aside style={{ position: 'sticky', top: 78, flexShrink: 0, alignSelf: 'flex-start' }}>
            <div className="rail" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, width: 156, ...card, borderRadius: 20, boxShadow: '5px 6px 0 var(--hard)', padding: '12px 10px', maxHeight: 'calc(100vh - 102px)', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 11, padding: '8px 10px', marginBottom: 4 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--tx3,#736c92)" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Game" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 13, width: '100%', minWidth: 0 }} />
              </div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', padding: '4px 2px 2px' }}>Games</div>
              {railGames.map((g) => {
                const on = g.slug === activeGame
                return (
                  <button key={g.slug} className="press" onClick={() => { setActiveGame(g.slug); setOpenMenu(null) }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 2px' }}>
                    <span style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 5, height: on ? 30 : 0, borderRadius: 4, background: g.accent, transition: 'height .25s var(--ease)' }} />
                    <span style={{ position: 'relative', width: 80, height: 80, borderRadius: 19, background: on ? 'var(--card,#1a1630)' : 'var(--card2,#221c3c)', border: `2.5px solid ${on ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, boxShadow: on ? `3px 3px 0 ${g.accent}` : 'none', transform: on ? 'translateY(-1px)' : 'none', display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 19, color: 'var(--tx,#f6f4ff)', transition: 'border-color .2s,box-shadow .2s,transform .2s' }}>
                      {covers[g.slug] ? (
                        <img src={covers[g.slug]} alt={g.name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: on ? 1 : 0.82 }} />
                      ) : (
                        g.abbr
                      )}
                      <span style={{ position: 'absolute', top: -7, right: -7, minWidth: 20, height: 20, padding: '0 4px', borderRadius: 10, background: g.accent, border: '2px solid var(--bd,#f6f4ff)', color: '#0b0a12', fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 10.5, display: 'grid', placeItems: 'center', zIndex: 1 }}>{g.count}</span>
                    </span>
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: on ? 'var(--tx,#f6f4ff)' : 'var(--tx3,#736c92)', maxWidth: 114, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                  </button>
                )
              })}
              {railGames.length === 0 && <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--tx3,#736c92)', textAlign: 'center', padding: '14px 4px', lineHeight: 1.5 }}>No game matches “{query}”.</div>}
              {rosterGames.length > CORE_GAMES && (
                <button className="press" onClick={() => setShowMore((s) => !s)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: '8px 2px 4px', marginTop: 2, borderTop: '2px dashed var(--line2,#3a3460)' }}>
                  <span style={{ width: 80, height: 60, borderRadius: 16, background: 'var(--bg,#0b0a12)', border: '2px dashed var(--line2,#3a3460)', display: 'grid', placeItems: 'center', color: 'var(--tx2,#aaa3c6)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg></span>
                  <span style={{ fontFamily: 'var(--fm)', fontSize: 9.5, fontWeight: 600, color: 'var(--tx3,#736c92)' }}>{showMore ? 'Less' : 'More'}</span>
                </button>
              )}
            </div>
          </aside>

          {/* Main column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Active game header */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, ...card, borderRadius: 18, boxShadow: '5px 6px 0 var(--hard)', padding: '15px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <span style={{ position: 'relative', width: 52, height: 52, flexShrink: 0, borderRadius: 15, background: 'var(--card2,#221c3c)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: `3px 3px 0 ${ag.accent}`, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 17, color: 'var(--tx,#f6f4ff)' }}>
                  {covers[ag.slug] ? <img src={covers[ag.slug]} alt={ag.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : ag.abbr}
                </span>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, letterSpacing: '-.02em', margin: 0, lineHeight: 1.02 }}>{ag.name}</h2>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 12.5, fontWeight: 500, color: 'var(--tx2,#aaa3c6)', marginTop: 5 }}>
                    <b style={{ color: 'var(--lime)' }}>{agItems.length}</b> active across <b style={{ color: 'var(--tx)' }}>{activePlatforms}</b> platform{activePlatforms === 1 ? '' : 's'}
                    {knownGames.has(ag.slug) && (
                      <>
                        {' · '}
                        <button onClick={() => navigate(`/games/${ag.slug}`)} style={{ font: 'inherit', fontWeight: 700, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>View game →</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <button className="press" onClick={() => addTrack(activeGame)} title="Track this game" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: tracked.includes(activeGame) ? 'var(--lime)' : 'var(--card2,#221c3c)', border: `2px solid ${tracked.includes(activeGame) ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, borderRadius: 12, padding: '9px 13px', cursor: 'pointer', color: tracked.includes(activeGame) ? '#0b0a12' : 'var(--tx2,#aaa3c6)', boxShadow: '2px 2px 0 var(--hard)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.5 21a1.8 1.8 0 0 1-3 0" /></svg>
                  <span style={{ fontFamily: 'var(--ff)', fontSize: 13, fontWeight: 700 }}>Track</span>
                </button>
                <button className="press" onClick={() => setAlertOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 12, padding: '9px 14px', cursor: 'pointer', color: '#0b0a12', boxShadow: '3px 3px 0 var(--hard)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.5 21a1.8 1.8 0 0 1-3 0" /></svg>
                  <span style={{ fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-.01em' }}>Tourny Alert List</span>
                  <span style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, background: '#0b0a12', color: 'var(--lime)', borderRadius: 7, padding: '1px 7px', lineHeight: 1.6 }}>{tracked.length}</span>
                </button>
              </div>
            </div>

            {/* Urgency bar */}
            {closingSoon > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 14, background: 'linear-gradient(0deg,rgba(255,46,110,.12),rgba(255,46,110,.12)),var(--card,#1a1630)', border: '2.5px solid var(--pink)', borderRadius: 14, padding: '12px 16px', animation: 'pw-urg 2.4s ease-in-out infinite' }}>
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, background: 'var(--pink)', display: 'grid', placeItems: 'center', color: '#fff' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 800, letterSpacing: '-.01em', color: 'var(--tx,#f6f4ff)' }}><span style={{ color: 'var(--pink)' }}>{closingSoon}</span> closing within 48 hours</div>
                  <div style={{ fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx2,#aaa3c6)', marginTop: 2 }}>Don't miss the registration deadline — set an alert and we'll ping you.</div>
                </div>
                <button className="press" onClick={() => setAlertOpen(true)} style={{ flexShrink: 0, fontFamily: 'var(--ff)', fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--pink)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '8px 13px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)' }}>Set alerts →</button>
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 14, ...card, borderRadius: 16, boxShadow: '4px 5px 0 var(--hard)', padding: '12px 15px' }}>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase' }}>Source</span>
              {SOURCE_KEYS.map((id) => {
                const on = sources.includes(id)
                return (
                  <button key={id} className="srcchip press" onClick={() => setSources((cur) => cur.includes(id) ? cur.filter((s) => s !== id) : [...cur, id])} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 100, padding: '7px 13px', border: `2px solid ${on ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, background: on ? 'var(--card2,#221c3c)' : 'transparent', color: on ? 'var(--tx,#f6f4ff)' : 'var(--tx2,#aaa3c6)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: SRC[id].color, border: '1.5px solid var(--bd,#f6f4ff)' }} />{SRC[id].name}
                  </button>
                )
              })}
              <span style={{ width: 2, height: 26, background: 'var(--line2,#3a3460)', margin: '0 4px' }} />
              {FILTER_DEFS.map((fl) => {
                const cur = f[fl.id]
                const co = fl.options.find((o) => o[0] === cur)
                return (
                  <div key={fl.id} data-menuwrap style={{ position: 'relative' }}>
                    <button className="press" onClick={() => setOpenMenu((m) => m === fl.id ? null : fl.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--ff)', fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 11, padding: '8px 12px', cursor: 'pointer' }}>
                      <span style={{ fontFamily: 'var(--fm)', fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--tx3,#736c92)' }}>{fl.label}</span>
                      <span style={{ fontSize: 13 }}>{co ? co[1] : 'Any'}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--tx3,#736c92)' }}><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                    {openMenu === fl.id && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 130, minWidth: 172, ...card, borderRadius: 14, boxShadow: '5px 6px 0 var(--hard)', padding: 6 }}>
                        {fl.options.map((op) => {
                          const on = f[fl.id] === op[0]
                          return (
                            <button key={op[0]} onClick={() => { setF((prev) => ({ ...prev, [fl.id]: op[0] })); setOpenMenu(null) }} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, font: 'inherit', fontSize: 13, fontWeight: 600, color: on ? '#0b0a12' : 'var(--tx,#f6f4ff)', background: on ? 'var(--lime)' : 'none', border: 'none', borderRadius: 9, padding: '9px 11px', cursor: 'pointer', textAlign: 'left' }}>{op[1]}</button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              <div style={{ flex: 1, minWidth: 6 }} />
              <div style={{ display: 'inline-flex', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 11, padding: 3 }}>
                {(['grid', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} title={v} style={{ display: 'grid', placeItems: 'center', width: 34, height: 32, border: 'none', background: view === v ? 'var(--lime)' : 'transparent', borderRadius: 8, cursor: 'pointer', color: view === v ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}>
                    {v === 'grid'
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><rect x="3" y="3" width="7" height="7" rx="1.4" /><rect x="14" y="3" width="7" height="7" rx="1.4" /><rect x="3" y="14" width="7" height="7" rx="1.4" /><rect x="14" y="14" width="7" height="7" rx="1.4" /></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '18px 2px 0' }}>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, color: 'var(--tx2,#aaa3c6)' }}><span style={{ color: 'var(--lime)' }}>{cards.length}</span> result{cards.length === 1 ? '' : 's'} · sorted by closing soonest</div>
              <button onClick={resetFilters} style={{ fontFamily: 'var(--ff)', fontSize: 12, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>Reset filters</button>
            </div>

            {/* Cards grid */}
            <div key={cardKey} style={{ display: 'grid', gap: 16, marginTop: 14, gridTemplateColumns: view === 'list' ? '1fr' : 'repeat(auto-fill,minmax(322px,1fr))' }}>
              {cards.map((c, i) => (
                <div key={c.id} className="tcardin" style={withVar({ ...card, borderRadius: 18, boxShadow: '4px 5px 0 var(--hard)', padding: 16, animationDelay: `${Math.min(i, 12) * 42}ms` }, '--sc', c.accent)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 11, letterSpacing: '.03em', color: c.sourceText, background: c.sourceColor, border: '2px solid var(--bd,#f6f4ff)', borderRadius: 8, padding: '4px 9px' }}>{c.sourceName}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 9.5, letterSpacing: '.06em', color: c.stFg, background: c.stBg, border: `2px solid ${c.stBorder}`, borderRadius: 7, padding: '3px 8px' }}>{c.stDot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'pw-blink 1.1s ease-in-out infinite' }} />}{c.stLabel}</span>
                    <div style={{ flex: 1, minWidth: 4 }} />
                    <button className="press" onClick={() => addTrack(c.gameSlug)} title="Add game to Tourny Alert List" style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', background: tracked.includes(c.gameSlug) ? 'var(--lime)' : 'var(--card2,#221c3c)', border: `2px solid ${tracked.includes(c.gameSlug) ? 'var(--bd,#f6f4ff)' : 'var(--line2,#3a3460)'}`, borderRadius: 10, cursor: 'pointer', color: tracked.includes(c.gameSlug) ? '#0b0a12' : 'var(--tx2,#aaa3c6)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.5 21a1.8 1.8 0 0 1-3 0" /></svg></button>
                  </div>

                  <div style={{ fontFamily: 'var(--fd)', fontSize: 17, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.16, marginTop: 13 }}>{c.title}</div>

                  <button
                    onClick={() => { if (knownGames.has(c.gameSlug)) navigate(`/games/${c.gameSlug}`) }}
                    title={knownGames.has(c.gameSlug) ? `Open ${c.game} on PlayWise` : undefined}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 100, padding: '4px 11px 4px 5px', cursor: knownGames.has(c.gameSlug) ? 'pointer' : 'default', color: 'var(--tx,#f6f4ff)' }}
                  >
                    <span style={{ position: 'relative', width: 24, height: 24, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: c.accent, border: '1.5px solid var(--bd,#f6f4ff)', display: 'grid', placeItems: 'center', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 10, color: '#0b0a12' }}>
                      {covers[c.gameSlug] ? <img src={covers[c.gameSlug]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : c.game[0]}
                    </span>
                    <span style={{ fontFamily: 'var(--fm)', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.game}</span>
                    {knownGames.has(c.gameSlug) && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>}
                  </button>

                  <div style={{ marginTop: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--tx2,#aaa3c6)' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" style={{ flexShrink: 0, color: 'var(--tx3,#736c92)' }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{c.startLabel}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                      {c.teamSize && <span style={chipMeta}>{c.teamSize}</span>}
                      {c.prizeLabel && <span style={chipMeta}>{c.prizeLabel}</span>}
                      <span style={chipMeta}>{c.region}</span>
                      {c.venue && <span style={chipMeta}>📍 {c.venue}</span>}
                      {c.formats.map((ft) => <span key={ft} style={{ ...chipMeta, color: 'var(--vio)' }}>{ft}</span>)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '2px solid var(--line)' }}>
                    <div>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 9.5, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase' }}>Registration closes in</div>
                      <div style={{ fontFamily: 'var(--fm)', fontSize: 23, fontWeight: 700, lineHeight: 1.1, color: c.status === 'live' ? 'var(--pink)' : (c.deadlineAt - now < 48 * 3600000 ? 'var(--pink)' : 'var(--lime)'), fontVariantNumeric: 'tabular-nums' }}>{deadlineText(c.deadlineAt, c.status)}</div>
                    </div>
                    {c.real ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontFamily: 'var(--fm)', fontSize: 11.5 }}>
                        <span style={{ fontWeight: 700, color: 'var(--tx,#f6f4ff)' }}>Spots &amp; bracket on {c.sourceName}</span>
                        <span style={{ color: 'var(--tx3,#736c92)' }}>{c.feeLabel}</span>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, fontFamily: 'var(--fm)', fontSize: 11.5 }}><span style={{ fontWeight: 700, color: 'var(--tx,#f6f4ff)' }}>{c.spotsLeft} spots left</span><span style={{ color: 'var(--tx3,#736c92)' }}>{c.feeLabel}</span></div>
                        <div style={{ marginTop: 6, height: 7, borderRadius: 5, background: 'var(--line2,#3a3460)', border: '1.5px solid var(--bd,#f6f4ff)', overflow: 'hidden' }}><div style={{ height: '100%', width: c.fillPct, background: c.barColor }} /></div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 14 }}>
                    <button className="reg press" onClick={() => { window.open(c.url, '_blank', 'noopener,noreferrer'); toast(`Opening ${c.sourceName} → finish your registration`) }} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-.01em', color: '#0b0a12', background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', borderRadius: 12, padding: '11px 16px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)' }}>Register on {c.sourceName}<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg></button>
                  </div>
                </div>
              ))}

              {cards.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 22px', ...card, border: '2.5px dashed var(--line2,#3a3460)', borderRadius: 18 }}>
                  <div style={{ fontFamily: 'var(--fd)', fontSize: 21, fontWeight: 800, letterSpacing: '-.02em' }}>No open registrations match these filters</div>
                  <div style={{ fontSize: 14, color: 'var(--tx2,#aaa3c6)', marginTop: 9, lineHeight: 1.5 }}>Try re-enabling a source, widening the date range, or clearing entry-fee &amp; region.</div>
                  <button className="press" onClick={resetFilters} style={{ marginTop: 20, fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 700, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '10px 17px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)' }}>Reset filters</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Alert drawer */}
      <div onClick={() => setAlertOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 690, background: 'rgba(7,6,12,.6)', opacity: alertOpen ? 1 : 0, pointerEvents: alertOpen ? 'auto' : 'none', transition: 'opacity .3s ease' }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 700, width: 'min(388px,calc(100vw - 32px))', background: 'var(--card,#1a1630)', borderLeft: '3px solid var(--bd,#f6f4ff)', boxShadow: '-9px 0 0 var(--hard)', display: 'flex', flexDirection: 'column', transform: alertOpen ? 'translateX(0)' : 'translateX(112%)', transition: 'transform .36s cubic-bezier(.16,1,.3,1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: 18, borderBottom: '2.5px solid var(--line)', background: 'var(--card2,#221c3c)' }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--lime)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: '2px 2px 0 var(--hard)', display: 'grid', placeItems: 'center', color: '#0b0a12' }}><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.5 21a1.8 1.8 0 0 1-3 0" /></svg></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--fd)', fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>Tourny Alert List</div>
            <div style={{ fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx2,#aaa3c6)', marginTop: 2 }}>New registrations for your games — straight to you.</div>
          </div>
          <button className="press" onClick={() => setAlertOpen(false)} style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 10, cursor: 'pointer', color: 'var(--tx,#f6f4ff)' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </div>
        <div className="rail" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* where alerts go */}
          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line)', borderRadius: 12, padding: '10px 13px', fontFamily: 'var(--fm)', fontSize: 11.5, color: 'var(--tx2,#aaa3c6)', lineHeight: 1.4 }}>
              <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: 'var(--lime)' }} />
              Synced to your account — alerts go to <b style={{ color: 'var(--tx,#f6f4ff)' }}>{user?.email}</b>
            </div>
          ) : (
            <div style={{ marginBottom: 14, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line)', borderRadius: 12, padding: '12px 13px' }}>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase', marginBottom: 8 }}>Email for alerts</div>
              {guestEmail && !emailDraft ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--fm)', fontSize: 12.5, fontWeight: 700, color: 'var(--lime)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guestEmail}</span>
                  <button className="press" onClick={() => setEmailDraft(guestEmail)} style={{ flexShrink: 0, fontFamily: 'var(--ff)', fontSize: 11.5, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: '2px solid var(--line2,#3a3460)', borderRadius: 9, padding: '5px 10px', cursor: 'pointer' }}>Change</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="email"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { saveGuestEmail(); setEmailDraft('') } }}
                    placeholder="you@email.com"
                    style={{ flex: 1, minWidth: 0, background: 'var(--card,#1a1630)', border: '2px solid var(--line2,#3a3460)', borderRadius: 10, padding: '8px 11px', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 13, outline: 'none' }}
                  />
                  <button className="press" onClick={() => { saveGuestEmail(); setEmailDraft('') }} style={{ flexShrink: 0, fontFamily: 'var(--fd)', fontSize: 12, fontWeight: 700, color: '#0b0a12', background: 'var(--lime)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, padding: '8px 13px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)' }}>Save</button>
                </div>
              )}
              {!guestEmail && <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--tx3,#736c92)', marginTop: 8, lineHeight: 1.45 }}>Needed so we can email you — or log in and it's automatic.</div>}
            </div>
          )}
          {tracked.length > 0 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--tx3,#736c92)', textTransform: 'uppercase' }}>Tracking {tracked.length} game{tracked.length === 1 ? '' : 's'}</span>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--tx3,#736c92)' }}>Alerts</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tracked.map((slug) => {
                  const g = { slug, name: gameName(slug), abbr: gameName(slug).split(/\s+/).map((w) => w[0]).join('').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || slug.slice(0, 3).toUpperCase(), accent: GAMES.find((x) => x.slug === slug)?.accent || accentFor(slug) }
                  const its = dataset.filter((t) => t.gameSlug === slug)
                  const on = alertsOn[slug] !== false
                  return (
                    <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card2,#221c3c)', border: '2px solid var(--line2,#3a3460)', borderRadius: 14, padding: '11px 13px' }}>
                      <span style={{ position: 'relative', width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)', boxShadow: `2px 2px 0 ${g.accent}`, display: 'grid', placeItems: 'center', overflow: 'hidden', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 12, color: 'var(--tx,#f6f4ff)' }}>
                        {covers[slug] ? <img src={covers[slug]} alt={g.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : g.abbr}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                        <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx2,#aaa3c6)', marginTop: 2 }}>{its.length} open · {its.filter((t) => t.dlH > 0 && t.dlH < 48).length} closing soon</div>
                      </div>
                      <button onClick={() => toggleAlertOn(slug)} title="Toggle alerts" style={{ position: 'relative', width: 46, height: 26, flexShrink: 0, border: '2px solid var(--bd,#f6f4ff)', borderRadius: 100, cursor: 'pointer', padding: 0, background: on ? 'var(--lime)' : 'var(--line2,#3a3460)' }}><span style={{ position: 'absolute', top: 1.5, left: 1.5, width: 19, height: 19, borderRadius: '50%', background: 'var(--bd,#f6f4ff)', transform: `translateX(${on ? '20px' : '0px'})`, transition: 'transform .25s var(--ease)' }} /></button>
                      <button className="press" onClick={() => removeTracked(slug)} title="Remove" style={{ width: 30, height: 30, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 9, cursor: 'pointer', color: 'var(--tx3,#736c92)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 16, background: 'var(--bg,#0b0a12)', border: '2px solid var(--line)', borderRadius: 12, padding: '12px 13px', fontSize: 12, color: 'var(--tx2,#aaa3c6)', lineHeight: 1.5 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.3" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>We watch start.gg, FACEIT, Battlefy &amp; Discord and ping you the moment a new bracket opens for a tracked game.</div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px 18px' }}>
              <span style={{ display: 'inline-grid', placeItems: 'center', width: 64, height: 64, borderRadius: 18, background: 'var(--card2,#221c3c)', border: '2.5px solid var(--line2,#3a3460)', color: 'var(--tx3,#736c92)', marginBottom: 16 }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.5 21a1.8 1.8 0 0 1-3 0" /></svg></span>
              <div style={{ fontFamily: 'var(--fd)', fontSize: 17, fontWeight: 800, letterSpacing: '-.01em' }}>No games tracked yet</div>
              <div style={{ fontSize: 13, color: 'var(--tx2,#aaa3c6)', marginTop: 8, lineHeight: 1.5, maxWidth: '30ch', marginLeft: 'auto', marginRight: 'auto' }}>Tap the <b style={{ color: 'var(--tx)' }}>bell</b> on any game or tournament card to add it here and get alerted on new registrations.</div>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

const chipMeta: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 600, color: 'var(--tx2,#aaa3c6)', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 8, padding: '4px 9px' }
