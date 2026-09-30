<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export type TrophyCounts = {
  gold: number;
  silver: number;
  bronze: number;
  qual: number;
};

const props = withDefaults(
  defineProps<{
    counts: TrophyCounts;
    size?: 'sm' | 'md';
  }>(),
  { size: 'sm' },
);

const { t } = useI18n();

const EVENT_TROPHY_PATH =
  'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z';

const tandemTiers = computed(() =>
  (['gold', 'silver', 'bronze'] as const).flatMap((tier) =>
    Array.from({ length: props.counts[tier] }, (_, i) => ({
      tier,
      key: `tandem-${tier}-${i}`,
    })),
  ),
);

const tandemTotal = computed(
  () => props.counts.gold + props.counts.silver + props.counts.bronze,
);

const total = computed(() => tandemTotal.value + props.counts.qual);

const ariaLabel = computed(() =>
  t('home.p4pPodiumTrophies', {
    gold: props.counts.gold,
    silver: props.counts.silver,
    bronze: props.counts.bronze,
    qual: props.counts.qual,
  }),
);
</script>

<template>
  <div
    v-if="total > 0"
    class="trophy-counts"
    :class="`trophy-counts--${size}`"
    :aria-label="ariaLabel"
    role="img"
  >
    <span
      v-for="item in tandemTiers"
      :key="item.key"
      class="trophy-counts__icon"
      :class="`trophy-counts__icon--${item.tier}`"
      aria-hidden="true"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path :d="EVENT_TROPHY_PATH" />
      </svg>
    </span>
    <span
      v-if="tandemTotal > 0 && counts.qual > 0"
      class="trophy-counts__sep"
      aria-hidden="true"
    />
    <span
      v-for="n in counts.qual"
      :key="`qual-${n}`"
      class="trophy-counts__icon trophy-counts__icon--gold trophy-counts__icon--qual"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="qual-crystal-trophy-svg"
      >
        <path d="M7.75 20.85h8.5a1.9 1.9 0 0 1 0 3.8H7.75a1.9 1.9 0 0 1 0-3.8z" />
        <path d="M7.85 18.15h8.3v1.85H7.85V18.15z" />
        <path
          d="M12 19.95 5.35 4.65 12 4.95 18.65 8.75 14.15 11.35 12 19.95z"
          fill-rule="nonzero"
        />
      </svg>
    </span>
  </div>
</template>

<style scoped>
.trophy-counts {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.12rem;
  line-height: 1;
}

.trophy-counts--sm .trophy-counts__icon svg {
  width: 0.95rem;
  height: 0.95rem;
}

.trophy-counts--md .trophy-counts__icon svg {
  width: 1.15rem;
  height: 1.15rem;
}

.trophy-counts__icon {
  display: inline-flex;
  flex-shrink: 0;
}

.trophy-counts__icon--gold {
  color: #e8c547;
  filter: drop-shadow(0 0 2px rgba(232, 197, 71, 0.35));
}

.trophy-counts__icon--silver {
  color: #b8c4d4;
  filter: drop-shadow(0 0 2px rgba(184, 196, 212, 0.25));
}

.trophy-counts__icon--bronze {
  color: #c9884b;
  filter: drop-shadow(0 0 2px rgba(201, 136, 75, 0.3));
}

.trophy-counts__icon--qual .qual-crystal-trophy-svg {
  width: 0.92rem;
  height: 1.08rem;
}

.trophy-counts--md .trophy-counts__icon--qual .qual-crystal-trophy-svg {
  width: 1.08rem;
  height: 1.26rem;
}

.trophy-counts__sep {
  width: 1px;
  height: 0.85rem;
  margin: 0 0.1rem;
  background: var(--border);
  flex-shrink: 0;
}
</style>
