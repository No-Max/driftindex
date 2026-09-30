import { onMounted, onUnmounted, type Ref } from 'vue';

/** Call `onOutside` when pointerdown happens outside `root`. */
export function useClickOutside(
  root: Ref<HTMLElement | null>,
  onOutside: () => void,
) {
  function onPointerDown(event: PointerEvent) {
    const el = root.value;
    if (!el) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (el.contains(target)) return;
    onOutside();
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown);
  });
  onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown);
  });
}
