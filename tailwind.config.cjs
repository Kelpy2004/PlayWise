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
        display: ['Space Grotesk', 'sans-serif']
      },
      boxShadow: {
        playwise: '0 24px 60px rgba(16, 32, 51, 0.12)'
      }
    }
  },
  plugins: []
  
}
