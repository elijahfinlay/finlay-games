import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: '#0f0f23',
          surface: '#1a1a2e',
          border: '#2d2d44',
          text: '#e0e0e0',
          muted: '#7a7a8e',
          accent: '#00ff41',
          'accent-dim': '#00cc33',
          red: '#EF4444',
          blue: '#3B82F6',
          green: '#22C55E',
          yellow: '#EAB308',
          purple: '#A855F7',
          orange: '#F97316',
          pink: '#EC4899',
          cyan: '#06B6D4',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 255, 65, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 65, 0.6)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
