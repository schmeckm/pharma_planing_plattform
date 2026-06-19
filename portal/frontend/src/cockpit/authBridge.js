import { getDefaultFeatureIdsForRole, getPermittedFeatureIdsForRole } from '../../../../cockpit/src/config/features.js';

const PORTAL_ROLE_MAP = {
  admin: 'admin',
  user: 'planner',
};

const FALLBACK_SESSIONS = {
  admin: {
    userId: 'USR-ADMIN01',
    username: 'admin',
    displayName: 'Portal Administrator',
    role: 'ADMIN',
    permissions: ['*', 'users:manage', 'rules:write'],
  },
  user: {
    userId: 'USR-PLANNER01',
    username: 'planner',
    displayName: 'Portal Benutzer',
    role: 'PLANNER',
    permissions: [
      'orders:read',
      'batches:read',
      'allocation:simulate',
      'allocation:execute',
      'exceptions:read',
      'exceptions:comment',
      'whatif:run',
      'copilot:use',
      'jobs:read',
      'jobs:create',
      'agents:run',
      'rules:read',
      'audit:read',
    ],
  },
};

function resolvePortalFeatureIds(portalUser, cockpitRole) {
  const defaults = getDefaultFeatureIdsForRole(cockpitRole);
  const custom = portalUser?.preferences?.enabledFeatures;
  if (custom == null) {
    return { enabledFeatureIds: defaults, usesCustomFeatures: false };
  }
  if (!Array.isArray(custom)) {
    return { enabledFeatureIds: defaults, usesCustomFeatures: false };
  }
  const permitted = new Set(getPermittedFeatureIdsForRole(cockpitRole));
  return {
    enabledFeatureIds: custom.filter((id) => permitted.has(id)),
    usesCustomFeatures: true,
  };
}

function enrichSession(base, portalUser) {
  const featureState = resolvePortalFeatureIds(portalUser, base.role);
  return {
    ...base,
    displayName: portalUser.displayName || base.displayName,
    email: portalUser.email,
    portalUserId: portalUser.id,
    ...featureState,
  };
}

export async function syncCockpitAuthFromPortal(portalUser) {
  if (!portalUser) {
    localStorage.removeItem('hap_user');
    return null;
  }

  const mappedRole = portalUser.role === 'admin' ? 'admin' : 'user';
  const allocationUsername = PORTAL_ROLE_MAP[mappedRole] || 'planner';

  try {
    const { apiV2 } = await import('../../../../cockpit/src/api/v2.js');
    const session = await apiV2.login(allocationUsername);
    const featureState = resolvePortalFeatureIds(portalUser, session.role);
    const enriched = {
      ...session,
      displayName: portalUser.displayName || session.displayName,
      email: portalUser.email,
      portalUserId: portalUser.id,
      ...featureState,
    };
    localStorage.setItem('hap_user', JSON.stringify(enriched));
    return enriched;
  } catch {
    const fallbackKey = portalUser.role === 'admin' ? 'admin' : 'user';
    const session = enrichSession(FALLBACK_SESSIONS[fallbackKey], portalUser);
    localStorage.setItem('hap_user', JSON.stringify(session));
    return session;
  }
}

export async function applyCockpitAuthToStore(portalUser) {
  const session = await syncCockpitAuthFromPortal(portalUser);
  if (!session) {
    return null;
  }

  const { useAuthStore } = await import('../../../../cockpit/src/stores/auth.js');
  const cockpitAuth = useAuthStore();
  cockpitAuth.setUserSession(session);
  return session;
}

export function clearCockpitAuth() {
  localStorage.removeItem('hap_user');
}
