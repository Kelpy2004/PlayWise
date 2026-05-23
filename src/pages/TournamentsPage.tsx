import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'

import { api } from '../lib/api'
import type { TournamentRecord } from '../types/api'
import Seo from '../components/Seo'

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function statusBadgeClass(status: TournamentRecord['status']) {
  if (status === 'LIVE_NOW') return 'bg-[#ff7351]/15 text-[#ff7351] border border-[#ff7351]/30 shadow-[0_0_12px_rgba(255,115,81,0.15)]'
  if (status === 'UPCOMING') return 'bg-cyan/15 text-cyan border border-cyan/30'
  return 'bg-white/8 text-white/60 border border-white/10'
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

export default function TournamentsPage() {
  const [searchParams] = useSearchParams()
  const selectedGameSlug = searchParams.get('game')?.trim() || ''
  const [events, setEvents] = useState<TournamentRecord[]>([])
  const [status, setStatus] = useState({ loading: true, message: '' })
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming' | 'ended'>('all')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const seoTitle = selectedGameSlug
    ? `Tournaments for ${selectedGameSlug} | PlayWise`
    : 'Tournaments | PlayWise'
  const seoDescription = selectedGameSlug
    ? `Upcoming and live tournaments for ${selectedGameSlug} with registration links.`
    : 'Browse upcoming and live tournaments with PlayWise registration alerts.'
  const seoUrl = origin ? `${origin}/tournaments${window.location.search || ''}` : undefined

  useEffect(() => {
    let ignore = false

    async function loadEvents() {
      setStatus({ loading: true, message: '' })
      try {
        const response = await api.fetchTournaments({
          game: selectedGameSlug || undefined,
          limit: 120
        })
        if (!ignore) {
          setEvents(Array.isArray(response) ? response : [])
          setStatus({ loading: false, message: '' })
        }
      } catch (error) {
        if (!ignore) {
          setStatus({
            loading: false,
            message: error instanceof Error ? error.message : 'Could not load tournaments right now.'
          })
        }
      }
    }

    void loadEvents()
    return () => {
      ignore = true
    }
  }, [selectedGameSlug])

  const filteredEvents = events.filter((entry) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'live') return entry.status === 'LIVE_NOW'
    if (activeFilter === 'upcoming') return entry.status === 'UPCOMING'
    return entry.status === 'ENDED'
  })

  const liveCount = events.filter((e) => e.status === 'LIVE_NOW').length
  const upcomingCount = events.filter((e) => e.status === 'UPCOMING').length

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} url={seoUrl} />
      <section className="mx-auto w-full max-w-[1320px] px-4 py-12 text-white">
        <div className="mb-8 rounded-2xl border border-white/10 bg-[#111]/80 p-6">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan">Tournament Center</p>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">All PlayWise Events</h1>
              <p className="mt-2 text-sm text-white/70">
                {selectedGameSlug
                  ? `Showing tournaments for ${selectedGameSlug}.`
                  : 'Browse all scheduled and live tournaments.'}
              </p>
            </div>
            <div className="flex gap-2">
              {liveCount > 0 && (
                <span className="rounded-full bg-[#ff7351]/15 px-3 py-1 text-xs font-bold text-[#ff7351] border border-[#ff7351]/30">
                  {liveCount} Live
                </span>
              )}
              {upcomingCount > 0 && (
                <span className="rounded-full bg-cyan/15 px-3 py-1 text-xs font-bold text-cyan border border-cyan/30">
                  {upcomingCount} Upcoming
                </span>
              )}
            </div>
          </div>
        </div>

      <div className="mb-6 flex gap-2">
        {(['all', 'live', 'upcoming', 'ended'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] transition-all ${
              activeFilter === f
                ? 'bg-cyan text-white'
                : 'border border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {status.message ? (
        <div className="mb-6 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {status.message}
        </div>
      ) : null}

      {status.loading ? <p className="text-sm text-white/60">Loading tournaments...</p> : null}

      {!status.loading && !events.length ? (
        <div className="rounded-xl border border-white/10 bg-[#121212] p-5 text-sm text-white/70">
          No tournaments found.
        </div>
      ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {filteredEvents.map((entry) => (
            <article key={entry.id || entry.slug} className="rounded-xl border border-white/10 bg-[#121212] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{entry.title}</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(entry.status)}`}>
                {entry.status.replace('_', ' ')}
              </span>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm text-white/70">Game: {entry.gameSlug || 'General'}</p>
              {typeof entry.metadata?.provider === 'string' && (
                <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                  entry.metadata.provider === 'faceit' ? 'bg-[#ff5500]/15 text-[#ff5500] border border-[#ff5500]/30'
                  : entry.metadata.provider === 'battlefy' ? 'bg-[#00b4d8]/15 text-[#00b4d8] border border-[#00b4d8]/30'
                  : 'bg-cyan/15 text-cyan border border-cyan/30'
                }`}>
                  {entry.metadata.provider === 'startgg' ? 'start.gg' : entry.metadata.provider}
                </span>
              )}
            </div>
            <p className="text-xs text-white/60">Starts: {formatDateTime(entry.startsAt)}</p>
            {entry.endsAt ? <p className="text-xs text-white/60">Ends: {formatDateTime(entry.endsAt)}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {entry.gameSlug ? (
                <Link
                  to={`/games/${entry.gameSlug}`}
                  className="inline-flex rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
                >
                  Open game details
                </Link>
              ) : null}
              {typeof entry.metadata?.registrationUrl === 'string' && entry.metadata.registrationUrl ? (
                <a
                  href={entry.metadata.registrationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg bg-cyan px-3 py-2 text-xs font-black text-white"
                >
                  Register now
                </a>
              ) : null}
            </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
