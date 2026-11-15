module.exports = {
  content: [
    "./*.html",
    "./*.js",
    "./en/**/*.html",
    "./en/**/*.js",
    "./services/**/*.html",
    "./services/**/*.js",
    "./api/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#d4af37',
          500: '#c5a059',
          600: '#b08b43',
          700: '#8c6b2d'
        },
        navy: {
          800: '#0f172a',
          900: '#0a0f1d',
          950: '#05070e'
        }
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif']
      }
    }
  },
  plugins: []
};
