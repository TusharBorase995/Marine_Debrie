/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Marine Blue Palette
        marine: {
          50: '#F0F7FD',
          100: '#E0F0FA',
          200: '#BAE0F5',
          300: '#7CC4ED',
          400: '#38A5E2',
          500: '#0E87D0',
          600: '#0284C7',
          700: '#026AA7',
          800: '#035587',
          900: '#0B3B60',
          950: '#062540',
        },
        // Deep Navy Text and Accents
        navy: {
          700: '#1E293B',
          800: '#132238',
          900: '#0B192C',
          950: '#060E1A',
        },
        // Override Indigo to Ocean Blue across entire app
        indigo: {
          50: '#EAF2FD',
          100: '#E0F0FA',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#026AA7',
          800: '#035587',
          900: '#0B3B60',
          950: '#062540',
        },
        brand: {
          bg: '#F4F7FB',
          card: '#FFFFFF',
          sidebar: '#FFFFFF',
          border: '#E5EDF5',
          'border-subtle': '#EDF3F9',
          primary: '#0B3B60',
          accent: '#0284C7',
          cyan: '#06B6D4',
          active: '#EAF2FD',
          'active-text': '#026AA7',
          emerald: '#10B981',
          'emerald-light': '#ECFDF5',
          amber: '#F59E0B',
          'amber-light': '#FEF3C7',
          red: '#EF4444',
          'red-light': '#FEE2E2',
          text: '#0B192C',
          'text-secondary': '#64748B',
          'text-muted': '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['Inter', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 2px 14px -3px rgba(11, 25, 44, 0.05), 0 4px 6px -4px rgba(11, 25, 44, 0.03)',
        card: '0 1px 3px 0 rgba(11, 25, 44, 0.04), 0 1px 2px -1px rgba(11, 25, 44, 0.03)',
        '2xs': '0 1px 2px 0 rgba(11, 25, 44, 0.03)',
        glow: '0 0 18px rgba(2, 132, 199, 0.22)',
      }
    },
  },
  plugins: [],
}
