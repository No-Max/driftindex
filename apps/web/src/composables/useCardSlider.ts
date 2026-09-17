import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

type VisibleCountResolver = (viewportWidth: number) => number;

export function useCardSlider(
  itemCount: Ref<number>,
  resolveVisibleCount: VisibleCountResolver,
  autoplayMs = 9000,
  resolveInitialIndex?: (visibleCount: number) => number,
  loop = true,
  invertStep = false,
) {
  const viewportRef = ref<HTMLElement | null>(null);
  const visibleCount = ref(resolveVisibleCount(typeof window === 'undefined' ? 1200 : window.innerWidth));
  const slideIndex = ref(0);
  const paused = ref(false);
  const dragging = ref(false);
  const dragOffsetPx = ref(0);

  const maxIndex = computed(() => Math.max(0, itemCount.value - visibleCount.value));
  const canNavigate = computed(() => itemCount.value > visibleCount.value);
  const positionCount = computed(() => maxIndex.value + 1);
  const centerItemIndex = computed(() => slideIndex.value + Math.floor(visibleCount.value / 2));
  const canGoPrev = computed(() => (loop && canNavigate.value) || slideIndex.value > 0);
  const canGoNext = computed(() => (loop && canNavigate.value) || slideIndex.value < maxIndex.value);

  const viewportStyle = computed(() => ({
    '--visible-count': String(visibleCount.value),
  }));

  const trackStyle = computed(() => {
    const n = visibleCount.value;
    const i = slideIndex.value;
    const drag = dragOffsetPx.value;
    return {
      transform: `translateX(calc(-${i} * ((100cqw - (${n} - 1) * var(--slider-gap)) / ${n} + var(--slider-gap)) + ${drag}px))`,
    };
  });

  let timer: ReturnType<typeof setInterval> | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let pointerActive = false;
  let dragAxis: 'none' | 'x' | 'y' = 'none';
  let startedInScrollArea = false;
  let didDrag = false;

  const AXIS_LOCK_PX = 10;
  const HORIZONTAL_BIAS = 1.25;

  function scrollContainerFromTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return null;
    const el = target.closest('[data-card-slider-scroll]');
    if (!(el instanceof HTMLElement)) return null;
    if (el.scrollHeight <= el.clientHeight + 1) return null;
    return el;
  }

  function clampIndex() {
    slideIndex.value = Math.min(slideIndex.value, maxIndex.value);
  }

  function updateVisibleCount() {
    visibleCount.value = resolveVisibleCount(window.innerWidth);
    clampIndex();
  }

  function goTo(index: number) {
    if (!canNavigate.value) return;
    slideIndex.value = Math.max(0, Math.min(index, maxIndex.value));
  }

  function stepForward() {
    if (!canNavigate.value) return;
    if (slideIndex.value >= maxIndex.value) {
      if (loop) slideIndex.value = 0;
      return;
    }
    slideIndex.value += 1;
  }

  function stepBack() {
    if (!canNavigate.value) return;
    if (slideIndex.value <= 0) {
      if (loop) slideIndex.value = maxIndex.value;
      return;
    }
    slideIndex.value -= 1;
  }

  function next() {
    if (invertStep) stepBack();
    else stepForward();
  }

  function prev() {
    if (invertStep) stepForward();
    else stepBack();
  }

  function onPointerDown(event: PointerEvent) {
    if (!canNavigate.value || event.button !== 0) return;

    pointerActive = true;
    dragging.value = false;
    dragAxis = 'none';
    startedInScrollArea = scrollContainerFromTarget(event.target) != null;
    didDrag = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragOffsetPx.value = 0;
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointerActive) return;

    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;

    if (dragAxis === 'none') {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;

      const verticalBias = startedInScrollArea ? 0.75 : 0.85;
      const horizontalBias = startedInScrollArea ? 1.15 : HORIZONTAL_BIAS;

      if (Math.abs(dy) > 4 && Math.abs(dy) >= Math.abs(dx) * verticalBias) {
        dragAxis = 'y';
        pointerActive = false;
        startedInScrollArea = false;
        return;
      }

      if (Math.abs(dx) < AXIS_LOCK_PX || Math.abs(dx) <= Math.abs(dy) * horizontalBias) {
        return;
      }

      dragAxis = 'x';
      dragging.value = true;
      viewportRef.value?.setPointerCapture(event.pointerId);
    }

    if (dragAxis !== 'x' || !dragging.value) return;

    event.preventDefault();
    dragOffsetPx.value = dx;
    if (Math.abs(dx) > 6) didDrag = true;
  }

  function finishDrag(event: PointerEvent) {
    if (!pointerActive && !dragging.value) return;

    pointerActive = false;

    if (dragging.value) {
      const width = viewportRef.value?.clientWidth ?? 1;
      const threshold = width * 0.12;

      if (dragOffsetPx.value < -threshold) {
        if (invertStep) prev();
        else next();
      } else if (dragOffsetPx.value > threshold) {
        if (invertStep) next();
        else prev();
      }
    }

    dragging.value = false;
    dragOffsetPx.value = 0;
    dragAxis = 'none';
    startedInScrollArea = false;

    if (viewportRef.value?.hasPointerCapture(event.pointerId)) {
      viewportRef.value.releasePointerCapture(event.pointerId);
    }

    window.setTimeout(() => {
      didDrag = false;
    }, 0);
  }

  function onLinkClick(event: MouseEvent) {
    if (didDrag) event.preventDefault();
  }

  function startAutoplay() {
    stopAutoplay();
    if (!canNavigate.value || autoplayMs <= 0) return;
    timer = setInterval(() => {
      if (!paused.value && !dragging.value) next();
    }, autoplayMs);
  }

  function stopAutoplay() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  watch([itemCount, visibleCount], () => {
    clampIndex();
    startAutoplay();
  });

  onMounted(() => {
    updateVisibleCount();
    if (resolveInitialIndex) {
      slideIndex.value = resolveInitialIndex(visibleCount.value);
    }
    window.addEventListener('resize', updateVisibleCount);
    startAutoplay();
  });

  onUnmounted(() => {
    window.removeEventListener('resize', updateVisibleCount);
    stopAutoplay();
  });

  return {
    viewportRef,
    visibleCount,
    slideIndex,
    centerItemIndex,
    canNavigate,
    canGoPrev,
    canGoNext,
    maxIndex,
    positionCount,
    viewportStyle,
    trackStyle,
    dragOffsetPx,
    dragging,
    paused,
    goTo,
    next,
    prev,
    onPointerDown,
    onPointerMove,
    finishDrag,
    onLinkClick,
  };
}
