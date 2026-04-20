/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', 'monospace'],
      },
      boxShadow: {
        brutal: '6px 6px 0px #000000',
        'brutal-sm': '4px 4px 0px #000000',
        'brutal-lg': '8px 8px 0px #000000',
        'brutal-red': '6px 6px 0px #dc2626',
        'brutal-green': '6px 6px 0px #15803d',
      },
    },
  },
  plugins: [],
}
