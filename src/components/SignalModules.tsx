import { useState, useRef, useCallback, useEffect } from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useTilt3D } from '../hooks/useTilt3D';

const PRICE_TIMELINE = [
  { price: 62.99, x: 8, y: 72 },
  { price: 59.99, x: 42, y: 58 },
  { price: 49.99, x: 74, y: 34 },
  { price: 54.99, x: 108, y: 42 },
  { price: 39.99, x: 144, y: 20 },
  { price: 44.99, x: 188, y: 32 },
];

function CompatibilityCard() {
  const [readiness, setReadiness] = useState(100);
  const tilt = useTilt3D(10);

  const n = (readiness - 15) / 85;
  const fps = Math.round(60 + n * 380);
  const temp = Math.round(95 - n * 55);
  const vram = readiness >= 75 ? 'OK' : readiness >= 45 ? 'MID' : 'LOW';
  const vramColor = vram === 'OK' ? 'var(--blue)' : vram === 'MID' ? 'var(--amber)' : 'var(--red)';
  const confidence = readiness >= 85 ? 'High confidence fit' : readiness >= 60 ? 'Balanced readiness' : 'Needs tuned settings';
  const fillStop = Math.max(0, Math.min(100, n * 100 - 2.6));

  return (
    <div
      {...tilt}
      className="rounded-[var(--radius)] border border-card-border bg-card-bg p-8 relative overflow-hidden backdrop-blur-[12px] transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.25)] hover:border-cyan/[0.15]"
      style={{ perspective: '800px' }}
    >
      <div className="relative z-[2] max-w-[400px]">
        <h3 className="text-[1.5rem] font-extrabold uppercase tracking-tighter mb-3">PlayWise Compatibility</h3>
        <p className="text-[var(--text-secondary)] text-[0.92rem] mb-6 max-w-[380px]">Real-time performance metering for your specific hardware stack. Adjust readiness to simulate load.</p>

        <div className="mt-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">System readiness</span>
            <strong className="font-bold text-lime font-mono">{readiness}%</strong>
          </div>
          <input
            type="range"
            min="15"
            max="100"
            value={readiness}
            onChange={(e) => setReadiness(Number(e.target.value))}
            className="pw-range"
            style={{ '--range-fill-stop': `${fillStop}%` }}
          />
          <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted opacity-60">
            <span>Low load</span>
            <span>{confidence}</span>
            <span>Maxed</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-[10px] border border-card-border bg-metric-bg p-3.5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
            <div className="text-[0.7rem] font-extrabold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--blue)' }}>Avg FPS</div>
            <div className="text-[1.3rem] font-extrabold font-mono">{fps}</div>
          </div>
          <div className="rounded-[10px] border border-card-border bg-metric-bg p-3.5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
            <div className="text-[0.7rem] font-extrabold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--red)' }}>Temp</div>
            <div className="text-[1.3rem] font-extrabold font-mono">{temp}&deg;C</div>
          </div>
          <div className="rounded-[10px] border border-card-border bg-metric-bg p-3.5 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)]">
            <div className="text-[0.7rem] font-extrabold uppercase tracking-[0.06em] mb-1 text-muted">VRAM</div>
            <div className="text-[1.3rem] font-extrabold font-mono" style={{ color: vramColor }}>{vram}</div>
          </div>
        </div>
      </div>
      <span className="material-symbols-outlined absolute -bottom-5 -right-5 text-[220px] opacity-[0.03] pointer-events-none">memory</span>
    </div>
  );
}

