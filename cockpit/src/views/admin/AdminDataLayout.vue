<template>
  <div class="admin-data-layout">
    <aside class="admin-data-sidebar panel">
      <div class="admin-data-sidebar__header">
        <h2>Admin Data Management</h2>
        <p class="hint">Mock data maintenance for planning scenarios</p>
      </div>
      <nav class="admin-data-nav">
        <RouterLink
          v-for="item in menuItems"
          :key="item.slug"
          :to="`/admin/data/${item.slug}`"
          class="admin-data-nav__item"
          active-class="admin-data-nav__item--active"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>
    <main class="admin-data-main">
      <GenericCrudTable
        v-if="config"
        :key="activeSlug"
        :entity-slug="activeSlug"
        :entity-label="activeLabel"
        :columns="config.columns"
        :id-field="config.idField"
      />
      <div v-else class="panel empty-state">
        <p>Unknown entity: {{ activeSlug }}</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import GenericCrudTable from '@/components/admin/GenericCrudTable.vue';
import { ADMIN_ENTITY_MENU, getEntityConfig } from '@/config/adminDataEntities';

const route = useRoute();
const menuItems = ADMIN_ENTITY_MENU;

const activeSlug = computed(() => route.params.entitySlug || 'planning-orders');
const config = computed(() => getEntityConfig(activeSlug.value));
const activeLabel = computed(() =>
  menuItems.find((m) => m.slug === activeSlug.value)?.label || activeSlug.value,
);
</script>

<style scoped>
.admin-data-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--space-3);
  min-height: calc(100vh - 8rem);
}

.admin-data-sidebar {
  padding: var(--space-3);
  align-self: start;
  position: sticky;
  top: var(--space-3);
  max-height: calc(100vh - 6rem);
  overflow-y: auto;
}

.admin-data-sidebar__header h2 {
  margin: 0 0 0.25rem;
  font-size: var(--font-size-md);
  font-weight: 600;
}

.admin-data-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-top: var(--space-3);
}

.admin-data-nav__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: var(--radius-sm, 4px);
  color: var(--text-secondary, #555);
  text-decoration: none;
  font-size: var(--font-size-sm);
  transition: background 0.15s;
}

.admin-data-nav__item:hover {
  background: var(--surface-hover, rgba(0, 0, 0, 0.04));
  color: var(--text-primary, #222);
}

.admin-data-nav__item--active {
  background: var(--color-primary-subtle, rgba(59, 130, 246, 0.12));
  color: var(--color-primary, #2563eb);
  font-weight: 600;
}

.admin-data-main {
  min-width: 0;
}

@media (max-width: 900px) {
  .admin-data-layout {
    grid-template-columns: 1fr;
  }
  .admin-data-sidebar {
    position: static;
    max-height: none;
  }
  .admin-data-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
</style>
