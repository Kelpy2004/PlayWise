import { useRef, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { api } from '../lib/api';
import type { DealRecord } from '../types/api';

const BADGE_CLASSES: Record<string, string> = {
  deal: 'bg-green text-[#002200]',
  free: 'bg-cyan text-white',
  hot: 'bg-magenta text-white',
};

function badgeFor(deal: DealRecord): { text: string; type: string } | null {
  if (deal.type === 'FREE_GAME' || deal.type === 'MISSION_FREE' || deal.dealPrice === 0) {
    return { text: 'Free', type: 'free' };
  }
  if (deal.discountPct && deal.discountPct >= 75) {
    return { text: `-${deal.discountPct}%`, type: 'deal' };
  }
  if (deal.discountPct && deal.discountPct >= 50) {
    return { text: `-${deal.discountPct}%`, type: 'deal' };
  }
  return null;
}

function formatDealPrice(deal: DealRecord): string {
  if (deal.dealPrice === 0 || deal.type === 'FREE_GAME') return 'Free';
  const sym = deal.currency === 'INR' ? '₹' : deal.currency === 'EUR' ? '€' : deal.currency === 'GBP' ? '£' : '$';
  return `${sym}${(deal.dealPrice ?? 0).toFixed(2)}`;
}

const REFRESH_INTERVAL = 5 * 60 * 1000;

export default function TrendingSection() {
  const navigate = useNavigate();
  const headerRef = useScrollReveal();
  const scrollRef = useScrollReveal();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [deals, setDeals] = useState<DealRecord[]>([]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const data = await api.fetchDeals();
        if (!ignore && Array.isArray(data)) {
          // Top 8: free games first, then biggest discounts — only ones with images
          const withImages = data.filter((d) => d.imageUrl && d.isActive !== false);
          const free = withImages.filter((d) => d.type === 'FREE_GAME' || d.type === 'MISSION_FREE' || d.dealPrice === 0);
          const discounted = withImages.filter((d) => d.type === 'DISCOUNT' && (d.dealPrice ?? 0) > 0);
          discounted.sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0));
          setDeals([...free.slice(0, 4), ...discounted.slice(0, 4)].slice(0, 8));
        }
      } catch {
        // silent — section just won't show deals
      }
    }
    void load();
    const timer = setInterval(() => { void load(); }, REFRESH_INTERVAL);
    return () => { ignore = true; clearInterval(timer); };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    dragState.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current.isDown = false;
    if (scrollContainerRef.current) scrollContainerRef.current.style.cursor = 'grab';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isDown) return;
    e.preventDefault();
    const el = scrollContainerRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX) * 1.5;
  }, []);

  const handleCardMouseMove = useCallback((e: React.MouseEvent) => {
    const card = e.currentTarget as HTMLElement;
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
    const y = -((e.clientY - r.top) / r.height - 0.5) * 8;
    card.style.transform = `translateY(-6px) scale(1.02) rotateY(${x}deg) rotateX(${y}deg)`;
  }, []);

  const handleCardMouseLeave = useCallback((e: React.MouseEvent) => {
    (e.currentTarget as HTMLElement).style.transform = '';
  }, []);

  if (!deals.length) return null;

  return (
    <section id="trending" className="py-[100px] px-[clamp(1rem,5vw,6rem)] bg-surface border-t border-b border-border transition-[background] duration-[var(--transition-theme)]">
      <div ref={headerRef} className="reveal flex justify-between items-end mb-10">
        <div>
          <div className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-cyan mb-3">
            <span className="w-6 h-0.5 bg-cyan rounded-sm" />
            Trending Now
          </div>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-tight mb-4">Hot this week</h2>
          <p className="text-muted text-[1.05rem] max-w-[520px]">Live deals from Steam, Epic Games, Ubisoft, Xbox, and more — updated every 5 minutes.</p>
        </div>
        <button
          onClick={() => navigate('/deals')}
          className="px-[22px] py-[10px] rounded-full bg-cyan text-white font-bold text-[0.85rem] border-none cursor-pointer whitespace-nowrap shadow-[0_0_24px_rgba(0,212,255,0.25)] hover:shadow-[0_0_40px_rgba(0,212,255,0.4)] hover:-translate-y-px transition-all duration-300"
        >
          View All Deals
        </button>
      </div>

      <div
        ref={(el) => { scrollContainerRef.current = el; if (scrollRef.current !== el) (scrollRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
        className="reveal flex gap-5 overflow-x-auto pb-5 snap-x snap-mandatory scrollbar-hide"
        style={{ cursor: 'grab', scrollbarWidth: 'none', transitionDelay: '0.15s' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {deals.map((deal) => {
          const badge = badgeFor(deal);
          const isFree = deal.dealPrice === 0 || deal.type === 'FREE_GAME';

          return (
            <a
              key={deal.externalId || deal.id}
              href={deal.url}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 w-[260px] snap-start rounded-[var(--radius)] overflow-hidden bg-card border border-border cursor-pointer transition-all duration-400 hover:border-cyan/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] no-underline text-inherit"
              onMouseMove={handleCardMouseMove}
              onMouseLeave={handleCardMouseLeave}
            >
              <div className="aspect-[16/10] relative overflow-hidden bg-black">
                {deal.imageUrl ? (
                  <img
                    src={deal.imageUrl}
                    alt={deal.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    style={{ imageRendering: 'auto' }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1e0a30] to-[#0a1e30]" />
                )}
                {badge && (
                  <span className={`absolute top-[10px] left-[10px] px-[10px] py-1 rounded-md text-[0.65rem] font-extrabold uppercase tracking-[0.08em] z-[2] ${BADGE_CLASSES[badge.type] || BADGE_CLASSES.deal}`}>
                    {badge.text}
                  </span>
                )}
                <span
                  className="absolute bottom-[10px] right-[10px] px-[10px] py-1 rounded-md bg-black/70 backdrop-blur-lg font-mono text-[0.8rem] font-bold z-[2]"
                  style={{ color: isFree ? 'var(--cyan)' : 'var(--green)' }}
                >
                  {formatDealPrice(deal)}
                </span>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--deep)]" />
              </div>
              <div className="p-[14px_16px]">
                <div className="font-bold text-[0.92rem] mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">{deal.title}</div>
                <div className="flex items-center gap-2 text-[0.75rem] text-muted">
                  <span className="w-[5px] h-[5px] rounded-full bg-cyan" />
                  {deal.store}
                  {deal.originalPrice != null && deal.originalPrice > 0 && !isFree && (
                    <span className="ml-auto line-through text-[0.7rem] opacity-50">
                      ${deal.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
