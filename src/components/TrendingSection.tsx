import { useRef, useCallback } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

const GAMES = [
  { title: 'Cyberpunk 2077', badge: '-67%', badgeType: 'deal', price: '$19.99', platforms: 'PC, PS5', score: '9.2', scoreType: 'high', bg: 'linear-gradient(135deg,#1e0a30,#0a1e30)' },
  { title: 'GTA VI', badge: 'New', badgeType: 'new', price: '$59.99', platforms: 'PS5, Xbox', score: 'N/A', scoreType: 'mid', bg: 'linear-gradient(135deg,#0a200a,#0a1020)' },
  { title: 'Elden Ring', badge: 'Hot', badgeType: 'hot', price: '$39.99', platforms: 'PC, PS5, Xbox', score: '9.5', scoreType: 'high', bg: 'linear-gradient(135deg,#200a10,#100a20)' },
  { title: "Baldur's Gate 3", badge: '-45%', badgeType: 'deal', price: '$24.99', platforms: 'PC, PS5', score: '9.7', scoreType: 'high', bg: 'linear-gradient(135deg,#0a0a25,#1a0a1e)' },
  { title: 'Fortnite', badge: null, badgeType: null, price: 'Free', priceColor: 'var(--cyan)', platforms: 'All Platforms', score: '8.1', scoreType: 'mid', bg: 'linear-gradient(135deg,#1a1a00,#0a1020)' },
  { title: 'Red Dead 2', badge: '-50%', badgeType: 'deal', price: '$29.99', platforms: 'PC, PS4, Xbox', score: '9.4', scoreType: 'high', bg: 'linear-gradient(135deg,#20100a,#0a0a20)' },
  { title: 'Star Wars Outlaws', badge: 'New', badgeType: 'new', price: '$69.99', platforms: 'PC, PS5, Xbox', score: '7.8', scoreType: 'mid', bg: 'linear-gradient(135deg,#0a1520,#1a0a20)' },
];

const BADGE_CLASSES = {
  deal: 'bg-green text-[#002200]',
  new: 'bg-cyan text-white',
  hot: 'bg-magenta text-white',
};

export default function TrendingSection() {
  const headerRef = useScrollReveal();
  const scrollRef = useScrollReveal();
  const scrollContainerRef = useRef(null);
  const dragState = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const handleMouseDown = useCallback((e) => {
    const el = scrollContainerRef.current;
    dragState.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
  }, []);

  const handleMouseUp = useCallback(() => {
    dragState.current.isDown = false;
    if (scrollContainerRef.current) scrollContainerRef.current.style.cursor = 'grab';
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragState.current.isDown) return;
    e.preventDefault();
    const el = scrollContainerRef.current;
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX) * 1.5;
  }, []);

  const handleCardMouseMove = useCallback((e) => {
    const card = e.currentTarget;
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
    const y = -((e.clientY - r.top) / r.height - 0.5) * 8;
    card.style.transform = `translateY(-6px) scale(1.02) rotateY(${x}deg) rotateX(${y}deg)`;
  }, []);

  const handleCardMouseLeave = useCallback((e) => {
    e.currentTarget.style.transform = '';
  }, []);

  return (
    <section id="trending" className="py-[100px] px-[clamp(1rem,5vw,6rem)] bg-surface border-t border-b border-border transition-[background] duration-[var(--transition-theme)]">
      <div ref={headerRef} className="reveal flex justify-between items-end mb-10">
        <div>
          <div className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-cyan mb-3">
            <span className="w-6 h-0.5 bg-cyan rounded-sm" />
            Trending Now
          </div>
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-tight mb-4">Hot this week</h2>
          <p className="text-muted text-[1.05rem] max-w-[520px]">Real-time rankings powered by price drops, player activity, and community buzz.</p>
        </div>
        <button className="px-[22px] py-[10px] rounded-full bg-cyan text-white font-bold text-[0.85rem] border-none cursor-pointer whitespace-nowrap shadow-[0_0_24px_rgba(0,212,255,0.25)] hover:shadow-[0_0_40px_rgba(0,212,255,0.4)] hover:-translate-y-px transition-all duration-300">
          View All Games
        </button>
      </div>

      <div
        ref={(el) => { scrollContainerRef.current = el; if (scrollRef.current !== el) scrollRef.current = el; }}
        className="reveal flex gap-5 overflow-x-auto pb-5 snap-x snap-mandatory scrollbar-hide"
        style={{ cursor: 'grab', scrollbarWidth: 'none', transitionDelay: '0.15s' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {GAMES.map((game, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[220px] snap-start rounded-[var(--radius)] overflow-hidden bg-card border border-border cursor-pointer transition-all duration-400 hover:border-cyan/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
          >
            <div className="aspect-[3/4] bg-cover bg-center relative" style={{ background: game.bg }}>
              {game.badge && (
                <span className={`absolute top-[10px] left-[10px] px-[10px] py-1 rounded-md text-[0.65rem] font-extrabold uppercase tracking-[0.08em] z-[2] ${BADGE_CLASSES[game.badgeType]}`}>
                  {game.badge}
                </span>
              )}
              <span
                className="absolute bottom-[10px] right-[10px] px-[10px] py-1 rounded-md bg-black/70 backdrop-blur-lg font-mono text-[0.8rem] font-bold z-[2]"
                style={{ color: game.priceColor || 'var(--green)' }}
              >
                {game.price}
              </span>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--deep)]" style={{ backgroundPosition: '50% 100%' }} />
            </div>
            <div className="p-[14px_16px]">
              <div className="font-bold text-[0.92rem] mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">{game.title}</div>
              <div className="flex items-center gap-2 text-[0.75rem] text-muted">
                <span className="w-[5px] h-[5px] rounded-full bg-cyan" />
                {game.platforms}
                <span className={`ml-auto px-2 py-0.5 rounded font-extrabold font-mono text-[0.72rem] ${
                  game.scoreType === 'high' ? 'bg-green/[0.15] text-green' : 'bg-amber-dim text-amber'
                }`}>
                  {game.score}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
