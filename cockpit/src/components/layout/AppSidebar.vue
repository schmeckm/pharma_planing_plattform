<template>

  <aside class="sidebar">

    <div class="sidebar__brand">

      <div class="sidebar__logo">HA</div>

      <div>

        <div class="sidebar__title">Hard Allocation</div>

        <div class="sidebar__subtitle">{{ t('app.brandSubtitle') }}</div>

      </div>

    </div>



    <nav class="sidebar__nav">

      <div v-for="section in visibleSections" :key="section.id" class="sidebar__section">

        <button

          type="button"

          class="sidebar__section-toggle"

          :aria-expanded="isOpen(section.id)"

          @click="toggleSection(section.id)"

        >

          <span>{{ section.label }}</span>

          <el-icon class="sidebar__chevron" :class="{ open: isOpen(section.id) }">

            <ArrowRight />

          </el-icon>

        </button>



        <div v-show="isOpen(section.id)" class="sidebar__section-items">

          <router-link

            v-for="item in section.items"

            :key="item.path"

            :to="item.path"

            class="sidebar__link"

            :class="{ active: isActive(item.path) }"

          >

            <el-icon><component :is="item.icon" /></el-icon>

            <span>{{ item.label }}</span>

            <span v-if="item.edition" class="sidebar__badge">{{ item.edition }}</span>

          </router-link>

        </div>

      </div>

    </nav>



    <div class="sidebar__footer">

      <router-link to="/wizard" class="sidebar__help-link">

        <el-icon><Guide /></el-icon>

        {{ t('nav.dailyWizardFooter') }}

      </router-link>

      <span class="sidebar__version">{{ t('nav.version') }}</span>

    </div>

  </aside>

</template>



<script setup>

import { computed, ref, onMounted } from 'vue';

import { useRoute } from 'vue-router';

import { NAV_BASE } from '@/i18n/messages';

import { useAuthStore } from '@/stores/auth';

import { useI18n } from '@/composables/useI18n';



const route = useRoute();

const auth = useAuthStore();

const { t, navSections } = useI18n();

const openSections = ref({});



const visibleSections = computed(() =>

  navSections.value.map((section) => ({

    ...section,

    items: section.items.filter((item) => {

      if (item.permission && !auth.hasPermission(item.permission)) return false;

      if (item.featureId && !auth.hasFeature(item.featureId)) return false;

      return true;

    }),

  })).filter((section) => section.items.length > 0),

);



onMounted(() => {

  const saved = localStorage.getItem('hap_nav_sections');

  const parsed = saved ? JSON.parse(saved) : {};

  for (const section of NAV_BASE) {

    openSections.value[section.id] = parsed[section.id] ?? section.defaultOpen !== false;

  }

  for (const section of visibleSections.value) {

    const activeInSection = section.items.some((item) => isActive(item.path));

    if (activeInSection) openSections.value[section.id] = true;

  }

});



function isOpen(id) {

  return openSections.value[id] !== false;

}



function toggleSection(id) {

  openSections.value[id] = !isOpen(id);

  localStorage.setItem('hap_nav_sections', JSON.stringify(openSections.value));

}



function isActive(path) {

  return route.path === path || route.path.startsWith(`${path}/`);

}

</script>



<style scoped>

.sidebar {

  width: var(--sidebar-width);

  background: var(--color-sidebar);

  color: #fff;

  display: flex;

  flex-direction: column;

  flex-shrink: 0;

}



.sidebar__brand {

  display: flex;

  align-items: center;

  gap: 12px;

  padding: 0 0 var(--sidebar-brand-gap);

  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

}



.sidebar__logo {

  width: 36px;

  height: 36px;

  background: var(--color-accent);

  border-radius: 6px;

  display: flex;

  align-items: center;

  justify-content: center;

  font-weight: 700;

  font-size: 0.75rem;

}



.sidebar__title {

  font-weight: 600;

  font-size: 0.9375rem;

}



.sidebar__subtitle {

  font-size: 0.6875rem;

  opacity: 0.7;

}



.sidebar__nav {

  flex: 1;

  padding: 0;

  overflow-y: auto;

}



.sidebar__section {

  margin-bottom: 4px;

}



.sidebar__section-toggle {

  width: 100%;

  display: flex;

  align-items: center;

  justify-content: space-between;

  padding: var(--sidebar-link-padding-y) var(--sidebar-link-padding-x);

  border: none;

  background: transparent;

  color: rgba(255, 255, 255, 0.55);

  font-size: 0.6875rem;

  font-weight: 700;

  text-transform: uppercase;

  letter-spacing: 0.04em;

  cursor: pointer;

  border-radius: var(--radius);

}



.sidebar__section-toggle:hover {

  color: rgba(255, 255, 255, 0.85);

  background: rgba(255, 255, 255, 0.05);

}



.sidebar__chevron {

  transition: transform 0.15s;

  font-size: 0.75rem;

}



.sidebar__chevron.open {

  transform: rotate(90deg);

}



.sidebar__section-items {

  padding-bottom: 4px;

}



.sidebar__link {

  display: flex;

  align-items: center;

  gap: 10px;

  padding: var(--sidebar-link-padding-y) var(--sidebar-link-padding-x);

  margin-bottom: 2px;

  border-radius: var(--radius);

  color: rgba(255, 255, 255, 0.85);

  font-size: 0.8125rem;

  transition: background 0.15s;

}



.sidebar__link:hover {

  background: var(--color-sidebar-hover);

  color: #fff;

}



.sidebar__link.active {

  background: var(--color-sidebar-active);

  color: #fff;

  font-weight: 600;

}



.sidebar__footer {

  padding: var(--sidebar-brand-gap) 0 0;

  border-top: 1px solid rgba(255, 255, 255, 0.1);

  display: flex;

  flex-direction: column;

  gap: 8px;

}



.sidebar__help-link {

  display: flex;

  align-items: center;

  gap: 6px;

  font-size: 0.8125rem;

  color: rgba(255, 255, 255, 0.75);

}



.sidebar__help-link:hover {

  color: #fff;

}



.sidebar__version {

  font-size: 0.6875rem;

  opacity: 0.5;

}



.sidebar__badge {

  margin-left: auto;

  font-size: 0.625rem;

  background: var(--color-accent);

  padding: 1px 5px;

  border-radius: 4px;

  font-weight: 700;

}

</style>


