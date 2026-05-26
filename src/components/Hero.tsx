import { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Hero({ gameCount = 12400 }: { gameCount?: number }) {
  const { theme } = useTheme();
  const heroRef = useRef(null);
  const heroVisualRef = useRef(null);
  const celestialRef = useRef(null);
  const orbRefs = useRef([]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const mx = (e.clientX / window.innerWidth - 0.5) * 2;
      const my = (e.clientY / window.innerHeight - 0.5) * 2;

      orbRefs.current.forEach((orb, i) => {
        if (orb) {
          orb.style.transform = `translate(${mx * (i + 1) * 12}px, ${my * (i + 1) * 12}px) scale(${1 + Math.abs(mx) * 0.02})`;
        }
      });

      if (heroVisualRef.current) {
        heroVisualRef.current.style.transform = `translateY(-50%) rotateY(${mx * 4}deg) rotateX(${-my * 3}deg)`;
      }

      if (celestialRef.current) {
        celestialRef.current.style.transform = `translate(${mx * -8}px, ${my * -6}px)`;
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section ref={heroRef} className="hero-section relative min-h-screen flex items-center px-[clamp(1rem,5vw,6rem)] pt-[120px] pb-20 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 z-0">
        <div
          ref={el => orbRefs.current[0] = el}
          className="hero-orb hero-orb-1 absolute rounded-full blur-[120px] opacity-40 animate-orb-float"
          style={{ width: '600px', height: '600px', background: 'radial-gradient(circle, var(--cyan), transparent)', top: '-15%', right: '-10%', transition: 'opacity var(--transition-theme)' }}
        />
        <div
          ref={el => orbRefs.current[1] = el}
          className="hero-orb hero-orb-2 absolute rounded-full blur-[120px] opacity-40 animate-orb-float"
          style={{ width: '400px', height: '400px', background: 'radial-gradient(circle, var(--magenta), transparent)', bottom: '-10%', left: '5%', animationDelay: '3s', transition: 'opacity var(--transition-theme)' }}
        />
        <div
          ref={el => orbRefs.current[2] = el}
          className="hero-orb hero-orb-3 absolute rounded-full blur-[120px] opacity-20 animate-orb-float"
          style={{ width: '300px', height: '300px', background: 'radial-gradient(circle, var(--amber), transparent)', top: '40%', left: '50%', animationDelay: '5s', transition: 'opacity var(--transition-theme)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
            maskImage: 'radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%)',
          }}
        />
      </div>

      {/* Celestial body (moon/sun) */}
      <div ref={celestialRef} className="celestial-body">
        <svg className="sun-rays" viewBox="0 0 200 200" fill="none">
          <g opacity="0.5">
            <line x1="100" y1="0" x2="100" y2="30" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
            <line x1="100" y1="170" x2="100" y2="200" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
            <line x1="0" y1="100" x2="30" y2="100" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
            <line x1="170" y1="100" x2="200" y2="100" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
            <line x1="29" y1="29" x2="50" y2="50" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
            <line x1="150" y1="150" x2="171" y2="171" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
            <line x1="171" y1="29" x2="150" y2="50" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
            <line x1="50" y1="150" x2="29" y2="171" stroke="#ffb800" strokeWidth="2" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      {/* Hero content */}
      <div className="relative z-[2] max-w-[680px]">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-dim border border-cyan/20 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-cyan mb-7"
          style={{ opacity: 0, animation: 'slideUp 0.7s 0.2s forwards' }}
        >
          <span className="w-1.5 h-1.5 bg-cyan rounded-full animate-pulse-dot" />
          Tracking {gameCount.toLocaleString()} games &middot; deals refresh every 5 min
        </div>

        <h1
          className="text-[clamp(3.2rem,6vw,5.5rem)] font-black leading-[0.95] tracking-tighter mb-6"
          style={{ opacity: 0, animation: 'slideUp 0.8s 0.35s forwards' }}
        >
          No more<br />
          <span
            className="accent"
            style={{
              background: 'linear-gradient(135deg, var(--cyan), #66e0ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            site hopping.
          </span>
          <span className="block italic text-muted text-[0.65em] tracking-tight" style={{ WebkitTextFillColor: 'var(--muted)' }}>
            prices, deals, tournaments &mdash; all here.
          </span>
        </h1>

        <p
          className="text-[1.15rem] text-muted max-w-[520px] leading-relaxed mb-10"
          style={{ opacity: 0, animation: 'slideUp 0.8s 0.5s forwards' }}
        >
          Steam, Epic, Xbox, Ubisoft &mdash; every deal, every free game, every tournament pulled into one dashboard. Stop checking six stores. Start playing.
        </p>

        <div
          className="flex gap-[48px]"
          style={{ opacity: 0, animation: 'slideUp 0.8s 0.8s forwards' }}
        >
          <div>
            <div className="text-[2rem] font-extrabold font-mono tracking-tighter text-cyan">{gameCount.toLocaleString()}</div>
            <div className="text-[0.72rem] text-muted uppercase tracking-[0.1em] font-semibold">Games in catalog</div>
          </div>
          <div>
            <div className="text-[2rem] font-extrabold font-mono tracking-tighter text-amber">8</div>
            <div className="text-[0.72rem] text-muted uppercase tracking-[0.1em] font-semibold">Deal sources</div>
          </div>
          <div>
            <div className="text-[2rem] font-extrabold font-mono tracking-tighter text-green">100%</div>
            <div className="text-[0.72rem] text-muted uppercase tracking-[0.1em] font-semibold">Free to use</div>
          </div>
        </div>
      </div>

      {/* Hero visual — floating cards */}
      <div
        id="heroVisual"
        ref={heroVisualRef}
        className="hero-visual absolute right-[clamp(2rem,8vw,10rem)] top-1/2 -translate-y-1/2 w-[480px] h-[520px] z-[1]"
        style={{ opacity: 0, perspective: '1200px', animation: 'fadeIn 1.2s 0.6s forwards' }}
      >
        <div className="float-card float-card-1 absolute w-[260px] h-[340px] top-5 right-[30px] rounded-[var(--radius)] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-border z-[3] animate-float-a hover:-translate-y-2 hover:scale-[1.02] transition-transform duration-600">
          <div className="h-full" style={{ background: 'linear-gradient(135deg, #1a1a3e, #2d1b69)' }}>
            <div className="absolute inset-0 grid place-items-center z-[1]">
              <span className="material-symbols-outlined text-white/[0.15]" style={{ fontSize: '72px' }}>sports_esports</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-white">
            <div className="font-bold text-[0.85rem]">Elden Ring</div>
            <div className="font-mono text-[0.8rem] text-green font-bold">$29.99</div>
          </div>
        </div>

        <div className="float-card float-card-2 absolute w-[200px] h-[270px] top-20 right-[260px] rounded-[var(--radius)] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-border z-[2] animate-float-b opacity-85 hover:-translate-y-2 hover:scale-[1.02] transition-transform duration-600">
          <div className="h-full" style={{ background: 'linear-gradient(135deg, #0d2137, #1a0a2e)' }}>
            <div className="absolute inset-0 grid place-items-center z-[1]">
              <span className="material-symbols-outlined text-white/[0.15]" style={{ fontSize: '56px' }}>castle</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-white">
            <div className="font-bold text-[0.85rem]">Baldur's Gate 3</div>
            <div className="font-mono text-[0.8rem] text-green font-bold">$35.99</div>
          </div>
        </div>

        <div className="float-card float-card-3 absolute w-[180px] h-[240px] bottom-5 right-[140px] rounded-[var(--radius)] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-border z-[1] animate-float-c opacity-70 hover:-translate-y-2 hover:scale-[1.02] transition-transform duration-600">
          <div className="h-full" style={{ background: 'linear-gradient(135deg, #2d0a0a, #1a0a2e)' }}>
            <div className="absolute inset-0 grid place-items-center z-[1]">
              <span className="material-symbols-outlined text-white/[0.15]" style={{ fontSize: '48px' }}>military_tech</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-white">
            <div className="font-bold text-[0.85rem]">CS2</div>
            <div className="font-mono text-[0.8rem] font-bold" style={{ color: 'var(--cyan)' }}>Free</div>
          </div>
        </div>
      </div>
    </section>
  );
}
