/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/chrome-ext/**/*.{html,js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3f50b5',
          surface: '#202124',
          surfaceLight: '#f5f5f5',
        },
      },
    },
  },
  plugins: [],
};
