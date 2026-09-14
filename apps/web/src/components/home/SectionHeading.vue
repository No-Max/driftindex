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
  font-size: clamp(1.5rem, 2.5vw, 1.9rem);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-heading p {
  margin: 0.35rem 0 0;
  font-size: 1.05rem;
  line-height: 1.5;
}
</style>
