import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fupe: {
          bg: '#141414',
          surface: '#1c1c1c',
          elevated: '#262626',
          border: '#3a3a3a',
          muted: '#a0a0a0',
          text: '#ffffff',
          accent: '#d4d4d4',
          accentBright: '#ffffff',
          accentDim: '#737373',
        },
        verdict: {
          yes: '#ef4444',
          yesGlow: '#7f1d1d',
          no: '#22c55e',
          noGlow: '#14532d',
        },
      },
      fontFamily: {
        display: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        accent: '0 0 40px -8px rgba(255, 255, 255, 0.12)',
        yes: '0 0 60px -10px rgba(239, 68, 68, 0.5)',
        no: '0 0 60px -10px rgba(34, 197, 94, 0.4)',
      },
      spacing: {
        double: '2rem',
      },
      keyframes: {
        'mic-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.7' },
          '70%': { transform: 'scale(1.35)', opacity: '0' },
          '100%': { transform: 'scale(1.35)', opacity: '0' },
        },
      },
      animation: {
        'mic-pulse': 'mic-pulse 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
