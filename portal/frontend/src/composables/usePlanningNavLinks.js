import { computed } from 'vue';
import catalog from '../../../../config/featureCatalog.json';
import { MESSAGES } from '../../../../cockpit/src/i18n/messages.js';
import { useLocaleStore } from '../stores/localeStore';
import { useAuthStore as usePortalAuthStore } from '../stores/authStore';
import { useAuthStore as useCockpitAuthStore } from '../../../../cockpit/src/stores/auth.js';
import { PLANNING_PREFIX } from '../cockpit/pathUtils.js';

const VISIBLE_SECTIONS = ['start', 'planning', 'monitoring', 'governance'];
const OPTIONAL_SECTIONS = ['extended', 'lab'];

function resolveLabel(labelKey, locale) {
  const lang = locale === 'de' ? 'de' : 'en';
  const parts = labelKey.split('.');
  let node = MESSAGES[lang] || MESSAGES.en;
  for (const part of parts) {
    node = node?.[part];
  }
  return node || labelKey;
}

function resolveSectionTitle(sectionKey, locale) {
  const lang = locale === 'de' ? 'de' : 'en';
  const key = catalog.sectionKeys[sectionKey];
  if (!key) return sectionKey;
  const parts = key.split('.');
  let node = MESSAGES[lang] || MESSAGES.en;
  for (const part of parts) {
    node = node?.[part];
  }
  return node || sectionKey;
}

export function usePlanningNavLinks() {
  const localeStore = useLocaleStore();
  const portalAuth = usePortalAuthStore();
  const cockpitAuth = useCockpitAuthStore();

  return computed(() => {
    if (!portalAuth.isAuthenticated) {
      return [];
    }

    const sections = [];
    const sectionMap = new Map();

    for (const feature of catalog.features) {
      const isOptional = OPTIONAL_SECTIONS.includes(feature.section);
      if (isOptional && !cockpitAuth.hasFeature(feature.id)) {
        continue;
      }
      if (feature.section === 'lab' && cockpitAuth.role !== 'ADMIN') {
        continue;
      }
      if (!cockpitAuth.canAccessPath(feature.path)) {
        continue;
      }

      if (!VISIBLE_SECTIONS.includes(feature.section) && !isOptional) {
        continue;
      }

      if (!sectionMap.has(feature.section)) {
        sectionMap.set(feature.section, {
          id: feature.section,
          title: resolveSectionTitle(feature.section, localeStore.locale),
          links: [],
        });
      }

      sectionMap.get(feature.section).links.push({
        to: `${PLANNING_PREFIX}${feature.path}`,
        label: resolveLabel(feature.labelKey, localeStore.locale),
        edition: feature.edition || null,
      });
    }

    for (const sectionId of [...VISIBLE_SECTIONS, ...OPTIONAL_SECTIONS]) {
      const section = sectionMap.get(sectionId);
      if (section?.links.length) {
        sections.push(section);
      }
    }

    return sections;
  });
}
