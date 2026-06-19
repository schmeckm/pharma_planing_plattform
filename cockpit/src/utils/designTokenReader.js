/**
 * Liest CSS Custom Properties zur Laufzeit (Chart.js, Canvas).
 * @param {string} name
 * @param {string} [fallback]
 * @param {Element} [root]
 */
export function readCssToken(name, fallback = '', root) {
  if (typeof document === 'undefined') return fallback;
  const el = root || document.documentElement;
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * @param {string} prefix z. B. '--chart-color-'
 * @param {number} count
 * @param {string[]} [fallbacks]
 */
export function readCssTokenSeries(prefix, count, fallbacks = []) {
  return Array.from({ length: count }, (_, index) => {
    const token = `${prefix}${index + 1}`;
    return readCssToken(token, fallbacks[index] ?? '');
  }).filter(Boolean);
}

/**
 * Chart.js-Achsen/Legende an Design-Tokens anbinden.
 * @param {Element} [root]
 */
export function chartJsTheme(root) {
  return {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: readCssToken('--chart-legend-text', '#32363a', root),
          boxWidth: 12,
          padding: 14,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: readCssToken('--chart-axis-text', '#6a6d70', root) },
        grid: { color: readCssToken('--chart-grid', '#e5e5e5', root) },
      },
      y: {
        ticks: { color: readCssToken('--chart-axis-text', '#6a6d70', root) },
        grid: { color: readCssToken('--chart-grid', '#e5e5e5', root) },
      },
    },
  };
}
