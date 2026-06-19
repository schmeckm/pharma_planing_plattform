import { FEATURE_CATALOG, FEATURE_SECTION_KEYS } from '../../../../cockpit/src/config/features.js';

const OPTIONAL_SECTION_IDS = ['extended', 'lab'];

const FEATURE_ICONS = {
  dashboard: 'Odometer',
  'daily-planning': 'Calendar',
  orders: 'List',
  analytics: 'TrendCharts',
  'ml-prognosis': 'DataAnalysis',
  reports: 'Document',
  'mass-jobs': 'Operation',
  'what-if': 'MagicStick',
  'time-planning': 'Timer',
  'rules-legacy': 'Notebook',
  'agent-console': 'Cpu',
  'allocation-copilot': 'ChatDotRound',
  'planning-copilot': 'ChatLineRound',
  'executive-cockpit': 'Histogram',
  autopilot: 'Promotion',
};

export function buildOptionalNavSections() {
  return OPTIONAL_SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    labelKey: FEATURE_SECTION_KEYS[sectionId],
    defaultOpen: false,
    items: FEATURE_CATALOG.filter((feature) => feature.section === sectionId).map((feature) => ({
      path: feature.path,
      featureId: feature.id,
      labelKey: feature.labelKey,
      icon: FEATURE_ICONS[feature.id] || 'Document',
      permission: feature.permission || undefined,
    })),
  })).filter((section) => section.items.length > 0);
}
