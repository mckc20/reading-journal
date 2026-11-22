import { useRef, type DragEvent, type MouseEvent, type PointerEvent } from "react";

const DRAG_THRESHOLD = 6;
const MAX_EDGE_PULL = 18;

type ShelfGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  lastX: number;
  lastMove: number;
  velocity: number;
  dragging: boolean;
};

/** Drag the scroll position, with a small amount of give at either end. */
export function useShelfDrag<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const gesture = useRef<ShelfGesture | null>(null);
  const suppressClick = useRef(false);

  function handlePointerDown(event: PointerEvent<T>) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      lastX: event.clientX,
      lastMove: event.timeStamp,
      velocity: 0,
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
    }

    const desired = start.scrollLeft - dx;
    const max = Math.max(0, row.scrollWidth - row.clientWidth);
    const position = Math.max(0, Math.min(max, desired));
    const edgePull = Math.max(-MAX_EDGE_PULL, Math.min(MAX_EDGE_PULL, (position - desired) * 0.3));
    row.scrollLeft = position;
    row.style.setProperty("--shelf-pull", `${edgePull}px 0`);

    const elapsed = event.timeStamp - start.lastMove;
    if (elapsed > 0) start.velocity = (start.lastX - event.clientX) / elapsed;
    start.lastX = event.clientX;
    start.lastMove = event.timeStamp;
    event.preventDefault();
  }

  function finishDrag(event: PointerEvent<T>, glide = false) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (!start.dragging) return;

    const row = event.currentTarget;
    const position = row.scrollLeft;
    const pulledAtEdge = Number.parseFloat(row.style.getPropertyValue("--shelf-pull")) !== 0;
    delete row.dataset.shelfDragging;
    row.style.removeProperty("--shelf-pull");
    if (row.hasPointerCapture(event.pointerId)) row.releasePointerCapture(event.pointerId);

    const canGlide = glide &&
      event.pointerType === "touch" &&
      !pulledAtEdge &&
      event.timeStamp - start.lastMove < 80 &&
      Math.abs(start.velocity) > 0.3 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (canGlide) {
      const distance = Math.max(-120, Math.min(120, start.velocity * 90));
      row.scrollTo({ left: position + distance, behavior: "smooth" });
    }
  }

  return {
    ref,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: (event: PointerEvent<T>) => finishDrag(event, true),
    onPointerCancel: (event: PointerEvent<T>) => finishDrag(event),
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
