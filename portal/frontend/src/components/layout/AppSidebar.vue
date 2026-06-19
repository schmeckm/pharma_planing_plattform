<template>

  <aside class="sidebar">

    <div class="sidebar__brand">

      <div class="sidebar__logo">PA</div>

      <div>

        <span class="brand brand--inverse">{{ t('app.name') }}</span>

        <span class="sidebar__subtitle">{{ t('app.subtitle') }}</span>

      </div>

    </div>



    <nav class="sidebar__section">

      <p class="sidebar__section-title">{{ t('nav.sectionMain') }}</p>

      <RouterLink

        v-for="link in mainLinks"

        :key="link.to"

        :to="link.to"

        class="sidebar__link"

        active-class="sidebar__link--active"

      >

        {{ link.label }}

      </RouterLink>

    </nav>



    <PlanningSidebarNav />



    <nav v-if="auth.isAdmin && adminLinks.length" class="sidebar__section sidebar__section--admin">

      <p class="sidebar__section-title">{{ t('nav.sectionAdmin') }}</p>

      <RouterLink

        v-for="link in adminLinks"

        :key="link.to"

        :to="link.to"

        class="sidebar__link"

        active-class="sidebar__link--active"

      >

        {{ link.label }}

      </RouterLink>

    </nav>

  </aside>

</template>



<script setup>

import { RouterLink } from 'vue-router';

import { useI18n } from 'vue-i18n';

import { useAuthStore } from '../../stores/authStore';

import { useUserNavLinks } from '../../composables/useUserNavLinks';

import { useAdminNavLinks } from '../../composables/useAdminNavLinks';

import PlanningSidebarNav from './PlanningSidebarNav.vue';



const { t } = useI18n();

const auth = useAuthStore();

const mainLinks = useUserNavLinks();

const adminLinks = useAdminNavLinks();

</script>



<style scoped>

.sidebar {

  display: grid;

  align-content: start;

  gap: 1rem;

  height: 100%;

  overflow-y: auto;

}



.sidebar__brand {

  display: flex;

  align-items: center;

  gap: 0.75rem;

  padding: 0 0 var(--sidebar-brand-gap);

  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

}



.sidebar__logo {

  width: 2.25rem;

  height: 2.25rem;

  border-radius: 8px;

  background: var(--color-accent);

  color: var(--color-accent-on, #fff);

  display: grid;

  place-items: center;

  font-size: 0.72rem;

  font-weight: 800;

}



.sidebar__subtitle {

  display: block;

  font-size: 0.75rem;

  color: var(--color-muted);

}



.sidebar__section {

  display: grid;

  gap: var(--sidebar-section-gap);

}



.sidebar__section--admin {

  padding-top: 0.5rem;

  border-top: 1px solid rgba(255, 255, 255, 0.08);

}



.sidebar__section-title {

  margin: 0 0 var(--sidebar-section-gap);

  padding: 0 var(--sidebar-link-padding-x);

  font-size: 0.68rem;

  text-transform: uppercase;

  letter-spacing: 0.06em;

  color: var(--color-muted);

}



.sidebar__link {

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 0.5rem;

  padding: var(--sidebar-link-padding-y) var(--sidebar-link-padding-x);

  border-radius: var(--radius);

  color: var(--color-text-inverse);

  font-size: 0.9rem;

}



.sidebar__link:hover {

  background: var(--color-accent-soft);

}



.sidebar__link--active {

  background: var(--color-accent-soft);

  color: var(--color-accent);

  font-weight: 600;

}

</style>


