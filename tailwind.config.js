/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(210, 90%, 56%)',
          foreground: 'hsl(0, 0%, 100%)'
        },
        secondary: {
          DEFAULT: 'hsl(210, 90%, 46%)',
          foreground: 'hsl(0, 0%, 100%)'
        },
        tertiary: {
          DEFAULT: 'hsl(190, 70%, 48%)',
          foreground: 'hsl(0, 0%, 100%)'
        },
        neutral: {
          DEFAULT: 'hsl(0, 0%, 100%)',
          foreground: 'hsl(222, 14%, 15%)'
        },
        success: 'hsl(145, 63%, 42%)',
        warning: 'hsl(38, 92%, 50%)',
        error: 'hsl(0, 84%, 60%)',
        gray: {
          50: 'hsl(210, 20%, 98%)',
          100: 'hsl(220, 14%, 96%)',
          200: 'hsl(220, 13%, 91%)',
          300: 'hsl(216, 12%, 84%)',
          400: 'hsl(218, 11%, 65%)',
          500: 'hsl(220, 9%, 46%)',
          600: 'hsl(215, 14%, 34%)',
          700: 'hsl(217, 19%, 27%)',
          800: 'hsl(215, 28%, 17%)',
          900: 'hsl(221, 39%, 11%)'
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      spacing: {
        '4': '1rem',
        '8': '2rem',
        '12': '3rem',
        '16': '4rem',
        '24': '6rem',
        '32': '8rem',
        '48': '12rem',
        '64': '16rem'
      },
      borderRadius: {
        'corner': '0.75rem'
      },
      backgroundImage: {
        'gradient-1': 'linear-gradient(135deg, hsl(210, 90%, 56%), hsl(190, 70%, 48%))',
        'gradient-2': 'linear-gradient(180deg, hsl(210, 15%, 96%), hsl(210, 14%, 92%))',
        'button-border-gradient': 'linear-gradient(135deg, hsl(210, 90%, 56%), hsl(190, 70%, 48%))'
      }
    },
  },
  plugins: [],
}
