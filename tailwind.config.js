/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        // Azul noche de estadio (reemplaza la escala slate del sitio)
        slate: {
          50: '#f6f8fd',
          100: '#f5f8ff',
          200: '#dce4f5',
          300: '#c3d0ee',
          400: '#b4c2e8',
          500: '#8ea1cc',
          600: '#6e83b8',
          700: '#4a5d8f',
          800: '#25324f',
          900: '#131b30',
          950: '#0b101f'
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
