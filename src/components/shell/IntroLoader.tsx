import { useEffect, useRef } from 'react'

// Store / esports tokens that fly in during the intro (from the design's _platforms()).
interface Platform {
  color: string
  glyph: string
}

const PLATFORMS: Platform[] = [
  { color: '#16457a', glyph: '<circle cx="13" cy="16" r="7.5" fill="none" stroke="#fff" stroke-width="3"/><path d="M13 16 L22.5 10.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="22.5" cy="10.5" r="4" fill="#fff"/>' },
  { color: '#1b1b1f', glyph: '<path d="M11 7 H21 L22.5 24 L16 27 L9.5 24 Z" fill="#fff"/><rect x="14.2" y="12" width="3.6" height="9" rx="1.4" fill="#1b1b1f"/>' },
  { color: '#5865f2', glyph: '<rect x="5.5" y="9.5" width="21" height="14" rx="7" fill="#fff"/><circle cx="12.5" cy="16.5" r="2.3" fill="#5865f2"/><circle cx="19.5" cy="16.5" r="2.3" fill="#5865f2"/>' },
  { color: '#107c10', glyph: '<circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" stroke-width="3"/><path d="M10.5 9.5 Q16 16 12 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M21.5 9.5 Q16 16 20 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' },
  { color: '#e23150', glyph: '<rect x="7" y="9.5" width="18" height="3.4" rx="1.7" fill="#fff"/><rect x="7" y="14.6" width="14" height="3.4" rx="1.7" fill="#fff"/><rect x="7" y="19.7" width="10" height="3.4" rx="1.7" fill="#fff"/>' },
  { color: '#76b900', glyph: '<path d="M4.5 16 C9 9.5 23 9.5 27.5 16 C23 22.5 9 22.5 4.5 16 Z" fill="#fff"/><circle cx="16" cy="16" r="3.6" fill="#76b900"/>' },
  { color: '#00a7e0', glyph: '<path d="M23 7.5 A10.5 10.5 0 1 0 23 24.5 A7.5 7.5 0 1 1 23 7.5 Z" fill="#fff"/>' },
  { color: '#ff5a00', glyph: '<path d="M9 8.5 L16.5 16 L9 23.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 8.5 L24 16 L16.5 23.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { color: '#13b5a6', glyph: '<path d="M7.5 9 H13 V15 H19 M7.5 23 H13 V17 H19 M19 15 H22 V17" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23.5" cy="16" r="1.8" fill="#fff"/>' },
  { color: '#a24dff', glyph: '<path d="M16 6 L26 24 L16 19 L6 24 Z" fill="#fff"/>' },
]

export default function IntroLoader({ onDone }: { onDone: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const timers: number[] = []
    const T = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      timers.push(id)
      return id
    }
    const soft = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    const stage = stageRef.current
    const card = cardRef.current
    const ring = ringRef.current
    const bar = barRef.current
    let layer: HTMLDivElement | null = null

    const endIntro = () => {
      const o = overlayRef.current
      if (o) {
        o.style.opacity = '0'
        T(() => {
          if (o) o.style.display = 'none'
        }, 700)
      }
      doneRef.current()
    }

    const wave = (color: string, bw: number, size: number, scale: number, dur: number) => {
      if (!stage) return
      const r = document.createElement('div')
      r.style.cssText = `position:absolute;left:50%;top:50%;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;border:${bw}px solid ${color};opacity:.85;pointer-events:none;z-index:4;`
      stage.appendChild(r)
      const an = r.animate(
        [{ transform: 'scale(.25)', opacity: 0.85 }, { transform: `scale(${scale})`, opacity: 0 }],
        { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
      )
      an.onfinish = () => r.remove()
    }

    const launchToken = (p: Platform, theta: number, R: number, dur: number) => {
      if (!layer || !layer.isConnected) return
      const el = document.createElement('div')
      el.style.cssText = `position:absolute;left:50%;top:50%;width:48px;height:48px;border-radius:13px;background:${p.color};border:2.5px solid var(--bd,#f6f4ff);box-shadow:3px 3px 0 rgba(0,0,0,.42);display:grid;place-items:center;opacity:0;will-change:transform,opacity;`
      el.innerHTML = `<svg width="30" height="30" viewBox="0 0 32 32" style="display:block">${p.glyph}</svg>`
      layer.appendChild(el)
      const phi = theta + (Math.random() * 0.5 - 0.25)
      const sx = Math.cos(phi) * 860
      const sy = Math.sin(phi) * 860
      const ox = Math.cos(theta) * R
      const oy = Math.sin(theta) * R
      const b = 'translate(-50%,-50%) '
      el.animate(
        [
          { transform: `${b}translate(${sx}px,${sy}px) scale(.34) rotate(-55deg)`, opacity: 0, offset: 0, easing: 'cubic-bezier(.5,0,.78,.25)' },
          { transform: `${b}translate(${sx * 0.42}px,${sy * 0.42}px) scale(.62) rotate(-22deg)`, opacity: 1, offset: 0.2, easing: 'cubic-bezier(.6,0,.82,.3)' },
          { transform: `${b}translate(0px,0px) scale(1.22) rotate(7deg)`, opacity: 1, offset: 0.6, easing: 'cubic-bezier(.2,.75,.35,1)' },
          { transform: `${b}translate(${ox * 1.18}px,${oy * 1.18}px) scale(.72) rotate(-7deg)`, opacity: 1, offset: 0.8, easing: 'ease-out' },
          { transform: `${b}translate(${ox}px,${oy}px) scale(.86) rotate(0deg)`, opacity: 1, offset: 1 },
        ],
        { duration: dur, fill: 'forwards' }
      )
    }

    const impact = (p: Platform, phi: number, frac: number) => {
      if (!stage || !stage.isConnected) return
      if (bar) bar.style.width = `${Math.round(frac * 150)}px`
      const kick = soft ? 3 : 7
      const pop = soft ? 1.06 : 1.12
      if (card) {
        const cx = Math.cos(phi) * kick
        const cy = Math.sin(phi) * kick
        card.animate(
          [
            { transform: 'translate(0,0) scale(1)' },
            { transform: `translate(${cx}px,${cy}px) scale(${pop})`, offset: 0.4 },
            { transform: 'translate(0,0) scale(1)' },
          ],
          { duration: 230, easing: 'ease-out' }
        )
      }
      wave(p.color, 3, 86, 2.2, 520)
      if (!soft) {
        for (let k = 0; k < 5; k++) {
          const a = phi + Math.PI + (Math.random() * 1.2 - 0.6)
          const d = 58 + Math.random() * 40
          const sz = 5 + Math.random() * 4
          const s = document.createElement('div')
          s.style.cssText = `position:absolute;left:50%;top:50%;width:${sz}px;height:${sz}px;background:${p.color};border:1.5px solid var(--bd,#f6f4ff);border-radius:2px;pointer-events:none;z-index:4;`
          stage.appendChild(s)
          const an = s.animate(
            [
              { transform: 'translate(-50%,-50%) translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
              { transform: `translate(-50%,-50%) translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(.4) rotate(${Math.random() * 220 - 110}deg)`, opacity: 0 },
            ],
            { duration: 420 + Math.random() * 160, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
          )
          an.onfinish = () => s.remove()
        }
      }
    }

    const finale = () => {
      if (!stage || !stage.isConnected) return
      const f = document.createElement('div')
      f.style.cssText = 'position:absolute;left:50%;top:50%;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(255,255,255,0) 66%);opacity:0;pointer-events:none;z-index:6;'
      stage.appendChild(f)
      const fScale = soft ? 8 : 12
      const fPulse = soft ? 1.12 : 1.24
      const fa = f.animate(
        [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 0.92, offset: 0.18 }, { transform: `scale(${fScale})`, opacity: 0 }],
        { duration: 580, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }
      )
      fa.onfinish = () => f.remove()
      wave('var(--bd,#f6f4ff)', 4, 96, 3.1, 640)
      wave('var(--pink,#ff2e6e)', 3, 96, 2.4, 520)
      if (card) card.animate([{ transform: 'scale(1)' }, { transform: `scale(${fPulse})`, offset: 0.32 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1.1)' })
      if (!soft) stage.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(2px,1px)' }, { transform: 'translate(0,0)' }], { duration: 210, easing: 'ease-out' })
      if (layer) layer.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(30deg)' }], { duration: 1100, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' })
    }

    if (!stage) {
      if (bar) bar.style.width = '150px'
      T(endIntro, 760)
      return () => timers.forEach(clearTimeout)
    }

    layer = document.createElement('div')
    layer.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:3;'
    stage.appendChild(layer)
    if (ring) ring.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, fill: 'forwards' })
    if (card)
      card.animate(
        [
          { transform: 'scale(.2) rotate(-14deg)', opacity: 0, offset: 0 },
          { transform: 'scale(1.14) rotate(3deg)', opacity: 1, offset: 0.62 },
          { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 1 },
        ],
        { duration: 440, easing: 'cubic-bezier(.2,.8,.3,1.2)', fill: 'backwards' }
      )

    const N = PLATFORMS.length
    const TAU = Math.PI * 2
    const R = 104
    const dur = 580
    const LAUNCH0 = 360
    const STAG = 200
    let lastImpact = 0
    PLATFORMS.forEach((p, i) => {
      const theta = -Math.PI / 2 + i * (TAU / N)
      const launchAt = LAUNCH0 + i * STAG
      const impactAt = launchAt + dur * 0.6
      lastImpact = Math.max(lastImpact, impactAt)
      T(() => launchToken(p, theta, R, dur), launchAt)
      T(() => impact(p, theta, (i + 1) / N), impactAt)
    })
    const finaleAt = lastImpact + 150
    T(finale, finaleAt)
    T(endIntro, finaleAt + 640)

    return () => {
      timers.forEach(clearTimeout)
      if (layer && layer.parentNode) layer.remove()
    }
  }, [])

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'var(--bg,#0b0a12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        transition: 'opacity .65s ease',
      }}
    >
      <div ref={stageRef} style={{ position: 'relative', width: 160, height: 160, display: 'grid', placeItems: 'center', overflow: 'visible', zIndex: 5 }}>
        <div ref={ringRef} style={{ position: 'absolute', inset: 0, animation: 'pw-spinSlow 7s linear infinite' }}>
          <span style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 18, height: 18, borderRadius: 4, background: 'var(--pink)', border: '2px solid var(--bd)' }} />
          <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--cyan)', border: '2px solid var(--bd)' }} />
          <span style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: 4, background: 'var(--lime)', border: '2px solid var(--bd)' }} />
          <span style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', background: 'var(--amber)', border: '2px solid var(--bd)' }} />
        </div>
        <div ref={cardRef} style={{ position: 'relative', zIndex: 1, width: 100, height: 100, borderRadius: 26, background: 'var(--card,#1a1630)', border: '3px solid var(--bd,#f6f4ff)', boxShadow: '7px 7px 0 var(--pink)', display: 'grid', placeItems: 'center' }}>
          <svg width="46" height="46" viewBox="0 0 48 48">
            <defs>
              <linearGradient id="introGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ff2e6e" />
                <stop offset=".5" stopColor="#a24dff" />
                <stop offset="1" stopColor="#1fd7ff" />
              </linearGradient>
            </defs>
            <path d="M18 13 L36 24 L18 35 Z" fill="url(#introGrad)" />
          </svg>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--fd)', fontSize: 38, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}>
          PLAY<span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>WISE</span>
        </div>
        <div style={{ display: 'inline-block', marginTop: 14, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: '#0b0a12', background: 'var(--lime)', padding: '6px 13px', borderRadius: 7, border: '2px solid var(--bd)', transform: 'rotate(-2deg)' }}>
          NO MORE SITE-HOPPING
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div ref={barRef} style={{ width: 0, height: 10, background: 'var(--grad)', border: '2px solid var(--bd)', borderRadius: 6, transition: 'width .26s cubic-bezier(.2,.7,.3,1)' }} />
        <div style={{ width: 60, height: 10, border: '2px solid var(--line2)', borderRadius: 6 }} />
      </div>
    </div>
  )
}
