import { computed } from 'vue';
import { useRoute } from 'vue-router';

/** Cockpit-Routen im Portal unter /planning prefixen. */
export function usePlanningBasePath() {
  const route = useRoute();
  const isPortalPlanning = computed(() => route.path.startsWith('/planning'));

  function path(subpath) {
    const normalized = subpath.startsWith('/') ? subpath : `/${subpath}`;
    return isPortalPlanning.value ? `/planning${normalized}` : normalized;
  }

  return { isPortalPlanning, path };
}
