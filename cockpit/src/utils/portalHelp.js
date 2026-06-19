import catalog from '@config/featureCatalog.json';
import { t } from '@/i18n';
import { FEATURE_PURPOSES } from './helpContent';

const SECTION_ORDER = ['start', 'planning', 'monitoring', 'governance', 'extended', 'lab'];

/** Empfohlener Planer-Workflow — spiegelt die Sidebar-Sektionen im Portal. */
export const PORTAL_WORKFLOW = [
  { featureId: 'daily-wizard', title: 'Lagebild & Tages-Wizard' },
  { featureId: 'line-optimization', title: 'Reihenfolge festlegen' },
  { featureId: 'simulation', title: 'Chargen simulieren' },
  { featureId: 'allocations', title: 'Allokationen prüfen' },
  { featureId: 'confirmed-assignments', title: 'Plan freigeben' },
  { featureId: 'exceptions', title: 'Ausnahmen klären' },
  { featureId: 'audit', title: 'Audit & Abschluss' },
];

/** Zusatzschritte — nur wenn für den Benutzer freigeschaltet. */
export const PORTAL_WORKFLOW_OPTIONAL = [
  { featureId: 'daily-planning', title: 'Tagesplan (Gantt)', insertAfter: 'daily-wizard' },
  { featureId: 'mass-jobs', title: 'Massen-Allokation', insertAfter: 'simulation' },
];

function getFeature(featureId) {
  return catalog.features.find((f) => f.id === featureId) ?? null;
}

function isAccessible(auth, feature) {
  if (!feature) return false;
  if (feature.permission && !auth.hasPermission(feature.permission)) return false;
  if (!auth.hasFeature(feature.id)) return false;
  return auth.canAccessPath(feature.path);
}

/**
 * Workflow-Schritte passend zum Portal-Menü und Benutzer-Freigaben.
 */
export function buildPortalWorkflow(auth, locale = 'de') {
  const core = PORTAL_WORKFLOW.filter((item) => isAccessible(auth, getFeature(item.featureId))).map(
    (item) => {
      const feature = getFeature(item.featureId);
      return {
        featureId: item.featureId,
        title: item.title,
        path: feature.path,
        label: t(locale, feature.labelKey),
      };
    },
  );

  for (const opt of PORTAL_WORKFLOW_OPTIONAL) {
    const feature = getFeature(opt.featureId);
    if (!isAccessible(auth, feature)) continue;
    const insertIdx = core.findIndex((s) => s.featureId === opt.insertAfter);
    const entry = {
      featureId: opt.featureId,
      title: opt.title,
      path: feature.path,
      label: t(locale, feature.labelKey),
    };
    if (insertIdx >= 0) {
      core.splice(insertIdx + 1, 0, entry);
    } else {
      core.push(entry);
    }
  }

  return core.map((step, index) => ({ ...step, step: index + 1 }));
}

/**
 * Seitenliste gruppiert wie im Portal-Sidebar (featureCatalog.json).
 */
export function buildPortalPageGuide(auth, locale = 'de') {
  const groups = [];

  for (const sectionId of SECTION_ORDER) {
    const pages = catalog.features
      .filter((f) => f.section === sectionId)
      .filter((f) => isAccessible(auth, f))
      .map((f) => ({
        path: f.path,
        name: t(locale, f.labelKey),
        purpose: FEATURE_PURPOSES[f.id] ?? '—',
        group: t(locale, catalog.sectionKeys[sectionId]),
        featureId: f.id,
      }));

    if (pages.length) {
      groups.push({
        group: t(locale, catalog.sectionKeys[sectionId]),
        pages,
      });
    }
  }

  return groups;
}

export function flattenPageGuide(pageGuide) {
  return pageGuide.flatMap((g) => g.pages.map((p) => ({ ...p, group: g.group })));
}

/** KI-Module aus helpContent — nur wenn Route für den Benutzer erreichbar. */
export function filterAccessibleModules(auth, modules) {
  return modules.filter((mod) => auth.canAccessPath(mod.path));
}
