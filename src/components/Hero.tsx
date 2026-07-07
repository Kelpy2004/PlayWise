import { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';
import CoverImage from './CoverImage';
import type { DealRecord } from '../types/api';

interface HeroProps {
  gameCount?: number
  dealCount?: number
  freeCount?: number
  storeCount?: number
  stores?: string[]
  tournamentCount?: number
}

interface HeroCard {
  title: string
  price: string
  isFree: boolean
  badge: string | null
  image: string | null
}

// Fixed positions/sizes for the 3 floating cards (front → back).
const CARD_LAYOUT = [
  { box: 'w-[260px] h-[340px] top-5 right-[30px] z-[3]', anim: 'animate-float-a', extra: '' },
  { box: 'w-[200px] h-[270px] top-20 right-[260px] z-[2]', anim: 'animate-float-b', extra: 'opacity-90' },
  { box: 'w-[180px] h-[240px] bottom-5 right-[140px] z-[1]', anim: 'animate-float-c', extra: 'opacity-80' },
]

// Shown until live deals load, or if the deals API is unavailable.
const FALLBACK_CARDS: HeroCard[] = [
  { title: 'Elden Ring', price: '$29.99', isFree: false, badge: null, image: null },
  { title: "Baldur's Gate 3", price: '$35.99', isFree: false, badge: null, image: null },
  { title: 'Counter-Strike 2', price: 'Free', isFree: true, badge: 'Free', image: null },
]

function isFreeDeal(deal: DealRecord): boolean {
  return deal.dealPrice === 0 || deal.type === 'FREE_GAME' || deal.type === 'MISSION_FREE'
}

function dealPriceLabel(deal: DealRecord): string {
  if (isFreeDeal(deal)) return 'Free'
  const sym = deal.currency === 'INR' ? '₹' : deal.currency === 'EUR' ? '€' : deal.currency === 'GBP' ? '£' : '$'
  return `${sym}${(deal.dealPrice ?? 0).toFixed(2)}`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Hero({ gameCount = 0, dealCount = 0, freeCount: _freeCount = 0, storeCount = 0, stores: _stores = [], tournamentCount: _tournamentCount = 0 }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null);
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const celestialRef = useRef<HTMLDivElement>(null);
  const orbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [cards, setCards] = useState<HeroCard[]>(FALLBACK_CARDS);

  // Live "hot right now" deals — free games first, then biggest discounts.
  // Shuffled among the top picks so the hero shows something fresh each visit.
  useEffect(() => {
    let ignore = false;
    api.fetchDeals()
      .then((deals) => {
        if (ignore || !Array.isArray(deals)) return;
        const withImage = deals.filter((d) => d.imageUrl && d.isActive !== false);
        const free = withImage.filter(isFreeDeal);
        const discounted = withImage
          .filter((d) => d.type === 'DISCOUNT' && (d.dealPrice ?? 0) > 0)
          .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0));
        // Full random mix: equal candidates from the free games and the biggest
        // discounts, then shuffle the whole pool — any visit may show free games,
        // deals, or a blend.
        const pool = shuffle([...free.slice(0, 6), ...discounted.slice(0, 6)]);
        const picked = pool.slice(0, 3);
        if (picked.length === 3) {
          setCards(
            picked.map((d) => ({
              title: d.title,
              price: dealPriceLabel(d),
              isFree: isFreeDeal(d),
              badge: isFreeDeal(d) ? 'Free' : d.discountPct ? `-${d.discountPct}%` : null,
              image: d.imageUrl ?? null,
            }))
          );
        }
      })
      .catch(() => { /* keep fallback cards */ });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
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
          {gameCount > 0 ? `Tracking ${gameCount.toLocaleString()} games` : 'Loading catalog'} &middot; {dealCount > 0 ? `${dealCount} live deals` : 'deals refresh every 5 min'}
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
            <div className="text-[2rem] font-extrabold font-mono tracking-tighter text-cyan">{gameCount > 0 ? gameCount.toLocaleString() : '...'}</div>
            <div className="text-[0.72rem] text-muted uppercase tracking-[0.1em] font-semibold">Games in catalog</div>
          </div>
          <div>
            <div className="text-[2rem] font-extrabold font-mono tracking-tighter text-amber">{dealCount > 0 ? dealCount : '...'}</div>
            <div className="text-[0.72rem] text-muted uppercase tracking-[0.1em] font-semibold">Live deals</div>
          </div>
          <div>
            <div className="text-[2rem] font-extrabold font-mono tracking-tighter text-green">{storeCount > 0 ? storeCount : '...'}</div>
            <div className="text-[0.72rem] text-muted uppercase tracking-[0.1em] font-semibold">Store sources</div>
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
        {cards.map((card, i) => {
          const layout = CARD_LAYOUT[i];
          return (
            <div
              key={`${i}-${card.title}`}
              className={`float-card absolute ${layout.box} ${layout.anim} ${layout.extra} rounded-[var(--radius)] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-border hover:-translate-y-2 hover:scale-[1.02] transition-transform duration-600`}
            >
              <CoverImage
                src={card.image}
                alt={card.title}
                seed={card.title}
                className="absolute inset-0 h-full w-full object-cover"
                letterClassName="text-6xl"
              />
              {card.badge && (
                <span
                  className={`absolute top-2.5 left-2.5 z-[2] rounded-md px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.08em] shadow-md ${
                    card.isFree ? 'bg-cyan text-white' : 'bg-green text-[#002200]'
                  }`}
                >
                  {card.badge}
                </span>
              )}
              {/* Legibility gradient behind the caption */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <div className="font-bold text-[0.85rem] truncate">{card.title}</div>
                <div className="font-mono text-[0.8rem] font-bold" style={{ color: card.isFree ? 'var(--cyan)' : 'var(--green)' }}>
                  {card.price}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
