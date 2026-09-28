<script setup lang="ts">
import type { HomeP4PSeasonEvent } from '@drift-index/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(
  defineProps<{
    events: readonly HomeP4PSeasonEvent[];
    /** Only podiums from this series (P4P best / scoring series). */
    seriesSlug: string;
    size?: 'sm' | 'md';
  }>(),
  { size: 'sm' },
);

const { t } = useI18n();

/** Event / tandem podium cup (Material-style). */
const EVENT_TROPHY_PATH =
  'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z';

const scoringEvents = computed(() =>
  props.events.filter((event) => event.seriesSlug === props.seriesSlug),
);

function countEventPodiums() {
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  for (const event of scoringEvents.value) {
    const p = event.eventPlace;
    if (p === 1) gold += 1;
    else if (p === 2) silver += 1;
    else if (p === 3) bronze += 1;
  }
  return { gold, silver, bronze };
}

function countQualWins() {
  let count = 0;
  for (const event of scoringEvents.value) {
    if (event.qualPosition === 1) count += 1;
  }
  return count;
}

const tandemCounts = computed(() => countEventPodiums());
const qualWins = computed(() => countQualWins());

const tandemTiers = computed(() =>
  (['gold', 'silver', 'bronze'] as const).flatMap((tier) =>
    Array.from({ length: tandemCounts.value[tier] }, (_, i) => ({
      tier,
      key: `tandem-${tier}-${i}`,
    })),
  ),
);

const tandemTotal = computed(
  () => tandemCounts.value.gold + tandemCounts.value.silver + tandemCounts.value.bronze,
);

const total = computed(() => tandemTotal.value + qualWins.value);

const ariaLabel = computed(() =>
  t('home.p4pPodiumTrophies', {
    gold: tandemCounts.value.gold,
    silver: tandemCounts.value.silver,
    bronze: tandemCounts.value.bronze,
    qual: qualWins.value,
  }),
);
</script>

<template>
  <div
    v-if="total > 0"
    class="season-trophies"
    :class="`season-trophies--${size}`"
    :aria-label="ariaLabel"
    role="img"
  >
    <span
      v-for="item in tandemTiers"
      :key="item.key"
      class="season-trophies__icon"
      :class="`season-trophies__icon--${item.tier}`"
      aria-hidden="true"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path :d="EVENT_TROPHY_PATH" />
      </svg>
    </span>
    <span
      v-if="tandemTotal > 0 && qualWins > 0"
      class="season-trophies__sep"
      aria-hidden="true"
    />
    <span
      v-for="n in qualWins"
      :key="`qual-${n}`"
      class="season-trophies__icon season-trophies__icon--gold season-trophies__icon--qual"
      aria-hidden="true"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="qual-crystal-trophy-svg"
      >
        <path
          d="M7.75 20.85h8.5a1.9 1.9 0 0 1 0 3.8H7.75a1.9 1.9 0 0 1 0-3.8z"
        />
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
.season-trophies {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.12rem;
  line-height: 1;
}

.season-trophies--sm .season-trophies__icon svg {
  width: 0.95rem;
  height: 0.95rem;
}

.season-trophies--md .season-trophies__icon svg {
  width: 1.15rem;
  height: 1.15rem;
}

.season-trophies__icon {
  display: inline-flex;
  flex-shrink: 0;
}

.season-trophies__icon--gold {
  color: #e8c547;
  filter: drop-shadow(0 0 2px rgba(232, 197, 71, 0.35));
}

.season-trophies__icon--silver {
  color: #b8c4d4;
  filter: drop-shadow(0 0 2px rgba(184, 196, 212, 0.25));
}

.season-trophies__icon--bronze {
  color: #c9884b;
  filter: drop-shadow(0 0 2px rgba(201, 136, 75, 0.3));
}

.season-trophies__icon--qual .qual-crystal-trophy-svg {
  width: 0.92rem;
  height: 1.08rem;
}

.season-trophies--md .season-trophies__icon--qual .qual-crystal-trophy-svg {
  width: 1.08rem;
  height: 1.26rem;
}

.season-trophies__sep {
  width: 1px;
  height: 0.85rem;
  margin: 0 0.1rem;
  background: var(--border);
  flex-shrink: 0;
}
</style>
