import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './features/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        blush: 'rgb(var(--c-blush) / <alpha-value>)', soft: 'rgb(var(--c-soft) / <alpha-value>)', cream: 'rgb(var(--c-cream) / <alpha-value>)',
        rose: 'rgb(var(--c-rose) / <alpha-value>)', lavender: 'rgb(var(--c-lavender) / <alpha-value>)', mint: 'rgb(var(--c-mint) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)', muted: 'rgb(var(--c-muted) / <alpha-value>)', surface: 'rgb(var(--c-surface) / <alpha-value>)',
      },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'], display: ['var(--font-display)', 'Georgia', 'serif'], hand: ['var(--font-hand)', 'cursive'] },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem' },
      boxShadow: { soft: '0 8px 30px -12px rgb(var(--c-rose) / 0.35)', card: '0 2px 14px -6px rgb(var(--c-ink) / 0.18)' },
    },
  },
  plugins: [],
};
export default config;
