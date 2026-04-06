import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Softball season - deep field green palette
        'field': {
          'dark': '#0a0f0d',
          'green': '#0d1f16',
          'mid': '#0f2318',
          'accent': '#22c55e',     // emerald green
          'glow': '#16a34a',
          'clay': '#b45309',       // clay/dirt tone for warmth
        },
        // Keep court- aliases so old refs still compile
        'court': {
          'dark': '#0a0f0d',
          'purple': '#0d1f16',
          'blue': '#0f2318',
          'accent': '#22c55e',
          'orange': '#16a34a',
          'glow': '#15803d',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-field': 'linear-gradient(135deg, #0a0f0d 0%, #0d1f16 50%, #071a10 100%)',
        'gradient-accent': 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(34, 197, 94, 0.25)',
        'glow-green': '0 0 30px rgba(22, 163, 74, 0.2)',
      },
      backdropBlur: {
        'glass': '16px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
export default config
