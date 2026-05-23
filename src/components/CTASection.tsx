import { useScrollReveal } from '../hooks/useScrollReveal';

export default function CTASection() {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="reveal text-center py-[120px] px-[clamp(1rem,5vw,6rem)] relative overflow-hidden">
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(circle, var(--cyan), var(--magenta))' }}
      />
      <h2 className="relative z-[1] text-[clamp(2.5rem,5vw,4rem)] font-black tracking-tighter mb-4">
        Ready to stop<br /><span className="text-cyan">tab-hopping?</span>
      </h2>
      <p className="relative z-[1] text-muted text-[1.1rem] mb-9">
        Join thousands of gamers who save time and money with PlayWise.
      </p>
      <button className="relative z-[1] inline-flex items-center gap-2 px-8 py-4 rounded-[14px] bg-cyan text-white font-bold text-base border-none cursor-pointer shadow-[0_8px_32px_rgba(0,212,255,0.3)] hover:shadow-[0_16px_48px_rgba(0,212,255,0.4)] hover:-translate-y-[3px] transition-all duration-[350ms]">
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>rocket_launch</span>
        Get Started Free
      </button>
    </section>
  );
}
