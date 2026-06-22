/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        night: {
          950: '#050816',
          900: '#08111f',
          850: '#0b1526',
          800: '#0f1b31',
          700: '#16243b',
          600: '#22324f',
          500: '#334462'
        },
        ink: {
          100: '#f8fbff',
          200: '#dbe7f7',
          300: '#a8b7ce',
          400: '#73829a',
          500: '#4f5d73'
        },
        brand: {
          blue: '#2f7cf6',
          cyan: '#00d4ff',
          green: '#00e59b',
          amber: '#ffb020',
          red: '#ff4d6d',
          violet: '#8b5cf6',
          pink: '#ff5bbd'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 18px 45px rgba(0, 0, 0, 0.32)',
        blue: '0 0 0 1px rgba(47,124,246,0.18), 0 22px 55px rgba(47,124,246,0.12)'
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        pulseSlow: 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' }
        }
      }
    }
  },
  plugins: []
}
