/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--color-${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: token('surface'),
        'surface-container-lowest': token('surface-container-lowest'),
        'surface-container-low': token('surface-container-low'),
        'surface-container': token('surface-container'),
        'surface-container-high': token('surface-container-high'),
        'surface-container-highest': token('surface-container-highest'),
        primary: token('primary'),
        'primary-container': token('primary-container'),
        'on-primary': token('on-primary'),
        'on-surface': token('on-surface'),
        'on-surface-variant': token('on-surface-variant'),
        'outline-variant': token('outline-variant'),
        error: token('error'),
        'on-error': token('on-error'),
        'macro-protein': token('macro-protein'),
        'macro-fat': token('macro-fat'),
        'macro-carbs': token('macro-carbs'),
        today: token('today'),
        'on-today': token('on-today')
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'ambient': '0 0px 24px -4px rgb(var(--color-shadow) / var(--shadow-ambient-opacity))',
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-primary-container)))',
      }
    },
  },
  plugins: [],
}
