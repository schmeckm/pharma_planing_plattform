export function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

export function rgbToHex(r, g, b) {
  const toHex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** Mischt Akzentfarbe mit Weiß (weight 0 = base, 1 = weiß). */
function mixWithWhite(hex, weight) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.round(r + (255 - r) * weight),
    Math.round(g + (255 - g) * weight),
    Math.round(b + (255 - b) * weight),
  );
}

/** Mischt Akzentfarbe mit Schwarz (weight 0 = base, 1 = schwarz). */
function mixWithBlack(hex, weight) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.round(r * (1 - weight)),
    Math.round(g * (1 - weight)),
    Math.round(b * (1 - weight)),
  );
}

/**
 * Abgestufte Blau-Skala aus einer Akzentfarbe (Tailwind-ähnlich 50–950).
 * @param {string} baseHex
 */
export function deriveBlueScale(baseHex) {
  const base = baseHex.toUpperCase();
  return {
    50: mixWithWhite(base, 0.92),
    100: mixWithWhite(base, 0.84),
    200: mixWithWhite(base, 0.68),
    300: mixWithWhite(base, 0.48),
    400: mixWithWhite(base, 0.24),
    500: base,
    600: mixWithBlack(base, 0.12),
    700: mixWithBlack(base, 0.22),
    800: mixWithBlack(base, 0.34),
    900: mixWithBlack(base, 0.48),
    950: mixWithBlack(base, 0.58),
  };
}

/** CSS-Variablen für Blau-Skala + Akzent-Mapping. */
export function accentCssVars(baseHex) {
  const scale = deriveBlueScale(baseHex);
  return {
    '--blue-50': scale[50],
    '--blue-100': scale[100],
    '--blue-200': scale[200],
    '--blue-300': scale[300],
    '--blue-400': scale[400],
    '--blue-500': scale[500],
    '--blue-600': scale[600],
    '--blue-700': scale[700],
    '--blue-800': scale[800],
    '--blue-900': scale[900],
    '--blue-950': scale[950],
    '--color-accent': scale[500],
    '--color-accent-hover': scale[600],
    '--color-accent-dark': scale[700],
    '--color-accent-soft': scale[100],
    '--color-accent-muted': scale[200],
    '--color-accent-on': '#FFFFFF',
    '--color-info': scale[500],
    '--color-info-soft': scale[50],
    '--color-info-border': scale[200],
    '--color-info-text': scale[800],
    '--color-scope-soft': scale[50],
    '--color-scope-border': scale[200],
    '--color-scope-text': scale[700],
    '--help-highlight': scale[50],
    '--color-risk-ok': scale[500],
    '--color-capacity-ok': scale[600],
    '--color-capacity-cell-ok': scale[50],
    '--chart-color-1': scale[500],
    '--chart-color-2': scale[400],
    '--chart-color-5': scale[400],
  };
}

/** Setzt Blau-Skala auf ein DOM-Element (z. B. documentElement). */
export function applyAccentCssVars(element, baseHex) {
  const vars = accentCssVars(baseHex);
  for (const [key, value] of Object.entries(vars)) {
    element.style.setProperty(key, value);
  }
}

export function deriveAccentVariants(hex) {
  const scale = deriveBlueScale(hex);
  return {
    hover: scale[600],
    soft: scale[100],
    softer: scale[50],
    onAccent: '#FFFFFF',
    scale,
  };
}
