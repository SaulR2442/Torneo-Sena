/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        sena: { 500: '#34d399', 600: '#10b981', 700: '#059669' }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
