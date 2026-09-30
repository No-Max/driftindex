<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    debounceMs?: number;
    /** Emit search only when trimmed length is ≥ this (empty always clears). */
    minLength?: number;
  }>(),
  {
    modelValue: '',
    debounceMs: 300,
    minLength: 0,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const draft = ref(props.modelValue);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.modelValue,
  (value) => {
    if (value === draft.value) return;
    const trimmed = draft.value.trim();
    // Keep 1..(minLength-1) draft while parent holds the cleared query.
    if (value === '' && trimmed.length > 0 && trimmed.length < props.minLength) return;
    draft.value = value;
  },
);

watch(draft, (value) => {
  clearTimeout(timer);
  const trimmed = value.trim();
  const next = trimmed.length === 0 || trimmed.length >= props.minLength ? value : '';
  // Flush clear / below-min immediately; debounce real queries.
  const delay = next === '' ? 0 : props.debounceMs;
  timer = setTimeout(() => {
    if (next !== props.modelValue) emit('update:modelValue', next);
  }, delay);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
});
</script>

<template>
  <input v-model="draft" type="search" :placeholder="placeholder" />
</template>
