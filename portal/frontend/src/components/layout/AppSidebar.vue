<template>
  <aside class="sidebar">
    <div class="sidebar__brand">
      <span class="brand brand--inverse">{{ t('app.name') }}</span>
      <span class="sidebar__subtitle">{{ t('app.subtitle') }}</span>
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

    <nav v-for="section in planningSections" :key="section.id" class="sidebar__section">
      <p class="sidebar__section-title">{{ section.title }}</p>
      <RouterLink
        v-for="link in section.links"
        :key="link.to"
        :to="link.to"
        class="sidebar__link"
        active-class="sidebar__link--active"
      >
        <span>{{ link.label }}</span>
        <span v-if="link.edition" class="sidebar__edition">{{ link.edition }}</span>
      </RouterLink>
    </nav>

    <nav v-if="auth.isAdmin && adminLinks.length" class="sidebar__section">
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
import { usePlanningNavLinks } from '../../composables/usePlanningNavLinks';

const { t } = useI18n();
const auth = useAuthStore();
const mainLinks = useUserNavLinks();
const planningSections = usePlanningNavLinks();
const adminLinks = useAdminNavLinks();
</script>

<style scoped>
.sidebar {
  display: grid;
  align-content: start;
  gap: 1.25rem;
  height: 100%;
}

.sidebar__brand {
  display: grid;
  gap: 0.2rem;
  padding: 0 0.35rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar__subtitle {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.sidebar__section {
  display: grid;
  gap: 0.25rem;
}

.sidebar__section-title {
  margin: 0 0 0.25rem;
  padding: 0 0.5rem;
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
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  color: var(--color-text-inverse);
  font-size: 0.9rem;
}

.sidebar__link:hover {
  background: rgba(0, 230, 118, 0.08);
}

.sidebar__link--active {
  background: rgba(0, 230, 118, 0.18);
  color: var(--color-accent);
  font-weight: 600;
}

.sidebar__edition {
  font-size: 0.65rem;
  opacity: 0.75;
}
</style>