function ValueTrackingCard() {
  const [percent, setPercent] = useState(72);
  const chartRef = useRef(null);
  const tilt = useTilt3D(10);

  const gMinX = 8, gMaxX = 188, gRange = 180;
  const cx = gMinX + (percent / 100) * gRange;

  // Find segment
  let si = 0;
  for (let i = 0; i < PRICE_TIMELINE.length - 1; i++) {
    if (cx >= PRICE_TIMELINE[i].x && cx <= PRICE_TIMELINE[i + 1].x) { si = i; break; }
  }
  const L = PRICE_TIMELINE[si];
  const R = PRICE_TIMELINE[si + 1] || L;
  const t = R.x === L.x ? 0 : (cx - L.x) / (R.x - L.x);
  const cy = L.y + (R.y - L.y) * t;
  const pv = L.price + (R.price - L.price) * t;

  const linePath = PRICE_TIMELINE.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = linePath + ' L 188 100 L 8 100 Z';
  const fillStop = Math.max(0, Math.min(100, percent - 2.6));

  let direction, dirColor;
  if (R.price > L.price) { direction = 'Price rising'; dirColor = '#ff6b4a'; }
  else if (R.price < L.price) { direction = 'Price dropping'; dirColor = '#a7ff5a'; }
  else { direction = 'Price stable'; dirColor = '#66d9ff'; }

  const handleChartInteraction = useCallback((e) => {
    const rect = chartRef.current.getBoundingClientRect();
    const newPercent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setPercent(newPercent);
  }, []);

  return (
    <div
      {...tilt}
      className="rounded-[var(--radius)] border border-card-border bg-card-bg p-8 relative overflow-hidden backdrop-blur-[12px] transition-all duration-400 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.25)] hover:border-cyan/[0.15]"
      style={{ perspective: '800px' }}
    >
      <div className="flex justify-between items-center mb-4">
        <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--blue)' }}>insights</span>
        <span className="px-[10px] py-[3px] rounded border border-red/20 bg-red/10 text-[10px] font-extrabold uppercase text-red">LIVE DATA</span>
      </div>
      <h3 className="text-[1.5rem] font-extrabold uppercase tracking-tighter mb-3">Price History</h3>
      <p className="text-[var(--text-secondary)] text-[0.92rem] mb-6 max-w-[380px]">See how a game's price has moved over time. Scrub the chart to find the best moment to buy.</p>

      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Scrub anywhere on the graph</span>
        <strong className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: dirColor }}>{direction}</strong>
      </div>

      <div
        ref={chartRef}
        className="relative h-[220px] w-full cursor-crosshair my-3"
        onMouseMove={handleChartInteraction}
        onClick={handleChartInteraction}
      >
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <defs>
            <linearGradient id="grad-chart" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#3ba7ff" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#3ba7ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#grad-chart)" opacity="0.42" />
          <path d={linePath} fill="none" stroke="#3ba7ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          <line x1={cx} x2={cx} y1="10" y2="94" stroke="rgba(255,255,255,0.38)" strokeDasharray="2 3" />
          <circle cx={cx} cy={cy} r="5" fill="#3ba7ff" stroke="#ffffff" strokeWidth="2" />
        </svg>
        <div
          className="absolute pointer-events-none px-3 py-1.5 rounded-lg border border-border bg-tooltip-bg font-mono text-[12px] font-bold shadow-[0_12px_30px_rgba(0,0,0,0.3)] -translate-x-1/2 -translate-y-full z-[5] whitespace-nowrap"
          style={{
            left: `${Math.min(88, Math.max(8, ((cx - gMinX) / gRange) * 100))}%`,
            top: `${Math.max(10, cy - 4)}%`,
          }}
        >
          ${pv.toFixed(2)}
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={percent}
        onChange={(e) => setPercent(Number(e.target.value))}
        className="pw-range pw-range-blue"
        style={{ '--range-fill-stop': `${fillStop}%` }}
      />
      <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted opacity-60">
        <span>Back catalog window</span>
        <span>Live market window</span>
      </div>
    </div>
  );
}

export default function SignalModules() {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  return (
    <section id="signals" className="py-[100px] px-[clamp(1rem,5vw,6rem)] bg-deep transition-[background] duration-[var(--transition-theme)]">
      <div ref={headerRef} className="reveal">
        <div className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-cyan mb-3">
          <span className="w-6 h-0.5 bg-cyan rounded-sm" />
          Built-in Tools
        </div>
        <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold tracking-tight leading-tight mb-4">
          Check before <span className="text-lime">you buy</span>
        </h2>
        <p className="text-muted text-[1.05rem] max-w-[520px]">Test hardware compatibility and track price history for any game in the catalog.</p>
      </div>

      <div ref={gridRef} className="reveal grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-5 mt-12" style={{ transitionDelay: '0.15s' }}>
        <CompatibilityCard />
        <ValueTrackingCard />
      </div>
    </section>
  );
}
