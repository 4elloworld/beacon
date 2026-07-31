/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        ink2: 'var(--ink2)',
        ink3: 'var(--ink3)',
        ink4: 'var(--ink4)',
        ink5: 'var(--ink5)',
        parchment: 'var(--parchment)',
        parchment2: 'var(--parchment2)',
        parchment3: 'var(--parchment3)',
        gold: 'var(--gold)',
        gold2: 'var(--gold2)',
        gold3: 'var(--gold3)',
        'gold-light': 'var(--gold-light)',
        amber: 'var(--amber)',
        'amber-light': 'var(--amber-light)',
        green: 'var(--green)',
        green2: 'var(--green2)',
        'green-light': 'var(--green-light)',
        red: 'var(--red)',
        'red-light': 'var(--red-light)',
        blue: 'var(--blue)',
        'blue-light': 'var(--blue-light)',
        border: 'var(--border)',
        border2: 'var(--border2)',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        beacon: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};
