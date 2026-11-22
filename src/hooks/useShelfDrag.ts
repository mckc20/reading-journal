import { useLayoutEffect, useRef, type DragEvent, type MouseEvent, type PointerEvent } from "react";

const DRAG_THRESHOLD = 6;
const MAX_EDGE_PULL = 18;

type ShelfGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  dragging: boolean;
};

/** Use native touch momentum on long shelves, and add gentle give to short ones. */
export function useShelfDrag<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const gesture = useRef<ShelfGesture | null>(null);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const row = ref.current;
    if (!row || !enabled) return;

    const update = () => row.toggleAttribute("data-shelf-overflow", row.scrollWidth > row.clientWidth);
    const resize = new ResizeObserver(update);
    const observeCards = () => {
      resize.disconnect();
      resize.observe(row);
      Array.from(row.children).forEach((card) => resize.observe(card));
      update();
    };
    const changes = new MutationObserver(observeCards);
    changes.observe(row, { childList: true });
    observeCards();
    return () => {
      changes.disconnect();
      resize.disconnect();
      row.removeAttribute("data-shelf-overflow");
    };
  }, [enabled]);

  function handlePointerDown(event: PointerEvent<T>) {
    if (!event.isPrimary || event.button !== 0) return;
    const row = event.currentTarget;
    suppressClick.current = false;
    if (event.pointerType === "touch" && row.hasAttribute("data-shelf-overflow")) return;

    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: row.scrollLeft,
      dragging: false,
    };
  }

  function handlePointerMove(event: PointerEvent<T>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const row = event.currentTarget;
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (!start.dragging) {
      if (event.buttons === 0 || (Math.abs(dy) >= DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx))) {
        gesture.current = null;
        return;
      }
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      start.dragging = true;
      suppressClick.current = true;
      row.setPointerCapture(event.pointerId);
      row.dataset.shelfDragging = "true";
      // Keep the first moving frame close to the card's starting position.
      start.startX += Math.sign(dx) * DRAG_THRESHOLD;
      start.scrollLeft = row.scrollLeft;
    }

    const desired = start.scrollLeft - (event.clientX - start.startX);
    const max = Math.max(0, row.scrollWidth - row.clientWidth);
    const position = Math.max(0, Math.min(max, desired));
    const overshoot = position - desired;
    const edgePull = MAX_EDGE_PULL * overshoot / (Math.abs(overshoot) + 28);
    if (position !== row.scrollLeft) row.scrollLeft = position;
    row.style.setProperty("--shelf-pull", `${edgePull}px 0`);
    event.preventDefault();
  }

  function finishDrag(event: PointerEvent<T>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (!start.dragging) return;

    const row = event.currentTarget;
    delete row.dataset.shelfDragging;
    row.style.removeProperty("--shelf-pull");
    if (row.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId);
  }

  return {
    ref,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: (event: PointerEvent<T>) => {
      // A touch may first be captured by the card before the shelf claims it.
      if (event.target === event.currentTarget) finishDrag(event);
    },
    onDragStart: (event: DragEvent<T>) => event.preventDefault(),
    onClickCapture: (event: MouseEvent<T>) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onKeyDownCapture: () => { suppressClick.current = false; },
  };
}
