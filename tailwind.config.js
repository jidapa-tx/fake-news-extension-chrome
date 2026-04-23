/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        'trust-blue': '#1E40AF',
        'danger-red': '#DC2626',
        'verified-green': '#059669',
      },
      fontFamily: {
        thai: ['IBM Plex Sans Thai', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
