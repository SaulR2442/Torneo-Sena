/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // Azul noche de estadio (reemplaza la escala slate del sitio)
        slate: {
          50: '#f6f8fd',
          100: '#eef2fa',
          200: '#dce4f5',
          300: '#c3cfe9',
          400: '#9fb0d4',
          500: '#7b8db5',
          600: '#3d4f80',
          700: '#2b3a63',
          800: '#1a2440',
          900: '#10182a',
          950: '#0b0f19'
        },
        // Dorado trofeo (reemplaza la escala emerald del sitio)
        emerald: {
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f'
        },
        sena: { 500: '#f59e0b', 600: '#d97706', 700: '#b45309' }
      },
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'system-ui', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};
