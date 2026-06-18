<template>
  <div class="layout layout--admin">
    <AppSidebar />
    <div class="layout__content">
      <AppHeader />
      <main class="layout__main">
        <RouterView />
      </main>
      <footer class="layout__footer">
        <AppFooter />
      </footer>
    </div>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router';
import AppSidebar from '../components/layout/AppSidebar.vue';
import AppHeader from '../components/layout/AppHeader.vue';
import AppFooter from '../components/layout/AppFooter.vue';
</script>
