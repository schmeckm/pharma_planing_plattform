import {
  getFeatureCatalog,
  getDefaultFeatureIdsForPortalRole,
  getProfileFeatureGroups,
  resolveEnabledFeatureIds,
  validateEnabledFeatures,
} from './featureCatalogService.js';
import { serializeUser } from './authService.js';
import { User } from '../models/index.js';

export async function getFeatureProfile(user) {
  const { enabledFeatureIds, usesCustomFeatures } = resolveEnabledFeatureIds(user);
  return {
    catalog: getFeatureCatalog(),
    defaultFeatureIds: getDefaultFeatureIdsForPortalRole(user.role),
    enabledFeatureIds,
    usesCustomFeatures,
    groups: getProfileFeatureGroups(user.role),
  };
}

export async function updateUserProfile(userId, patch) {
  const user = await User.findByPk(userId);
  if (!user) {
    return null;
  }

  const nextPreferences = { ...(user.preferences || {}) };

  if (patch.accentColor !== undefined) {
    const ACCENT_PATTERN = /^#[0-9A-Fa-f]{6}$/;
    const color = String(patch.accentColor || '').trim();
    if (!ACCENT_PATTERN.test(color)) {
      const err = new Error('Ungültige Akzentfarbe');
      err.code = 'profile.invalidAccentColor';
      throw err;
    }
    nextPreferences.accentColor = color.toUpperCase();
  }

  if (patch.enabledFeatures !== undefined) {
    const validation = validateEnabledFeatures(patch.enabledFeatures, user.role);
    if (!validation.ok) {
      const err = new Error(validation.error);
      err.code = 'profile.invalidFeatures';
      throw err;
    }
    if (validation.value == null) {
      delete nextPreferences.enabledFeatures;
    } else {
      nextPreferences.enabledFeatures = validation.value;
    }
  }

  await user.update({ preferences: nextPreferences });
  return serializeUser(await user.reload());
}
