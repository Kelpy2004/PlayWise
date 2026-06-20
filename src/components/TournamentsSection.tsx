import { useNavigate } from 'react-router-dom';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useTilt3D } from '../hooks/useTilt3D';
import type { TournamentRecord } from '../types/api';
import {
  formatGameLabel,
  providerMeta,
  resolveExternalUrl,
  extractPrize,
  extractParticipants,
  extractRegion,
} from '../lib/tournaments';

function TournamentCard({ tournament }: { tournament: TournamentRecord }) {
  const tilt = useTilt3D(10);
  const isLive = tournament.status === 'LIVE_NOW';
  const prize = extractPrize(tournament.metadata);
  const participants = extractParticipants(tournament.metadata);
  const region = extractRegion(tournament.metadata);
  const externalUrl = resolveExternalUrl(tournament);
  const provider = tournament.metadata?.provider;
  const pm = typeof provider === 'string' ? providerMeta(provider) : null;

  return (
    <div
      {...tilt}
      className="tournament-card rounded-[var(--radius)] border border-border bg-panel p-6 transition-all duration-[350ms] relative overflow-hidden hover:border-cyan/[0.15] hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.2)]"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.68rem] font-extrabold uppercase tracking-[0.08em] ${
          isLive
            ? 'bg-magenta/[0.15] text-magenta border border-magenta/25'
            : 'bg-cyan-dim text-cyan border border-cyan/20'
        }`}>
          {isLive && (
            <span className="w-1.5 h-1.5 bg-magenta rounded-full animate-pulse-dot" />
          )}
          {isLive ? 'Live Now' : 'Upcoming'}
        </div>
        {pm && (
          <span className="px-2 py-0.5 rounded text-[0.6rem] font-bold uppercase tracking-wider bg-white/[0.06] text-muted border border-border">
            {pm.label}
          </span>
        )}
      </div>

      <h3 className="text-[1.15rem] font-bold mb-1.5 line-clamp-2">{tournament.title}</h3>
      <div className="text-[0.78rem] text-muted mb-4">
        {formatGameLabel(tournament.gameSlug || '')}
        {region && <> &middot; {region}</>}
      </div>

      {(prize || participants) && (
        <div className="flex gap-6">
          {prize && (
            <div className="flex flex-col">
              <span className="font-mono font-extrabold text-[1.1rem] text-amber">{prize}</span>
              <span className="text-[0.68rem] text-muted uppercase tracking-[0.1em] font-semibold">Prize Pool</span>
            </div>
          )}
          {participants && (
            <div className="flex flex-col">
              <span className="font-mono font-extrabold text-[1.1rem] text-cyan">{participants}</span>
              <span className="text-[0.68rem] text-muted uppercase tracking-[0.1em] font-semibold">Players</span>
            </div>
          )}
        </div>
      )}

      <a
        href={externalUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 block w-full py-[10px] px-5 rounded-sm bg-white/[0.03] border border-border text-[var(--text)] font-semibold text-[0.82rem] cursor-pointer text-center transition-all duration-300 hover:bg-cyan hover:text-white hover:border-cyan no-underline"
      >
        {isLive ? 'Watch Live' : 'View Event'}
      </a>
    </div>
  );
}

interface TournamentsSectionProps {
  tournaments?: TournamentRecord[];
}

export default function TournamentsSection({ tournaments = [] }: TournamentsSectionProps) {
  const navigate = useNavigate();
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  const active = tournaments.filter((t) => t.status === 'LIVE_NOW' || t.status === 'UPCOMING');
  const display = active.slice(0, 6);

  if (!display.length) return null;

  return (
    <section id="tournaments" className="py-[100px] px-[clamp(1rem,5vw,6rem)] bg-deep transition-[background] duration-[var(--transition-theme)]">
      <div ref={headerRef} className="reveal flex justify-between items-end">
        <div>
          <div className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-cyan mb-3">
            <span className="w-6 h-0.5 bg-cyan rounded-sm" />
            Esports & Events
          </div>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-tight mb-4">
            Never miss a <span className="text-magenta">tournament</span>
          </h2>
          <p className="text-muted text-[1.05rem] max-w-[520px]">Live and upcoming events across every competitive title.</p>
        </div>
        <button
          onClick={() => navigate('/tournaments')}
          className="px-[22px] py-[10px] rounded-full bg-cyan text-white font-bold text-[0.85rem] border-none cursor-pointer whitespace-nowrap shadow-[0_0_24px_rgba(0,212,255,0.25)] hover:shadow-[0_0_40px_rgba(0,212,255,0.4)] hover:-translate-y-px transition-all duration-300"
        >
          View All Tournaments
        </button>
      </div>

      <div ref={gridRef} className="reveal grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-10" style={{ transitionDelay: '0.15s' }}>
        {display.map((t) => (
          <TournamentCard key={t.id || t.slug} tournament={t} />
        ))}
      </div>
    </section>
  );
}
