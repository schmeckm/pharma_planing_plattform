import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, '..', '..', '..', 'config', 'featureCatalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

const COCKPIT_ROLE_MAP = {
  admin: 'ADMIN',
  user: 'PLANNER',
};

const ROLE_PERMISSIONS = {
  ADMIN: ['*'],
  PLANNER: [
    'orders:read', 'batches:read', 'allocation:simulate', 'allocation:execute',
    'exceptions:read', 'exceptions:comment', 'whatif:run', 'copilot:use',
    'jobs:read', 'jobs:create', 'agents:run', 'rules:read', 'audit:read',
  ],
  QA: ['orders:read', 'batches:read', 'exceptions:read', 'exceptions:resolve', 'audit:read', 'rules:read', 'copilot:use', 'agents:run'],
  SUPPLY_CHAIN: [
    'orders:read', 'batches:read', 'allocation:simulate', 'allocation:execute',
    'exceptions:read', 'exceptions:comment', 'exceptions:escalate',
    'jobs:read', 'jobs:create', 'agents:run', 'whatif:run', 'copilot:use', 'audit:read', 'rules:read',
  ],
  VIEWER: ['orders:read', 'batches:read', 'audit:read', 'rules:read', 'exceptions:read'],
};

function hasPermission(cockpitRole, permission) {
  if (!permission) return true;
  const perms = ROLE_PERMISSIONS[cockpitRole] || [];
  return perms.includes('*') || perms.includes(permission);
}

export function getFeatureCatalog() {
  return catalog;
}

export function getCockpitRole(portalRole) {
  return COCKPIT_ROLE_MAP[portalRole] || 'PLANNER';
}

export function getDefaultFeatureIdsForPortalRole(portalRole) {
  const cockpitRole = getCockpitRole(portalRole);
  if (cockpitRole === 'ADMIN') {
    return catalog.features.map((f) => f.id);
  }
  return catalog.features
    .filter((f) => hasPermission(cockpitRole, f.permission))
    .filter((f) => f.defaultEnabled !== false)
    .map((f) => f.id);
}

export function getPermittedFeatureIdsForPortalRole(portalRole) {
  const cockpitRole = getCockpitRole(portalRole);
  if (cockpitRole === 'ADMIN') {
    return catalog.features.map((f) => f.id);
  }
  return catalog.features
    .filter((f) => hasPermission(cockpitRole, f.permission))
    .map((f) => f.id);
}

export function resolveEnabledFeatureIds(user) {
  const defaults = getDefaultFeatureIdsForPortalRole(user?.role || 'user');
  const custom = user?.preferences?.enabledFeatures;
  if (custom == null) {
    return { enabledFeatureIds: defaults, usesCustomFeatures: false };
  }
  if (!Array.isArray(custom)) {
    return { enabledFeatureIds: defaults, usesCustomFeatures: false };
  }
  const permitted = new Set(getPermittedFeatureIdsForPortalRole(user?.role || 'user'));
  return {
    enabledFeatureIds: custom.filter((id) => permitted.has(id)),
    usesCustomFeatures: true,
  };
}

export function validateEnabledFeatures(enabledFeatures, portalRole) {
  if (enabledFeatures == null) {
    return { ok: true, value: null };
  }
  if (!Array.isArray(enabledFeatures)) {
    return { ok: false, error: 'enabledFeatures must be an array or null' };
  }
  const known = new Set(catalog.features.map((f) => f.id));
  const invalid = enabledFeatures.filter((id) => !known.has(id));
  if (invalid.length) {
    return { ok: false, error: `Unknown feature IDs: ${invalid.join(', ')}` };
  }
  const allowed = new Set(getPermittedFeatureIdsForPortalRole(portalRole));
  const disallowed = enabledFeatures.filter((id) => !allowed.has(id));
  if (disallowed.length) {
    return { ok: false, error: `Features not allowed for role: ${disallowed.join(', ')}` };
  }
  return { ok: true, value: enabledFeatures };
}

export function getProfileFeatureGroups(portalRole) {
  const permitted = new Set(getPermittedFeatureIdsForPortalRole(portalRole));
  const optionalSections = ['extended', 'lab'];

  return optionalSections.map((sectionId) => ({
    id: sectionId,
    titleKey: catalog.sectionKeys[sectionId],
    features: catalog.features.filter(
      (f) => f.section === sectionId && permitted.has(f.id)
    ),
  })).filter((group) => group.features.length > 0);
}
