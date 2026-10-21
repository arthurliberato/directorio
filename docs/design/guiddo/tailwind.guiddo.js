// Guiddo theme for Tailwind (Lovable / shadcn projects). Merge into tailwind.config.{js,ts}:
//   const guiddo = require('./tailwind.guiddo.js');
//   module.exports = { ...config, theme: { ...config.theme, extend: { ...config.theme?.extend, ...guiddo } } };
// Load tokens.css globally too (component classes + CSS variables).

module.exports = {
  colors: {
    paper: '#FFF7F0',
    ink: '#1A2A4C',
    blue: {
      DEFAULT: '#5E9BD6', // logo d, accents, large text only on paper
      ink: '#2F6DAB',     // small blue text on paper (AA)
      pale: '#DDE8F4',    // hero, tinted surfaces
      pattern: '#C6D7EA', // i-pattern on pale
    },
    card: '#FFFDF9',
    line: '#E7DED6',
    navy: { tone: '#24375F', pattern: '#2A3C61' },
  },
  fontFamily: {
    logo: ['Nunito', 'system-ui', 'sans-serif'],
    display: ['Nunito', 'system-ui', 'sans-serif'],
    sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
    mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
  },
  lineHeight: { body: '1.25', long: '1.35', display: '1.02' },
  borderRadius: { DEFAULT: '6px', sm: '4px' },
  letterSpacing: { logo: '-0.05em', display: '-1.2px', label: '0.2px' },
};
