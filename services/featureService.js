const path = require('node:path');
const fs = require('node:fs');
const { hasPermission } = require('../middleware/auth');

const catalogPath = path.join(__dirname, '..', 'config', 'featureCatalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

function getCatalog() {
  return catalog;
}

function getFeatureById(id) {
  return catalog.features.find((f) => f.id === id) || null;
}

function getFeatureByPath(routePath) {
  return catalog.features.find((f) => f.path === routePath) || null;
}

function featureAllowedByPermission(role, feature) {
  if (!feature?.permission) return true;
  return hasPermission(role, feature.permission);
}

/** All feature IDs a role may access (permission baseline). */
function getDefaultFeatureIdsForRole(role) {
  if (role === 'ADMIN') return catalog.features.map((f) => f.id);
  return catalog.features
    .filter((f) => featureAllowedByPermission(role, f))
    .filter((f) => f.defaultEnabled !== false)
    .map((f) => f.id);
}

/**
 * Resolved enabled feature IDs for a user.
 * null/undefined enabledFeatures → role defaults (all permitted).
 * [] → explicit custom profile with no features enabled.
 */
function resolveEnabledFeatureIds(user) {
  const role = user?.role || 'VIEWER';
  const defaults = getDefaultFeatureIdsForRole(role);
  const custom = user?.enabledFeatures;
  if (custom == null) return defaults;
  if (!Array.isArray(custom)) return defaults;
  if (custom.length === 0) return [];
  const allowed = new Set(defaults);
  return custom.filter((id) => allowed.has(id));
}

function enrichUserWithFeatures(user) {
  if (!user) return null;
  const enabledFeatureIds = resolveEnabledFeatureIds(user);
  const usesCustomFeatures = Array.isArray(user.enabledFeatures);
  return {
    ...user,
    enabledFeatureIds,
    usesCustomFeatures,
  };
}

function validateFeaturePayload(enabledFeatures) {
  if (enabledFeatures == null) return { ok: true, value: null };
  if (!Array.isArray(enabledFeatures)) {
    return { ok: false, error: 'enabledFeatures must be an array or null' };
  }
  const known = new Set(catalog.features.map((f) => f.id));
  const invalid = enabledFeatures.filter((id) => !known.has(id));
  if (invalid.length) {
    return { ok: false, error: `Unknown feature IDs: ${invalid.join(', ')}` };
  }
  return { ok: true, value: enabledFeatures };
}

module.exports = {
  getCatalog,
  getFeatureById,
  getFeatureByPath,
  getDefaultFeatureIdsForRole,
  resolveEnabledFeatureIds,
  enrichUserWithFeatures,
  validateFeaturePayload,
  featureAllowedByPermission,
};
