/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#f8faf7",
        'surface-container-lowest': "#ffffff",
        'surface-container-highest': "#e1e3e0",
        'surface-container-low': "#f1f3f0", // Dodane z "The Botanical Archivist" surface-container-low
        primary: "#00342b",
        'primary-container': "#004d40",
        'on-primary': "#ffffff",
        'on-surface': "#00342b", 
        'on-surface-variant': "#3f4945",
        'outline-variant': "rgba(63, 73, 69, 0.15)", // Outline do dostępności (Ghost border) 15% opacity
        error: "#ba1a1a",
        'on-error': "#ffffff"
      },
      fontFamily: {
        headline: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        // Blur 24px, Spread -4px, Opacity 6%, color: on_surface (0, 52, 43)
        'ambient': '0 0px 24px -4px rgba(0, 52, 43, 0.06)', 
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #00342b, #004d40)',
      }
    },
  },
  plugins: [],
}
