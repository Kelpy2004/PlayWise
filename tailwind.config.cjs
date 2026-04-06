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
        playwise: {
          ink: '#102033',
          brand: '#eb6d4a',
          accent: '#0f7d75',
          cream: '#f6efe4',
          highlight: '#f0bf63',
        },
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
