import { useScrollReveal } from '../hooks/useScrollReveal';
import { useTilt3D } from '../hooks/useTilt3D';

const FEATURES = [
  { icon: 'trending_down', title: 'Live Price Intelligence', desc: 'Real-time price comparison across Steam, Epic, GOG, Humble, Green Man Gaming, and 40+ stores.', span: 'col-span-12 lg:col-span-7 row-span-2', iconBg: 'bg-cyan-dim', iconColor: 'text-cyan' },
  { icon: 'emoji_events', title: 'Tournament Radar', desc: 'Every esports event, community tournament, and ranked season in one feed.', span: 'col-span-12 lg:col-span-5', iconBg: 'bg-amber-dim', iconColor: 'text-amber' },
  { icon: 'devices', title: 'Can It Run?', desc: 'Enter your PC specs once. We auto-check compatibility, estimate FPS, and show recommended settings.', span: 'col-span-12 lg:col-span-5', iconBg: 'bg-magenta/[0.12]', iconColor: 'text-magenta' },
  { icon: 'forum', title: 'Community Pulse', desc: 'Aggregated reviews, sentiment analysis, and live player discussions.', span: 'col-span-12 lg:col-span-4', iconBg: 'bg-green/[0.12]', iconColor: 'text-green' },
  { icon: 'notifications_active', title: 'Price Drop Alerts', desc: 'Set a target price and get notified instantly when any store hits it.', span: 'col-span-12 lg:col-span-4', iconBg: 'bg-cyan-dim', iconColor: 'text-cyan' },
  { icon: 'speed', title: 'Instant Redirect', desc: 'One click takes you to the original platform to buy, register, or download.', span: 'col-span-12 lg:col-span-4', iconBg: 'bg-amber-dim', iconColor: 'text-amber' },
];

function BentoCard({ feature }) {
  const tilt = useTilt3D(10);

  return (
    <div
      {...tilt}
      className={`${feature.span} rounded-[var(--radius)] border border-border bg-panel p-8 relative overflow-hidden transition-all duration-400 hover:border-cyan/[0.15] hover:shadow-[0_12px_40px_rgba(0,0,0,0.2)] hover:-translate-y-[3px]`}
      style={{ transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1), background var(--transition-theme)' }}
    >
      <div className={`w-12 h-12 rounded-xl grid place-items-center mb-5 text-2xl ${feature.iconBg} ${feature.iconColor}`}>
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{feature.icon}</span>
      </div>
      <h3 className="text-[1.25rem] font-bold mb-2">{feature.title}</h3>
      <p className="text-muted text-[0.9rem] leading-relaxed">{feature.desc}</p>
    </div>
  );
}

export default function FeaturesSection() {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  return (
    <section id="features" className="py-[100px] px-[clamp(1rem,5vw,6rem)] bg-surface border-t border-border transition-[background] duration-[var(--transition-theme)]">
      <div ref={headerRef} className="reveal">
        <div className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-cyan mb-3">
          <span className="w-6 h-0.5 bg-cyan rounded-sm" />
          Why PlayWise
        </div>
        <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-tight mb-4">
          Everything gamers need.<br /><span className="text-cyan">Nothing they don't.</span>
        </h2>
        <p className="text-muted text-[1.05rem] max-w-[520px]">We aggregate data from 47 sources so you don't have to.</p>
      </div>

      <div ref={gridRef} className="reveal grid grid-cols-12 auto-rows-[minmax(200px,auto)] gap-4 mt-12" style={{ transitionDelay: '0.15s' }}>
        {FEATURES.map((feature, i) => (
          <BentoCard key={i} feature={feature} />
        ))}
      </div>
    </section>
  );
}
