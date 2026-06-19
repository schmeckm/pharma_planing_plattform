<template>
  <nav class="planning-nav">
    <div v-for="section in visibleSections" :key="section.id" class="planning-nav__section">
      <button
        type="button"
        class="planning-nav__toggle"
        :aria-expanded="isOpen(section.id)"
        @click="toggleSection(section.id)"
      >
        <span>{{ section.label }}</span>
        <span class="planning-nav__chevron" :class="{ open: isOpen(section.id) }">›</span>
      </button>

      <div v-show="isOpen(section.id)" class="planning-nav__items">
        <RouterLink
          v-for="item in section.items"
          :key="item.path"
          :to="item.path"
          class="planning-nav__link"
          active-class="planning-nav__link--active"
        >
          <el-icon v-if="item.icon" class="planning-nav__icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <span v-if="item.edition" class="planning-nav__badge">{{ item.edition }}</span>
        </RouterLink>
      </div>
    </div>

    <RouterLink :to="`${PLANNING_PREFIX}/wizard`" class="planning-nav__footer-link">
      {{ wizardFooterLabel }}
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { NAV_BASE } from '../../../../../cockpit/src/i18n/messages.js';
import { buildOptionalNavSections } from '../../cockpit/planningNavExtra.js';
import { t as cockpitT } from '../../../../../cockpit/src/i18n/index.js';
import { getFeatureById } from '../../../../../cockpit/src/config/features.js';
import { useAuthStore as useCockpitAuthStore } from '../../../../../cockpit/src/stores/auth.js';
import { useLocaleStore } from '../../stores/localeStore';
import { PLANNING_PREFIX } from '../../cockpit/pathUtils.js';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

const route = useRoute();
const localeStore = useLocaleStore();
const cockpitAuth = useCockpitAuthStore();
const openSections = ref({});
const navSections = [...NAV_BASE, ...buildOptionalNavSections()];

const wizardFooterLabel = computed(() =>
  cockpitT(localeStore.locale, 'nav.dailyWizardFooter')
);

function resolveEdition(featureId) {
  return getFeatureById(featureId)?.edition || null;
}

function canShowItem(item) {
  if (item.permission && !cockpitAuth.hasPermission(item.permission)) return false;
  if (item.featureId && !cockpitAuth.hasFeature(item.featureId)) return false;
  if (!cockpitAuth.canAccessPath(item.path)) return false;
  return true;
}

const visibleSections = computed(() =>
  navSections.map((section) => ({
    id: section.id,
    label: cockpitT(localeStore.locale, section.labelKey),
    items: section.items
      .filter(canShowItem)
      .map((item) => ({
        path: `${PLANNING_PREFIX}${item.path}`,
        label: cockpitT(localeStore.locale, item.labelKey),
        edition: resolveEdition(item.featureId),
        icon: ElementPlusIconsVue[item.icon] || null,
      })),
  })).filter((section) => section.items.length > 0)
);

function isOpen(id) {
  return openSections.value[id] !== false;
}

function toggleSection(id) {
  openSections.value[id] = !isOpen(id);
  localStorage.setItem('portal.nav.sections', JSON.stringify(openSections.value));
}

function syncOpenForActiveRoute() {
  for (const section of visibleSections.value) {
    const activeInSection = section.items.some(
      (item) => route.path === item.path || route.path.startsWith(`${item.path}/`)
    );
    if (activeInSection) {
      openSections.value[section.id] = true;
    }
  }
}

onMounted(() => {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('portal.nav.sections') || '{}');
  } catch {
    saved = {};
  }
  for (const section of navSections) {
    openSections.value[section.id] = saved[section.id] ?? section.defaultOpen !== false;
  }
  syncOpenForActiveRoute();
});

watch(
  () => route.path,
  () => syncOpenForActiveRoute()
);
</script>

<style scoped>
.planning-nav {
  display: grid;
  gap: 0.35rem;
}

.planning-nav__section {
  margin-bottom: 0.15rem;
}

.planning-nav__toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sidebar-link-padding-y) var(--sidebar-link-padding-x);
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  border-radius: var(--radius);
}

.planning-nav__toggle:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.05);
}

.planning-nav__chevron {
  transition: transform 0.15s ease;
  font-size: 0.85rem;
}

.planning-nav__chevron.open {
  transform: rotate(90deg);
}

.planning-nav__items {
  display: grid;
  gap: 0.1rem;
  padding-bottom: 0.25rem;
}

.planning-nav__link {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
  padding: var(--sidebar-link-padding-y) var(--sidebar-link-padding-x);
  border-radius: var(--radius);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.85rem;
}

.planning-nav__icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.planning-nav__link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.planning-nav__link--active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 600;
}

.planning-nav__badge {
  margin-left: auto;
  font-size: 0.62rem;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--color-accent);
  color: var(--color-accent-on, #fff);
  font-weight: 700;
}

.planning-nav__footer-link {
  margin-top: 0.75rem;
  padding: var(--sidebar-link-padding-y) var(--sidebar-link-padding-x);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
}

.planning-nav__footer-link:hover {
  color: var(--color-accent);
}
</style>
