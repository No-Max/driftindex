<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <div class="section-heading">
    <h2>{{ title }}</h2>
    <p v-if="subtitle" class="muted">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
.section-heading {
  margin-bottom: 1.25rem;
}

.section-heading h2 {
  margin: 0;
  font-family: Oswald, sans-serif;
  font-size: clamp(1.35rem, 2.5vw, 1.75rem);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-heading p {
  margin: 0.35rem 0 0;
  font-size: 0.95rem;
}
</style>
