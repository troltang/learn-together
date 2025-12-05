/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'kid-blue': '#4CC9F0',
        'kid-pink': '#F72585',
        'kid-yellow': '#FDC500',
        'kid-green': '#06D6A0',
        'kid-purple': '#7209B7',
      },
      fontFamily: {
        sans: ['"ZCOOL KuaiLe"', '"Fredoka"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}