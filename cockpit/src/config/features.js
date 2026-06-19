import catalog from '@config/featureCatalog.json';

export const FEATURE_CATALOG = catalog.features;
export const FEATURE_SECTION_KEYS = catalog.sectionKeys;

const pathMap = new Map(FEATURE_CATALOG.map((f) => [f.path, f.id]));
const idMap = new Map(FEATURE_CATALOG.map((f) => [f.id, f]));

const ROLE_PERMISSIONS = {
  ADMIN: ['*', 'users:manage', 'rules:write'],
  PLANNER: [
    'orders:read', 'batches:read', 'allocation:simulate', 'allocation:execute',
    'exceptions:read', 'exceptions:comment', 'whatif:run', 'copilot:use',
    'jobs:read', 'jobs:create', 'agents:run', 'rules:read', 'audit:read',
  ],
  QA: [
    'orders:read', 'batches:read', 'exceptions:read', 'exceptions:resolve',
    'audit:read', 'rules:read', 'copilot:use', 'agents:run',
  ],
  SUPPLY_CHAIN: [
    'orders:read', 'batches:read', 'allocation:simulate', 'allocation:execute',
    'exceptions:read', 'exceptions:comment', 'exceptions:escalate',
    'jobs:read', 'jobs:create', 'agents:run', 'whatif:run', 'copilot:use', 'audit:read', 'rules:read',
  ],
  VIEWER: ['orders:read', 'batches:read', 'audit:read', 'rules:read', 'exceptions:read'],
};

function hasRolePermission(role, permission) {
  if (!permission) return true;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

/** Role baseline — mirrors backend featureService.getDefaultFeatureIdsForRole */
export function getDefaultFeatureIdsForRole(role) {
  if (role === 'ADMIN') return FEATURE_CATALOG.map((f) => f.id);
  return FEATURE_CATALOG
    .filter((f) => hasRolePermission(role, f.permission))
    .filter((f) => f.defaultEnabled !== false)
    .map((f) => f.id);
}

/** All feature IDs a role may enable (permission check only). */
export function getPermittedFeatureIdsForRole(role) {
  if (role === 'ADMIN') return FEATURE_CATALOG.map((f) => f.id);
  return FEATURE_CATALOG
    .filter((f) => hasRolePermission(role, f.permission))
    .map((f) => f.id);
}

export function findFirstAccessiblePath(canAccessPath, excludePath = null) {
  for (const feature of FEATURE_CATALOG) {
    if (feature.path === excludePath) continue;
    if (canAccessPath(feature.path)) return feature.path;
  }
  return null;
}

export function getFeatureIdForPath(path) {
  return pathMap.get(path) || null;
}

export function getFeatureById(id) {
  return idMap.get(id) || null;
}

export function groupFeaturesBySection(features = FEATURE_CATALOG) {
  const groups = {};
  for (const feature of features) {
    if (!groups[feature.section]) groups[feature.section] = [];
    groups[feature.section].push(feature);
  }
  return groups;
}
