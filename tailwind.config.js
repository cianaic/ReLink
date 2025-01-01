/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1a73e8',
          hover: '#1557b0',
        },
      },
      gridTemplateColumns: {
        'layout': '250px 1fr',
      },
    },
  },
  plugins: [],
}

