/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        xeno: {
          black: '#050505',
          core: '#00F5FF',
          accent: '#FF5F00',
          danger: '#FF003C',
          silver: '#E0E0E0',
          glass: 'rgba(255, 255, 255, 0.03)',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hologram': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
      },
      boxShadow: {
        'core-glow': '0 0 100px rgba(0, 245, 255, 0.2), 0 0 40px rgba(0, 245, 255, 0.1)',
        'accent-glow': '0 0 50px rgba(255, 95, 0, 0.15)',
        'glass-hologram': '0 8px 32px 0 rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'core-pulse': 'corePulse 4s ease-in-out infinite',
        'module-orbit': 'moduleOrbit 20s linear infinite',
        'scanline': 'scanline 8s linear infinite',
        'neural-flow': 'neuralFlow 10s linear infinite',
      },
      keyframes: {
        corePulse: {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1) blur(0px)' },
          '50%': { transform: 'scale(1.05)', filter: 'brightness(1.5) blur(1px)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      }
    }
  },
  plugins: []
};
