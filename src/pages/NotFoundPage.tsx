import { Link } from 'react-router-dom'

const quickLinks: Array<{ to: string; label: string; accent: string }> = [
  { to: '/games', label: 'All Games', accent: 'var(--vio)' },
  { to: '/deals', label: 'Deals', accent: 'var(--lime)' },
  { to: '/tournaments', label: 'Tournaments', accent: 'var(--cyan)' },
  { to: '/news', label: 'News', accent: 'var(--amber)' },
]

export default function NotFoundPage() {
  return (
    <section style={{ maxWidth: 1320, margin: '0 auto', padding: '72px 26px 40px', display: 'grid', placeItems: 'center' }}>
      <div
        className="rise"
        style={{
          width: '100%',
          maxWidth: 640,
          textAlign: 'center',
          background: 'var(--card,#1a1630)',
          border: '2.5px solid var(--bd,#f6f4ff)',
          borderRadius: 24,
          boxShadow: '9px 11px 0 var(--hard)',
          padding: 'clamp(34px,6vw,56px) clamp(22px,5vw,48px)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--pink)' }}>
          <span style={{ width: 18, height: 2, background: 'var(--pink)' }} />ERROR 404
        </div>

        <div
          style={{
            fontFamily: 'var(--fd)',
            fontSize: 'clamp(76px,18vw,150px)',
            fontWeight: 800,
            letterSpacing: '-.05em',
            lineHeight: 0.9,
            margin: '16px 0 6px',
            background: 'var(--grad)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          404
        </div>

        <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 14px' }}>
          <span style={{ display: 'inline-block', background: 'var(--lime)', color: '#0b0a12', padding: '0 .14em', border: '3px solid var(--bd)', boxShadow: '5px 5px 0 var(--hard)', transform: 'rotate(-1.5deg)' }}>
            Game over.
          </span>
        </h1>

        <p style={{ fontSize: 'clamp(14px,1.7vw,16px)', color: 'var(--tx2,#aaa3c6)', maxWidth: '42ch', margin: '0 auto', lineHeight: 1.55 }}>
          This page doesn't exist — or it respawned somewhere else. Let's get you back in the action.
        </p>

        <Link
          to="/"
          className="press"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            marginTop: 26,
            fontFamily: 'var(--fd)',
            fontSize: 14.5,
            fontWeight: 800,
            letterSpacing: '-.01em',
            textDecoration: 'none',
            color: '#0b0a12',
            background: 'var(--lime)',
            border: '2.5px solid var(--bd,#f6f4ff)',
            borderRadius: 12,
            padding: '13px 22px',
            cursor: 'pointer',
            boxShadow: '4px 4px 0 var(--hard)',
            transition: 'transform .1s,box-shadow .1s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 9-8 9 8" /><path d="M9 21V12h6v9" /></svg>
          Back to home
        </Link>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 9, marginTop: 30, paddingTop: 26, borderTop: '2px solid var(--line)' }}>
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--ff)',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                color: 'var(--tx,#f6f4ff)',
                background: 'var(--bg,#0b0a12)',
                border: '2px solid var(--line2,#3a3460)',
                borderRadius: 100,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: link.accent, border: '1.5px solid var(--bd,#f6f4ff)' }} />
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
