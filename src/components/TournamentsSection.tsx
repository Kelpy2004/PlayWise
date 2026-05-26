import { useScrollReveal } from '../hooks/useScrollReveal';
import { useTilt3D } from '../hooks/useTilt3D';

const TOURNAMENTS = [
  { status: 'live', title: 'Valorant Champions 2026', game: 'Valorant', location: 'Seoul', prize: '$2M', teams: '16', cta: 'Watch Live' },
  { status: 'upcoming', title: 'The International 2026', game: 'Dota 2', location: 'Copenhagen', prize: '$18M+', teams: '18', cta: 'Set Reminder' },
  { status: 'live', title: 'BLAST Premier Spring 2026', game: 'CS2', location: 'London', prize: '$500K', teams: '12', cta: 'Watch Live' },
];

function TournamentCard({ tournament }) {
  const tilt = useTilt3D(10);

  return (
    <div
      {...tilt}
      className="tournament-card rounded-[var(--radius)] border border-border bg-panel p-6 transition-all duration-[350ms] relative overflow-hidden hover:border-cyan/[0.15] hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(0,0,0,0.2)]"
    >
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.68rem] font-extrabold uppercase tracking-[0.08em] mb-4 ${
        tournament.status === 'live'
          ? 'bg-magenta/[0.15] text-magenta border border-magenta/25'
          : 'bg-cyan-dim text-cyan border border-cyan/20'
      }`}>
        {tournament.status === 'live' && (
          <span className="w-1.5 h-1.5 bg-magenta rounded-full animate-pulse-dot" />
        )}
        {tournament.status === 'live' ? 'Live Now' : 'Upcoming'}
      </div>

      <h3 className="text-[1.15rem] font-bold mb-1.5">{tournament.title}</h3>
      <div className="text-[0.78rem] text-muted mb-4">{tournament.game} &middot; {tournament.location}</div>

      <div className="flex gap-6">
        <div className="flex flex-col">
          <span className="font-mono font-extrabold text-[1.1rem] text-amber">{tournament.prize}</span>
          <span className="text-[0.68rem] text-muted uppercase tracking-[0.1em] font-semibold">Prize Pool</span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono font-extrabold text-[1.1rem] text-cyan">{tournament.teams}</span>
          <span className="text-[0.68rem] text-muted uppercase tracking-[0.1em] font-semibold">Teams</span>
        </div>
      </div>

      <button className="mt-4 w-full py-[10px] px-5 rounded-sm bg-white/[0.03] border border-border text-[var(--text)] font-semibold text-[0.82rem] cursor-pointer text-center transition-all duration-300 hover:bg-cyan hover:text-white hover:border-cyan">
        {tournament.cta}
      </button>
    </div>
  );
}

export default function TournamentsSection() {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  return (
    <section id="tournaments" className="py-[100px] px-[clamp(1rem,5vw,6rem)] bg-deep transition-[background] duration-[var(--transition-theme)]">
      <div ref={headerRef} className="reveal">
        <div className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-cyan mb-3">
          <span className="w-6 h-0.5 bg-cyan rounded-sm" />
          Esports & Events
        </div>
        <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-tight mb-4">
          Never miss a <span className="text-magenta">tournament</span>
        </h2>
        <p className="text-muted text-[1.05rem] max-w-[520px]">Live and upcoming events across every competitive title.</p>
      </div>

      <div ref={gridRef} className="reveal grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-10" style={{ transitionDelay: '0.15s' }}>
        {TOURNAMENTS.map((t, i) => (
          <TournamentCard key={i} tournament={t} />
        ))}
      </div>
    </section>
  );
}
