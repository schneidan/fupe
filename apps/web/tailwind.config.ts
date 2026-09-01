import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        fupe: {
          50: '#f0fdf9',
          100: '#ccfbef',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a',
        },
        pe: {
          flag: '#dc2626',
          bg: '#fef2f2',
        },
      },
    },
  },
  plugins: [],
};

export default config;
