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
  let didDrag = false;

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
    dragging.value = true;
    didDrag = false;
    dragStartX = event.clientX;
    dragOffsetPx.value = 0;
    viewportRef.value?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging.value) return;
    dragOffsetPx.value = event.clientX - dragStartX;
    if (Math.abs(dragOffsetPx.value) > 6) didDrag = true;
  }

  function finishDrag(event: PointerEvent) {
    if (!dragging.value) return;

    const width = viewportRef.value?.clientWidth ?? 1;
    const threshold = width * 0.12;

    if (dragOffsetPx.value < -threshold) {
      if (invertStep) prev();
      else next();
    } else if (dragOffsetPx.value > threshold) {
      if (invertStep) next();
      else prev();
    }

    dragging.value = false;
    dragOffsetPx.value = 0;

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
