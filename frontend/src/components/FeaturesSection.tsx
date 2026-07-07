import { useScrollReveal } from '../hooks/useScrollReveal';

const FEATURES = [
  {
    icon: 'trending_down',
    title: 'Live deal aggregator',
    desc: 'Real prices pulled straight from Steam, Epic, Xbox & Ubisoft — refreshed every 5 minutes.',
  },
  {
    icon: 'redeem',
    title: 'Free game alerts',
    desc: 'Every giveaway across every major store, the moment it goes live.',
  },
  {
    icon: 'notifications_active',
    title: 'Price drop alerts',
    desc: 'Set a target price on any game and get an email when a store hits it.',
  },
  {
    icon: 'devices',
    title: 'PC compatibility',
    desc: 'Enter your specs for an instant compatibility score and estimated FPS.',
  },
  {
    icon: 'emoji_events',
    title: 'Tournament radar',
    desc: 'Live and upcoming esports events with reminders and prize details.',
  },
  {
    icon: 'open_in_new',
    title: 'Direct store links',
    desc: 'Always the official page. No middlemen, no redirects, no affiliate tags.',
  },
];

export default function FeaturesSection() {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  return (
    <section
      id="features"
      className="border-t border-border bg-surface px-[clamp(1rem,5vw,6rem)] pt-[100px] pb-12 transition-[background] duration-[var(--transition-theme)]"
    >
      <div ref={headerRef} className="reveal max-w-[600px]">
        <div className="mb-3 inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-cyan">
          <span className="h-0.5 w-6 rounded-sm bg-cyan" />
          Why PlayWise
        </div>
        <h2 className="mb-4 text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-tight tracking-tight">
          Everything gamers need.<br />
          <span className="text-cyan">Nothing they don't.</span>
        </h2>
        <p className="text-[1.05rem] text-muted">
          Six stores, one tab. Direct connections, zero middlemen.
        </p>
      </div>

      {/* Hairline divider grid — borderless cells separated by 1px lines */}
      <div
        ref={gridRef}
        className="reveal mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3"
        style={{ transitionDelay: '0.15s' }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group relative bg-surface p-8 transition-colors duration-300 hover:bg-panel"
          >
            {/* Accent line slides in on hover */}
            <span className="absolute inset-x-0 top-0 h-px scale-x-0 bg-cyan transition-transform duration-300 group-hover:scale-x-100" />
            <span
              className="material-symbols-outlined mb-4 block text-cyan transition-transform duration-300 group-hover:-translate-y-0.5"
              style={{ fontSize: '26px' }}
            >
              {f.icon}
            </span>
            <h3 className="mb-1.5 text-[1.05rem] font-bold tracking-tight">{f.title}</h3>
            <p className="text-[0.88rem] leading-relaxed text-muted">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
