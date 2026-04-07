/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ── PlayWise unified palette ── */
        pw: {
          lime: '#b1fa50',
          blue: '#3ba7ff',
          coral: '#ff7351',
          surface: '#0e0e0e',
          panel: '#151515',
          deep: '#060806',
          glass: 'rgba(255,255,255,0.04)',
          'glass-border': 'rgba(255,255,255,0.08)',
          muted: '#888888',
          text: '#f0f0f0',
        },
        /* ── Material-style tokens GamePage uses ── */
        primary: '#b1fa50',
        secondary: '#3ba7ff',
        tertiary: '#ff7351',
        'on-primary': '#0e0e0e',
        'on-surface': '#f0f0f0',
        'surface-container': '#151515',
        'surface-container-high': '#1a1a1a',
        'surface-container-highest': '#222222',
        'outline-variant': 'rgba(255,255,255,0.10)',
        /* ── legacy aliases (keep old code working) ── */
        playwise: {
          ink: '#102033',
          brand: '#eb6d4a',
          accent: '#0f7d75',
          cream: '#f6efe4',
          highlight: '#f0bf63',
        },
        'red-glow': '#b1fa50',
        'red-primary': '#b1fa50',
        'red-dark': '#8cd43a',
        'steel-900': '#0A0A0A',
        'steel-800': '#111111',
        'steel-700': '#1A1A1A',
        'steel-600': '#2C2C2C',
        'steel-500': '#444444',
        'text-primary': '#F0F0F0',
        'text-muted': '#888888',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        heading: ['Manrope', 'sans-serif'],
        headline: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        'jet-mono': ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        playwise: '0 24px 60px rgba(16, 32, 51, 0.12)',
        'glass': '0 8px 32px rgba(0,0,0,0.37)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.45)',
        'neon-lime': '0 0 20px rgba(177,250,80,0.25), 0 0 60px rgba(177,250,80,0.10)',
        'neon-blue': '0 0 20px rgba(59,167,255,0.25), 0 0 60px rgba(59,167,255,0.10)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'glow-breathe': 'glowBreathe 3s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        glitch: 'glitch 0.3s steps(2) 3',
        shimmer: 'shimmer 2.4s linear infinite',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'slide-down': 'slideDown 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fadeIn 0.5s ease both',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'border-spin': 'borderSpin 4s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px #b1fa50, 0 0 20px rgba(177,250,80,0.25)' },
          '50%': { boxShadow: '0 0 16px #b1fa50, 0 0 40px rgba(177,250,80,0.35)' },
        },
        glowBreathe: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        glitch: {
          '0%': { clipPath: 'inset(0 0 95% 0)', transform: 'translate(-4px, 0)' },
          '25%': { clipPath: 'inset(40% 0 50% 0)', transform: 'translate(4px, 0)' },
          '50%': { clipPath: 'inset(70% 0 20% 0)', transform: 'translate(-2px, 0)' },
          '75%': { clipPath: 'inset(10% 0 80% 0)', transform: 'translate(2px, 0)' },
          '100%': { clipPath: 'inset(0 0 0 0)', transform: 'translate(0, 0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        borderSpin: {
          '0%': { '--border-angle': '0deg' },
          '100%': { '--border-angle': '360deg' },
        },
      },
    },
  },
  plugins: [],
}
