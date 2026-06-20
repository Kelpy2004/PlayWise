import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'

import { api } from '../lib/api'
import type { TournamentRecord, TournamentSubscriptionRecord } from '../types/api'
import { useAuth } from '../context/AuthContext'
import Seo from '../components/Seo'
import {
  formatGameLabel,
  PROVIDERS,
  providerMeta,
  resolveExternalUrl,
  extractPrize,
  extractParticipants,
  extractRegion,
} from '../lib/tournaments'

/* ── helpers ── */

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusBadgeClass(status: TournamentRecord['status']) {
  if (status === 'LIVE_NOW')
    return 'bg-[var(--magenta)]/15 text-[var(--magenta)] border border-[var(--magenta)]/30 shadow-[0_0_12px_rgba(255,115,81,0.15)]'
  if (status === 'UPCOMING') return 'bg-cyan/15 text-cyan border border-cyan/30'
  return 'bg-white/8 text-muted border border-border'
}

function gameAccent(slug: string) {
  const CAT: Record<string, string> = {
    'counter-strike-2': 'var(--amber)',
    valorant: 'var(--magenta)',
    'dota-2': 'var(--magenta)',
    'league-of-legends': 'var(--amber)',
    overwatch: 'var(--amber)',
    'rocket-league': 'var(--cyan)',
    'street-fighter-6': 'var(--magenta)',
    'tekken-8': 'var(--cyan)',
    'super-smash-bros-ultimate': 'var(--magenta)',
    'super-smash-bros-melee': 'var(--magenta)',
    'guilty-gear-strive': 'var(--magenta)',
    'mortal-kombat-1': 'var(--amber)',
  }
  return CAT[slug] || 'var(--cyan)'
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

/* ── tournament card ── */

function TournamentCard({ entry, showProvider = true }: { entry: TournamentRecord; showProvider?: boolean }) {
  const externalUrl = resolveExternalUrl(entry)
  const provider = typeof entry.metadata?.provider === 'string' ? entry.metadata.provider : ''
  const pm = providerMeta(provider)
  const prize = extractPrize(entry.metadata)
  const participants = extractParticipants(entry.metadata)
  const region = extractRegion(entry.metadata)
  const isLive = entry.status === 'LIVE_NOW'

  return (
    <motion.article
      variants={fadeUp}
      className="rounded-[var(--radius)] border border-border bg-panel p-5 transition-all hover:border-cyan/20 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)]"
    >
      {/* Status + provider row */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(entry.status)}`}
        >
          {isLive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--magenta)] animate-pulse" />}
          {entry.status.replace('_', ' ')}
        </span>
        {showProvider && provider && (
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white/[0.06] text-muted border border-border"
          >
            {pm.label}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-[1.05rem] font-bold leading-tight line-clamp-2 mb-1.5">{entry.title}</h3>

      {/* Game + region */}
      <p className="text-[0.78rem] text-muted mb-3">
        {entry.gameSlug && formatGameLabel(entry.gameSlug)}
        {region && <> &middot; {region}</>}
      </p>

      {/* Prize / participants row */}
      {(prize || participants) && (
        <div className="flex gap-5 mb-3">
          {prize && (
            <div>
              <span className="font-mono font-extrabold text-[1rem] text-amber">{prize}</span>
              <span className="block text-[0.62rem] text-muted uppercase tracking-[0.1em] font-semibold">Prize</span>
            </div>
          )}
          {participants && (
            <div>
              <span className="font-mono font-extrabold text-[1rem] text-cyan">{participants}</span>
              <span className="block text-[0.62rem] text-muted uppercase tracking-[0.1em] font-semibold">Players</span>
            </div>
          )}
        </div>
      )}

      {/* Dates */}
      <p className="text-xs text-muted">Starts: {formatDateTime(entry.startsAt)}</p>
      {entry.endsAt && <p className="text-xs text-muted">Ends: {formatDateTime(entry.endsAt)}</p>}

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {entry.gameSlug && (
          <Link
            to={`/games/${entry.gameSlug}`}
            className="inline-flex rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-xs font-bold text-[var(--text)] hover:bg-white/[0.08] transition-colors"
          >
            Game details
          </Link>
        )}
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-black text-white transition-colors bg-cyan hover:bg-cyan/80"
        >
          {isLive ? 'Watch Live' : 'View event'} <span className="text-[10px]">↗</span>
        </a>
      </div>
    </motion.article>
  )
}

/* ── provider section ── */

function ProviderSection({
  provider,
  tournaments,
}: {
  provider: (typeof PROVIDERS)[number]
  tournaments: TournamentRecord[]
}) {
  if (!tournaments.length) return null
  const liveCount = tournaments.filter((t) => t.status === 'LIVE_NOW').length
  const upcomingCount = tournaments.filter((t) => t.status === 'UPCOMING').length

  return (
    <section id={`provider-${provider.key}`} className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: provider.color }}
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>
            {provider.icon}
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-black">{provider.label}</h2>
        </div>
        <div className="flex gap-2">
          {liveCount > 0 && (
            <span className="rounded-full bg-[var(--magenta)]/15 border border-[var(--magenta)]/30 px-2.5 py-0.5 text-[10px] font-black uppercase text-[var(--magenta)]">
              {liveCount} live
            </span>
          )}
          {upcomingCount > 0 && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
              style={{
                backgroundColor: `${provider.accent}20`,
                color: provider.accent,
                border: `1px solid ${provider.accent}40`,
              }}
            >
              {upcomingCount} upcoming
            </span>
          )}
        </div>
      </div>

      <div
        className="mb-4 h-px w-full"
        style={{ background: `linear-gradient(to right, ${provider.accent}60, transparent)` }}
      />

      <motion.div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
      >
        {tournaments.map((entry) => (
          <TournamentCard key={entry.id || entry.slug} entry={entry} showProvider={false} />
        ))}
      </motion.div>
    </section>
  )
}

/* ── search bar ── */

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative">
      <span
        className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        style={{ fontSize: '18px' }}
      >
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-white/[0.04] py-2.5 pl-10 pr-9 text-sm text-[var(--text)] placeholder:text-muted focus:border-cyan/50 focus:bg-white/[0.06] focus:outline-none transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-[var(--text)] transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            close
          </span>
        </button>
      )}
    </div>
  )
}

/* ── subscribe button ── */

function SubscribeButton({
  gameSlug,
  subs,
  onToggle,
  busy,
  loggedIn,
}: {
  gameSlug: string
  subs: TournamentSubscriptionRecord[]
  onToggle: (gameSlug: string) => void
  busy: boolean
  loggedIn: boolean
}) {
  const activeSub = subs.find(
    (s) => s.isActive && ((s.scope === 'GAME' && s.gameSlug === gameSlug) || s.scope === 'ALL'),
  )
  const isSubscribed = !!activeSub

  if (!loggedIn) {
    return (
      <Link
        to="/auth?returnTo=/tournaments"
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white/[0.04] px-4 py-2 text-xs font-bold text-muted hover:text-[var(--text)] hover:border-cyan/30 transition-all"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          notifications
        </span>
        Sign in to subscribe
      </Link>
    )
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onToggle(gameSlug)}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
        isSubscribed
          ? 'border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan/25'
          : 'border-border bg-white/[0.04] text-muted hover:text-[var(--text)] hover:border-cyan/30'
      }`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
        {isSubscribed ? 'notifications_active' : 'notification_add'}
      </span>
      {busy ? 'Saving...' : isSubscribed ? 'Subscribed' : 'Get alerts'}
    </button>
  )
}

/* ── main page ── */

export default function TournamentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedGame = searchParams.get('game')?.trim() || ''
  const { token, user } = useAuth()
  const [events, setEvents] = useState<TournamentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [subs, setSubs] = useState<TournamentSubscriptionRecord[]>([])
  const [subBusy, setSubBusy] = useState(false)

  const seoTitle = selectedGame
    ? `${formatGameLabel(selectedGame)} Tournaments | PlayWise`
    : 'Tournaments | PlayWise'
  const seoDescription = selectedGame
    ? `Live and upcoming ${formatGameLabel(selectedGame)} tournaments with registration links.`
    : 'Browse esports tournaments across every competitive title — Valorant, CS2, Dota 2, League of Legends, and more.'

  useEffect(() => {
    let ignore = false
    async function loadEvents() {
      setLoading(true)
      setError('')
      try {
        const response = await api.fetchTournaments({
          game: selectedGame || undefined,
          limit: selectedGame ? 120 : 200,
        })
        if (!ignore) {
          setEvents(Array.isArray(response) ? response : [])
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Could not load tournaments right now.')
        }
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void loadEvents()
    return () => {
      ignore = true
    }
  }, [selectedGame])

  useEffect(() => {
    setActiveFilter('all')
    setSearchQuery('')
  }, [selectedGame])

  useEffect(() => {
    if (!token) { setSubs([]); return }
    api.fetchTournamentSubscriptions(token).then(setSubs).catch(() => {})
  }, [token])

  const toggleSubscription = useCallback(
    async (gameSlug: string) => {
      if (!token) return
      setSubBusy(true)
      try {
        const existing = subs.find(
          (s) => s.isActive && s.scope === 'GAME' && s.gameSlug === gameSlug,
        )
        if (existing) {
          await api.updateTournamentSubscription(existing.id, { isActive: false }, token)
          setSubs((prev) => prev.map((s) => (s.id === existing.id ? { ...s, isActive: false } : s)))
        } else {
          const created = await api.createTournamentSubscription(
            { scope: 'GAME', gameSlug },
            token,
          )
          setSubs((prev) => [...prev, created])
        }
      } catch {
        // silently fail — button state stays unchanged
      } finally {
        setSubBusy(false)
      }
    },
    [token, subs],
  )

  /* ── overview: game chips ── */
  const gameGroups = useMemo(() => {
    if (selectedGame) return []
    const q = searchQuery.toLowerCase().trim()
    const groups: Record<string, { total: number; live: number }> = {}
    for (const e of events) {
      const key = e.gameSlug || 'other'
      const label = formatGameLabel(key).toLowerCase()
      if (q && !label.includes(q) && !e.title.toLowerCase().includes(q)) continue
      if (!groups[key]) groups[key] = { total: 0, live: 0 }
      groups[key].total++
      if (e.status === 'LIVE_NOW') groups[key].live++
    }
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total)
  }, [events, selectedGame, searchQuery])

  /* ── game view: filtered + grouped by provider ── */
  const filteredEvents = useMemo(() => {
    if (!selectedGame) return []
    const q = searchQuery.toLowerCase().trim()
    return events.filter((e) => {
      if (activeFilter === 'live' && e.status !== 'LIVE_NOW') return false
      if (activeFilter === 'upcoming' && e.status !== 'UPCOMING') return false
      if (activeFilter === 'ended' && e.status !== 'ENDED') return false
      if (q && !e.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [events, selectedGame, activeFilter, searchQuery])

  const providerGroups = useMemo(() => {
    if (!selectedGame) return []
    const grouped = new Map<string, TournamentRecord[]>()
    for (const t of filteredEvents) {
      const key = typeof t.metadata?.provider === 'string' ? t.metadata.provider : 'unknown'
      const arr = grouped.get(key) || []
      arr.push(t)
      grouped.set(key, arr)
    }
    return PROVIDERS.filter((p) => grouped.has(p.key)).map((p) => ({
      ...p,
      tournaments: grouped.get(p.key)!,
    }))
  }, [filteredEvents, selectedGame])

  const totalLive = events.filter((e) => e.status === 'LIVE_NOW').length
  const totalUpcoming = events.filter((e) => e.status === 'UPCOMING').length

  function selectGame(slug: string) {
    setSearchParams(slug ? { game: slug } : {})
  }

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} />
      <section className="mx-auto w-full max-w-[1320px] px-4 py-12 text-[var(--text)]">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-border bg-panel p-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan">
            Tournament Center
          </p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              {selectedGame ? (
                <>
                  <button
                    type="button"
                    onClick={() => selectGame('')}
                    className="mb-2 flex items-center gap-1 text-xs font-bold text-cyan hover:underline"
                  >
                    <span className="text-sm">←</span> All Games
                  </button>
                  <h1 className="text-3xl font-black">{formatGameLabel(selectedGame)} Tournaments</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-muted">
                      {events.length} events from{' '}
                      {new Set(events.map((e) => e.metadata?.provider).filter(Boolean)).size} providers
                    </p>
                    <SubscribeButton
                      gameSlug={selectedGame}
                      subs={subs}
                      onToggle={toggleSubscription}
                      busy={subBusy}
                      loggedIn={!!user}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-3xl font-black">Pick your game</h1>
                  <p className="mt-2 text-sm text-muted">
                    Select a title to see all live and upcoming tournaments.
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {totalLive > 0 && (
                <span className="rounded-full bg-[var(--magenta)]/15 px-3 py-1 text-xs font-bold text-[var(--magenta)] border border-[var(--magenta)]/30">
                  {totalLive} Live
                </span>
              )}
              {totalUpcoming > 0 && (
                <span className="rounded-full bg-cyan/15 px-3 py-1 text-xs font-bold text-cyan border border-cyan/30">
                  {totalUpcoming} Upcoming
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            <p className="text-sm text-muted">Loading tournaments...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !events.length && !error && (
          <div className="rounded-xl border border-border bg-panel p-8 text-center">
            <p className="text-lg font-bold text-muted mb-2">No tournaments found</p>
            <p className="text-sm text-muted/60">The tournament scanner is warming up. Check back in a minute.</p>
          </div>
        )}

        {/* ═══ OVERVIEW: chips-only game picker ═══ */}
        {!loading && events.length > 0 && !selectedGame && (
          <>
            <div className="mb-6 max-w-md">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search games or tournaments..."
              />
            </div>

            {searchQuery && (
              <p className="mb-4 text-sm text-muted">
                {gameGroups.length} game{gameGroups.length !== 1 ? 's' : ''} matching "{searchQuery}"
              </p>
            )}

            {gameGroups.length > 0 ? (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {gameGroups.map(([slug, { total, live }]) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => selectGame(slug)}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-panel px-4 py-3 text-left transition-all hover:border-cyan/25 hover:bg-white/[0.06] hover:-translate-y-[1px]"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-black uppercase"
                      style={{ background: gameAccent(slug), color: 'white', opacity: 0.85 }}
                    >
                      {formatGameLabel(slug).slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold group-hover:text-cyan transition-colors">
                        {formatGameLabel(slug)}
                      </p>
                      <p className="text-[11px] text-muted">
                        {total} event{total !== 1 ? 's' : ''}
                        {live > 0 && (
                          <span className="ml-1 text-[var(--magenta)]">· {live} live</span>
                        )}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="rounded-xl border border-border bg-panel p-8 text-center">
                <p className="text-lg font-bold text-muted mb-2">No games match "{searchQuery}"</p>
                <p className="text-sm text-muted/60">Try a different keyword or clear the search.</p>
              </div>
            ) : null}
          </>
        )}

        {/* ═══ GAME VIEW: search + filters + provider sections ═══ */}
        {!loading && selectedGame && events.length > 0 && (
          <>
            <div className="mb-6 space-y-4">
              <div className="max-w-md">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={`Search ${formatGameLabel(selectedGame)} tournaments...`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(['all', 'live', 'upcoming', 'ended'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setActiveFilter(f)}
                      className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-all ${
                        activeFilter === f
                          ? 'bg-cyan text-white'
                          : 'border border-border bg-white/[0.04] text-muted hover:text-[var(--text)]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {providerGroups.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1">
                      Jump to
                    </span>
                    {providerGroups.map((pg) => (
                      <button
                        key={pg.key}
                        type="button"
                        onClick={() =>
                          document
                            .getElementById(`provider-${pg.key}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-white/80 transition-all hover:text-white"
                        style={{
                          backgroundColor: `${pg.color}80`,
                          border: `1px solid ${pg.accent}30`,
                        }}
                      >
                        {pg.label}
                        <span className="ml-1 text-white/50">{pg.tournaments.length}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {providerGroups.length > 0 ? (
              providerGroups.map((pg) => (
                <ProviderSection key={pg.key} provider={pg} tournaments={pg.tournaments} />
              ))
            ) : (
              <div className="rounded-xl border border-border bg-panel p-8 text-center">
                <p className="text-lg font-bold text-muted mb-2">
                  No {activeFilter === 'all' ? '' : activeFilter + ' '}tournaments
                  {searchQuery ? ` matching "${searchQuery}"` : ' found'}
                </p>
                <p className="text-sm text-muted/60">
                  {searchQuery
                    ? 'Try a different keyword or clear the search.'
                    : 'Try switching the filter to "All".'}
                </p>
              </div>
            )}

            {filteredEvents.length > 0 && (
              <p className="mt-4 text-center text-[11px] text-muted/50">
                Tournament data aggregated from start.gg, FACEIT, and PandaScore APIs.
              </p>
            )}
          </>
        )}
      </section>
    </>
  )
}
