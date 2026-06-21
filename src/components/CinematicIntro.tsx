import { useEffect, useRef, useMemo } from 'react';

const GAMING_TABS = [
  { pos: 'tab-pos-tl', color: '#66c0f4', icon: 'cloud', name: 'Steam', tx: 'calc(50vw - 90px)', ty: 'calc(50vh - 55px)', rot: '-12deg' },
  { pos: 'tab-pos-tr', color: '#fff', icon: 'storefront', name: 'Epic Games', tx: 'calc(-50vw + 90px)', ty: 'calc(50vh - 55px)', rot: '15deg' },
  { pos: 'tab-pos-bl', color: '#107c10', icon: 'sports_esports', name: 'Xbox', tx: 'calc(50vw - 90px)', ty: 'calc(-50vh + 55px)', rot: '8deg' },
  { pos: 'tab-pos-br', color: '#006FCD', icon: 'stadia_controller', name: 'PlayStation', tx: 'calc(-50vw + 90px)', ty: 'calc(-50vh + 55px)', rot: '-10deg' },
  { pos: 'tab-pos-tm', color: '#e60012', icon: 'videogame_asset', name: 'Nintendo', tx: '0px', ty: 'calc(50vh - 55px)', rot: '5deg' },
  { pos: 'tab-pos-bm', color: '#b028cb', icon: 'deployed_code', name: 'GOG', tx: '0px', ty: 'calc(-50vh + 55px)', rot: '-7deg' },
  { pos: 'tab-pos-ml', color: '#cc3333', icon: 'local_fire_department', name: 'Humble', tx: 'calc(50vw)', ty: '0px', rot: '12deg' },
  { pos: 'tab-pos-mr', color: '#eb0029', icon: 'bolt', name: 'Riot Games', tx: 'calc(-50vw)', ty: '0px', rot: '-14deg' },
];

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export default function CinematicIntro({ onComplete, onDone }: { onComplete?: () => void; onDone?: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const glassTabRef = useRef<HTMLDivElement>(null);
  const cursorOrbRef = useRef<HTMLDivElement>(null);
  const shockwaveRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeAreaRef = useRef<HTMLDivElement>(null);
  const typeLine1Ref = useRef<HTMLDivElement>(null);
  const typeLine2Ref = useRef<HTMLDivElement>(null);
  const typeLine3Ref = useRef<HTMLDivElement>(null);
  const typed1Ref = useRef<HTMLSpanElement>(null);
  const typed2Ref = useRef<HTMLSpanElement>(null);
  const typed3Ref = useRef<HTMLSpanElement>(null);

  // Generate particles
  const particles = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      dx: `${(Math.random() - 0.5) * 60}px`,
      dy: `${(Math.random() - 0.5) * 60}px`,
      delay: `${Math.random() * 3}s`,
      duration: `${3 + Math.random() * 3}s`,
    }));
  }, []);

  // Parallax on glass tab
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const handleMouseMove = (e: MouseEvent) => {
      const glassTab = glassTabRef.current;
      if (!glassTab || glassTab.style.opacity === '0') return;
      const mx = (e.clientX / window.innerWidth - 0.5) * 2;
      const my = (e.clientY / window.innerHeight - 0.5) * 2;
      const rx = my * -8;
      const ry = mx * 8;
      if (!glassTab.classList.contains('exiting')) {
        glassTab.style.transform = `scale(1) rotateX(${rx}deg) rotateY(${ry}deg)`;
      }
    };

    overlay.addEventListener('mousemove', handleMouseMove);
    return () => overlay.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Run intro sequence
  useEffect(() => {
    let cancelled = false;

    async function runIntro() {
      const glassTab = glassTabRef.current;
      const cursorOrb = cursorOrbRef.current;
      const shockwave = shockwaveRef.current;
      const overlay = overlayRef.current;

      if (!glassTab || !cursorOrb || !shockwave || !overlay) return;

      document.body.style.overflow = 'hidden';

      // Phase 1: Tab swoop
      await sleep(200);
      const swoopDuration = 1800;
      tabRefs.current.forEach((tab, i) => {
        if (!tab) return;
        const data = GAMING_TABS[i];
        tab.style.setProperty('--tx', data.tx);
        tab.style.setProperty('--ty', data.ty);
        tab.style.setProperty('--rot', data.rot);
        tab.style.visibility = 'visible';
        tab.style.opacity = '0';
        tab.style.animation = `tabSwoop ${swoopDuration}ms cubic-bezier(0.25,0.46,0.45,0.94) ${i * 70}ms forwards`;
      });

      // Shockwave at collapse
      await sleep(swoopDuration * 0.6 + 100);
      if (cancelled) return;
      shockwave.classList.add('active');

      // Phase 2: Glass tab forms
      await sleep(400);
      if (cancelled) return;
      glassTab.classList.add('forming');

      // Phase 3: Orb click + text reveal
      await sleep(900);
      if (cancelled) return;
      const typeArea = typeAreaRef.current;
      if (!typeArea) return;
      cursorOrb.classList.add('visible');
      const tabRect = glassTab.getBoundingClientRect();
      const areaRect = typeArea.getBoundingClientRect();
      cursorOrb.style.left = (areaRect.left - tabRect.left + areaRect.width / 2 - 16) + 'px';
      cursorOrb.style.top = (areaRect.top - tabRect.top + 40) + 'px';

      await sleep(300);
      if (cancelled) return;
      cursorOrb.classList.add('click');
      await sleep(300);
      cursorOrb.classList.remove('click');
      cursorOrb.style.opacity = '0';

      // Line 1: smash in
      await sleep(100);
      if (cancelled) return;
      if (typed1Ref.current) typed1Ref.current.textContent = 'ONE SCREEN';
      if (typeLine1Ref.current) typeLine1Ref.current.classList.add('reveal-line-1');

      await sleep(400);
      if (cancelled) return;

      // Line 2: sweep left
      if (typed2Ref.current) typed2Ref.current.textContent = 'EVERY PRICE — EVERY DEAL.';
      if (typeLine2Ref.current) typeLine2Ref.current.classList.add('reveal-line-2');

      await sleep(350);
      if (cancelled) return;

      // Line 3: sweep right
      if (typed3Ref.current) typed3Ref.current.textContent = 'EVERY TOURNAMENT.';
      if (typeLine3Ref.current) typeLine3Ref.current.classList.add('reveal-line-3');

      // Glow pulse
      await sleep(300);
      if (cancelled) return;
      typeArea.classList.add('all-revealed');

      // Blinking cursor
      const finalCursor = document.createElement('span');
      finalCursor.className = 'type-cursor';
      if (typed3Ref.current) typed3Ref.current.appendChild(finalCursor);

      // Hold
      await sleep(700);
      if (cancelled) return;

      // Phase 4: Premium 3D morph
      cursorOrb.classList.remove('visible');
      glassTab.classList.add('exiting');
      await sleep(300);
      if (cancelled) return;

      // Reparent to body
      const startRect = glassTab.getBoundingClientRect();
      glassTab.style.position = 'fixed';
      glassTab.style.left = startRect.left + 'px';
      glassTab.style.top = startRect.top + 'px';
      glassTab.style.width = startRect.width + 'px';
      glassTab.style.height = startRect.height + 'px';
      glassTab.style.margin = '0';
      glassTab.style.zIndex = '10001';
      glassTab.style.animation = 'none';
      document.body.appendChild(glassTab);

      // Dissolve overlay + reveal main site
      overlay.style.transition = 'opacity 0.55s ease';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      await sleep(120);
      if (cancelled) return;

      // Signal main site to reveal
      onComplete?.();
      document.body.style.overflow = '';
      await sleep(380);
      if (cancelled) return;

      // Calculate target
      const card1 = document.querySelector('.float-card-1');
      const heroVisual = document.getElementById('heroVisual');
      let targetLeft, targetTop;

      if (card1 && heroVisual && getComputedStyle(heroVisual).display !== 'none') {
        const cr = card1.getBoundingClientRect();
        targetLeft = cr.left;
        targetTop = cr.top;
      } else {
        targetLeft = window.innerWidth - 290;
        targetTop = window.innerHeight * 0.15;
      }

      // Launch morph flight
      glassTab.style.transition = [
        'left 1.35s cubic-bezier(0.4, 0, 0.12, 1)',
        'top 1.35s cubic-bezier(0.4, 0, 0.12, 1)',
        'width 1.35s cubic-bezier(0.34, 1.15, 0.64, 1)',
        'height 1.35s cubic-bezier(0.34, 1.15, 0.64, 1)',
        'border-radius 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'transform 1.35s cubic-bezier(0.4, 0, 0.12, 1)',
        'background 1s ease',
        'box-shadow 1s ease',
        'backdrop-filter 0.6s ease',
        'border-color 0.8s ease'
      ].join(', ');

      glassTab.style.left = targetLeft + 'px';
      glassTab.style.top = targetTop + 'px';
      glassTab.style.width = '260px';
      glassTab.style.height = '340px';
      glassTab.style.borderRadius = '16px';
      glassTab.style.transform = 'rotateY(-8deg) rotateX(4deg)';
      glassTab.style.background = 'linear-gradient(135deg, #1a1a3e, #2d1b69)';
      glassTab.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)';
      glassTab.style.backdropFilter = 'none';
      glassTab.style.borderColor = 'rgba(255,255,255,0.06)';

      // Dissolve at ~80% flight
      await sleep(1080);
      if (cancelled) return;
      glassTab.style.transition = 'opacity 0.3s ease, filter 0.3s ease, transform 0.3s ease';
      glassTab.style.opacity = '0';
      glassTab.style.filter = 'blur(4px)';
      glassTab.style.transform = 'rotateY(-8deg) rotateX(4deg) scale(0.97)';

      // Merge flash
      await sleep(250);
      if (cancelled) return;
      if (card1) card1.classList.add('merge-flash');

      // Cleanup
      await sleep(600);
      overlay.style.display = 'none';
      glassTab.remove();
      if (card1) setTimeout(() => card1.classList.remove('merge-flash'), 500);

      // Signal that the full animation is done — safe to unmount
      onDone?.();
    }

    runIntro();
    return () => { cancelled = true; };
  }, [onComplete, onDone]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] bg-[#06060f] flex items-center justify-center overflow-hidden"
      style={{ perspective: '1800px' }}
    >
      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {particles.map(p => (
          <div
            key={p.id}
            className="intro-particle"
            style={{
              top: p.top,
              left: p.left,
              '--dx': p.dx,
              '--dy': p.dy,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      {/* Gaming platform tabs */}
      {GAMING_TABS.map((tab, i) => (
        <div
          key={i}
          ref={el => tabRefs.current[i] = el}
          className={`gaming-tab ${tab.pos}`}
        >
          <div className="text-[0.7rem] font-bold">
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: tab.color }}>
              {tab.icon}
            </span>
          </div>
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/50">
            {tab.name}
          </div>
        </div>
      ))}

      {/* Shockwave */}
      <div ref={shockwaveRef} className="shockwave" />

      {/* Liquid glass tab */}
      <div ref={glassTabRef} className="glass-tab">
        <div className="glass-tab-header absolute top-0 left-0 right-0 h-10 border-b border-white/[0.06] flex items-center px-4 gap-2 z-[2]">
          <span className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]" />
          <span className="w-[10px] h-[10px] rounded-full bg-[#febc2e]" />
          <span className="w-[10px] h-[10px] rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[0.72rem] text-white/35 font-medium">playwise.gg</span>
        </div>

        <div ref={typeAreaRef} className="type-area relative z-[5] text-center px-10 pt-[60px] pb-10">
          <div ref={typeLine1Ref} className="type-line text-[clamp(2.8rem,5vw,4rem)] text-white">
            <span ref={typed1Ref} className="typed-text inline" />
          </div>
          <div
            ref={typeLine2Ref}
            className="type-line text-[clamp(1.4rem,2.8vw,2rem)] mt-3"
            style={{
              background: 'linear-gradient(135deg, var(--cyan), #66e0ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            <span ref={typed2Ref} className="typed-text inline" />
          </div>
          <div ref={typeLine3Ref} className="type-line text-[clamp(1.4rem,2.8vw,2rem)] text-amber mt-2">
            <span ref={typed3Ref} className="typed-text inline" style={{ WebkitTextFillColor: 'var(--amber)' }} />
          </div>
        </div>

        <div ref={cursorOrbRef} className="cursor-orb" />
      </div>
    </div>
  );
}
