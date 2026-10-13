import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: 'rgb(var(--primary) / <alpha-value>)',
          700: '#1d4ed8',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        violet: 'rgb(var(--violet) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Arial', 'sans-serif'],
        brand: ['var(--font-fredoka)', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
