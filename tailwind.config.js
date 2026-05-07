/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite",
      },
      colors: {
        dark: '#121212',
        darker: '#0a0a0a',
        gold: '#CCA43B',
        goldHover: '#E1B846',
        textMain: '#E5E5E5',
        textMuted: '#A3A3A3',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}