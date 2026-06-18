import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiV2 } from '@/api/v2';
import { getFeatureIdForPath, getFeatureById, getDefaultFeatureIdsForRole } from '@/config/features';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(JSON.parse(localStorage.getItem('hap_user') || 'null'));
  const loading = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const role = computed(() => user.value?.role || 'PLANNER');
  const enabledFeatureIds = computed(() => {
    if (!user.value) return [];
    if (Array.isArray(user.value.enabledFeatureIds)) {
      return user.value.enabledFeatureIds;
    }
    // Legacy localStorage without feature enrichment
    return getDefaultFeatureIdsForRole(user.value.role || 'PLANNER');
  });
  const usesCustomFeatures = computed(() => user.value?.usesCustomFeatures === true);

  async function login(username) {
    loading.value = true;
    try {
      const result = await apiV2.login(username);
      user.value = result;
      localStorage.setItem('hap_user', JSON.stringify(result));
      return result;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    user.value = null;
    localStorage.removeItem('hap_user');
  }

  function setUserSession(session) {
    user.value = session;
    localStorage.setItem('hap_user', JSON.stringify(session));
  }

  function hasPermission(permission) {
    const perms = user.value?.permissions || [];
    return perms.includes('*') || perms.includes(permission);
  }

  function hasFeature(featureId) {
    if (!featureId) return true;
    return enabledFeatureIds.value.includes(featureId);
  }

  function canAccessPath(path) {
    const featureId = getFeatureIdForPath(path);
    if (!featureId) return true;
    const feature = getFeatureById(featureId);
    if (feature?.permission && !hasPermission(feature.permission)) return false;
    return hasFeature(featureId);
  }

  return {
    user,
    loading,
    isAuthenticated,
    role,
    enabledFeatureIds,
    usesCustomFeatures,
    login,
    logout,
    setUserSession,
    hasPermission,
    hasFeature,
    canAccessPath,
  };
});
