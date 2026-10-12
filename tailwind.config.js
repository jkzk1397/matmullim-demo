/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#1a1d23', 2: '#454b57', 3: '#6b7280', 4: '#9aa0aa' },
        line: { DEFAULT: '#e5e7eb', 2: '#eef0f3' },
        canvas: '#f7f8fa',
        accent: { DEFAULT: '#26407a', 600: '#1f3666', 50: '#eef2f9', 100: '#dde5f3' },
        sev: {
          red: '#b0453c', 'red-bg': '#fbf2f1', 'red-ink': '#8c2f27',
          orange: '#bf7a2e', 'orange-bg': '#fcf5ec', 'orange-ink': '#875215',
          gray: '#7d8491', 'gray-bg': '#f3f4f6', 'gray-ink': '#4a505c',
          yellow: '#b39a2a', 'yellow-bg': '#fbf8e8', 'yellow-ink': '#6e5c10',
        },
      },
      fontSize: {
        meta: ['13px', '20px'],
        body: ['15px', '24px'],
        h2: ['18px', '28px'],
        h1: ['28px', '38px'],
        stat: ['40px', '44px'],
      },
    },
  },
  plugins: [],
};
