import { readCssToken, readCssTokenSeries, chartJsTheme } from './designTokenReader';

const CHART_FALLBACKS = [
  '#4169e1', '#107e3e', '#e9730c', '#bb0000', '#5899da',
  '#df6e27', '#a100c2', '#6a6d70',
];

const EXTENDED_FALLBACKS = [
  ...CHART_FALLBACKS,
  '#188918', '#d04343', '#8859ff', '#0070f2', '#2b7d2b',
  '#5b738b', '#bb5486', '#f0ab00', '#4fb3d4', '#788fa6',
  '#dc7474', '#84c754',
];

const RISK_TIER_TOKENS = {
  LOW: '--color-capacity-ok',
  MEDIUM: '--color-risk-medium',
  HIGH: '--color-risk-high',
};

/**
 * Returns one distinct color per segment (legends, donuts).
 * @param {number} count
 * @param {Element} [root]
 * @returns {string[]}
 */
export function qualitativeChartColors(count, root) {
  if (count <= 0) return [];

  const fromTokens = readCssTokenSeries('--chart-color-', Math.min(count, 8), CHART_FALLBACKS);
  if (count <= fromTokens.length) {
    return fromTokens.slice(0, count);
  }

  const palette = [...fromTokens];
  for (let index = fromTokens.length; index < count; index += 1) {
    if (index < EXTENDED_FALLBACKS.length) {
      palette.push(EXTENDED_FALLBACKS[index]);
    } else {
      const hue = Math.round((index * 137.508) % 360);
      palette.push(`hsl(${hue}, 48%, 42%)`);
    }
  }
  return palette;
}

/** Monochrome Blautöne für Multi-Series (500 → 300). */
export function blueScaleChartColors(count, root) {
  const steps = [500, 400, 600, 300, 700, 200, 800, 100];
  return steps.slice(0, count).map((step) =>
    readCssToken(`--blue-${step}`, CHART_FALLBACKS[0], root),
  );
}

/** Primärfarbe für Single-Series Charts. */
export function chartPrimaryColor(root) {
  return readCssToken('--blue-500', readCssToken('--color-accent', CHART_FALLBACKS[0], root), root);
}

/** Sekundäre Serie (Vergleich, historisch). */
export function chartNeutralColor(root) {
  return readCssToken('--chart-color-neutral', '#64748b', root);
}

/** Gedämpfte Sekundärfarbe (Vergleichsbalken). */
export function chartSecondaryColor(root) {
  return readCssToken('--chart-color-secondary', '#94a3b8', root);
}

/** Freie Kapazität / neutraler Balkenanteil. */
export function chartFreeCapacityColor(root) {
  return readCssToken('--chart-color-free', '#e2e8f0', root);
}

/** Chart-Farbe an Index (1-basiert, entspricht --chart-color-N). */
export function chartColorAt(index, root) {
  return readCssToken(`--chart-color-${index}`, CHART_FALLBACKS[index - 1] ?? CHART_FALLBACKS[0], root);
}

/** Farbe für Risiko-Tier (LOW | MEDIUM | HIGH). */
export function riskTierColor(tier, root) {
  const token = RISK_TIER_TOKENS[tier] || RISK_TIER_TOKENS.LOW;
  return readCssToken(token, CHART_FALLBACKS[1], root);
}

/** Donut-Palette LOW → MEDIUM → HIGH. */
export function riskTierPalette(root) {
  return ['LOW', 'MEDIUM', 'HIGH'].map((tier) => riskTierColor(tier, root));
}

/** Kapazitäts-Ampel nach Auslastung in Prozent. */
export function capacityUtilColor(utilPercent, root) {
  if (utilPercent > 85) return readCssToken('--color-capacity-critical', '#bb0000', root);
  if (utilPercent > 70) return readCssToken('--color-capacity-high', '#e9730c', root);
  return readCssToken('--color-capacity-ok', '#107e3e', root);
}

/** Standard-Dataset-Farben für Forecast-Vergleiche. */
export function chartComparisonColors(root) {
  return {
    primary: chartPrimaryColor(root),
    secondary: chartSecondaryColor(root),
    success: readCssToken('--color-capacity-ok', '#107e3e', root),
  };
}

/**
 * Chart.js-Optionen mit Theme-Basis zusammenführen.
 * @param {object} overrides
 * @param {Element} [root]
 */
export function mergeChartOptions(overrides = {}, root) {
  const theme = chartJsTheme(root);
  return {
    ...theme,
    ...overrides,
    plugins: {
      ...theme.plugins,
      ...overrides.plugins,
      legend: {
        ...theme.plugins.legend,
        ...overrides.plugins?.legend,
        labels: {
          ...theme.plugins.legend.labels,
          ...overrides.plugins?.legend?.labels,
        },
      },
    },
    scales: overrides.scales
      ? {
          ...theme.scales,
          ...Object.fromEntries(
            Object.entries(overrides.scales).map(([axis, scale]) => [
              axis,
              {
                ...(theme.scales[axis] || {}),
                ...scale,
                ticks: { ...(theme.scales[axis]?.ticks || {}), ...scale.ticks },
                grid: { ...(theme.scales[axis]?.grid || {}), ...scale.grid },
                title: scale.title,
              },
            ]),
          ),
        }
      : theme.scales,
  };
}

/** @deprecated Nutze chartPrimaryColor() */
export const SAP_CHART_PRIMARY = CHART_FALLBACKS[0];
