<template>
  <Toast position="top-right" />
  <RouterView />
</template>

<script setup>
import { RouterView } from 'vue-router';
import Toast from 'primevue/toast';
</script>
