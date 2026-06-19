/** Portal-Blau (#4169E1) — Standard-Akzent, muss mit --brand-sap-blue in styles/design-tokens.css übereinstimmen */
export const DEFAULT_ACCENT_COLOR = '#4169E1';

/** Frühere System-Defaults und Grün-Presets — werden auf DEFAULT_ACCENT_COLOR migriert */
export const LEGACY_DEFAULT_ACCENTS = new Set([
  '#007F58',
  '#006347',
  '#007680',
  '#059669',
  '#0A6ED1',
  '#0055FF',
]);

export const ACCENT_PRESETS = [  { id: 'sap', labelKey: 'profile.accent.sap', color: '#4169E1' },
  { id: 'mckinsey', labelKey: 'profile.accent.mckinsey', color: '#007F58' },
  { id: 'forest', labelKey: 'profile.accent.forest', color: '#006347' },
  { id: 'teal', labelKey: 'profile.accent.teal', color: '#007680' },
  { id: 'emerald', labelKey: 'profile.accent.emerald', color: '#059669' },
  { id: 'vivid', labelKey: 'profile.accent.vivid', color: '#0055FF' },
  { id: 'classic-sap', labelKey: 'profile.accent.classicSap', color: '#0A6ED1' },
];

export function isValidAccentColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value || ''));
}

export function normalizeAccentColor(value) {
  return isValidAccentColor(value) ? value.toUpperCase() : DEFAULT_ACCENT_COLOR;
}

/** Migriert alte Standard-Akzente auf das aktuelle Portal-Blau. */
export function resolveAccentColor(value) {
  const normalized = normalizeAccentColor(value);
  if (LEGACY_DEFAULT_ACCENTS.has(normalized)) {
    return DEFAULT_ACCENT_COLOR;
  }
  return normalized;
}