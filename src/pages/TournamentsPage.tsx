import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

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
  if (status === 'LIVE_NOW') return 'bg-red-500/20 text-red-300 border border-red-400/30'
  if (status === 'UPCOMING') return 'bg-[#b1fa50]/20 text-[#b1fa50] border border-[#b1fa50]/30'
  return 'bg-white/10 text-white/60 border border-white/10'
}

export default function TournamentsPage() {
  const [searchParams] = useSearchParams()
  const selectedGameSlug = searchParams.get('game')?.trim() || ''
  const [events, setEvents] = useState<TournamentRecord[]>([])
  const [status, setStatus] = useState({ loading: true, message: '' })
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

  return (
    <>
      <Seo title={seoTitle} description={seoDescription} url={seoUrl} />
      <section className="mx-auto w-full max-w-[1320px] px-4 py-12 text-white">
        <div className="mb-8 rounded-2xl border border-white/10 bg-[#111]/80 p-6">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#b1fa50]">Tournament Center</p>
        <h1 className="text-3xl font-black">All PlayWise Events</h1>
        <p className="mt-2 text-sm text-white/70">
          {selectedGameSlug
            ? `Showing tournaments for ${selectedGameSlug}.`
            : 'Browse all scheduled and live tournaments.'}
        </p>
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
          {events.map((entry) => (
            <article key={entry.id || entry.slug} className="rounded-xl border border-white/10 bg-[#121212] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{entry.title}</h2>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(entry.status)}`}>
                {entry.status.replace('_', ' ')}
              </span>
            </div>
            <p className="mb-2 text-sm text-white/70">Game: {entry.gameSlug || 'General'}</p>
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
                  className="inline-flex rounded-lg bg-[#b1fa50] px-3 py-2 text-xs font-black text-[#0a1400]"
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
