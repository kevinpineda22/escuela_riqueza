/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite",
      },
      colors: {
        // Paleta original, FIJA en ambos temas. Se mantiene durante la
        // migración; lo nuevo usa los roles semánticos de abajo. `text-darker`
        // sobre oro es tinta de marca: su reemplazo es `text-on-brand`.
        dark: '#121212',
        darker: '#0a0a0a',
        gold: '#CCA43B',
        goldHover: '#E1B846',
        textMain: '#E5E5E5',
        textMuted: '#A3A3A3',

        // Roles semánticos: los valores por tema viven en src/index.css.
        surface: {
          page: 'var(--surface-page)',
          panel: 'var(--surface-panel)',
          subtle: 'var(--surface-subtle)',
          input: 'var(--surface-input)',
          popover: 'var(--surface-popover)',
        },
        foreground: {
          DEFAULT: 'var(--foreground)',
          strong: 'var(--foreground-strong)',
          muted: 'var(--foreground-muted)',
          placeholder: 'var(--foreground-placeholder)',
        },
        // Tinta de tintes y bordes translúcidos: blanco en oscuro, cálida en claro.
        ink: 'var(--ink)',
        // Texto translúcido: `text-white/N` ⇒ `text-fg-N` (nunca `text-ink/N`).
        fg: {
          90: 'var(--fg-90)',
          85: 'var(--fg-85)',
          80: 'var(--fg-80)',
          70: 'var(--fg-70)',
          65: 'var(--fg-65)',
          60: 'var(--fg-60)',
          55: 'var(--fg-55)',
          50: 'var(--fg-50)',
          40: 'var(--fg-40)',
          30: 'var(--fg-30)',
          25: 'var(--fg-25)',
          20: 'var(--fg-20)',
          15: 'var(--fg-15)',
        },
        line: {
          subtle: 'var(--line-subtle)',
          control: 'var(--line-control)',
        },
        brand: {
          DEFAULT: 'var(--brand-fill)',
          hover: 'var(--brand-fill-hover)',
        },
        'on-brand': 'var(--on-brand)',
        accent: {
          DEFAULT: 'var(--accent-foreground)',
          hover: 'var(--accent-foreground-hover)',
        },
        focus: 'var(--focus-ring)',
        gilt: {
          start: 'var(--gilt-start)',
          mid: 'var(--gilt-mid)',
          end: 'var(--gilt-end)',
        },
        media: {
          surface: 'var(--media-surface)',
          foreground: 'var(--media-foreground)',
          muted: 'var(--media-muted)',
        },
        scrim: 'var(--scrim)',
        success: {
          DEFAULT: 'var(--success)',
          surface: 'var(--success-surface)',
          line: 'var(--success-line)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          surface: 'var(--warning-surface)',
          line: 'var(--warning-line)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          surface: 'var(--danger-surface)',
          line: 'var(--danger-line)',
        },
        info: {
          DEFAULT: 'var(--info)',
          surface: 'var(--info-surface)',
          line: 'var(--info-line)',
        },
        violet: {
          DEFAULT: 'var(--violet)',
          surface: 'var(--violet-surface)',
          line: 'var(--violet-line)',
        },
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
