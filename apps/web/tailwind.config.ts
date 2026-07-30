import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fx: {
          orange: '#E86030',
          'orange-hover': '#D05020',
          'orange-light': '#F07848',
          bg: 'var(--fx-bg)',
          surface: 'var(--fx-surface)',
          'surface-2': 'var(--fx-surface-2)',
          'surface-3': 'var(--fx-surface-3)',
          border: 'var(--fx-border)',
          'border-2': 'var(--fx-border-2)',
          text: 'var(--fx-text)',
          'text-muted': 'var(--fx-text-muted)',
          'text-dim': 'var(--fx-text-dim)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        ios: '28px',
        'ios-sm': '18px',
        'ios-xs': '12px',
      },
      boxShadow: {
        'orange-glow': '0 0 28px rgba(232, 96, 48, 0.40)',
        'orange-glow-sm': '0 0 14px rgba(232, 96, 48, 0.28)',
        card: '0 4px 32px rgba(0, 0, 0, 0.6)',
        'card-orange': '0 8px 40px rgba(232, 96, 48, 0.35)',
        'ios-nav': '0 -1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.34, 1.26, 0.64, 1)',
        'pulse-orange': 'pulseOrange 2.4s cubic-bezier(0.4,0,0.6,1) infinite',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.26, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseOrange: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(232, 96, 48, 0.5)' },
          '50%': { boxShadow: '0 0 0 12px rgba(232, 96, 48, 0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
