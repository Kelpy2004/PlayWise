/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        playwise: {
          ink: '#102033',
          brand: '#eb6d4a',
          accent: '#0f7d75',
          cream: '#f6efe4',
          highlight: '#f0bf63'
        }
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
