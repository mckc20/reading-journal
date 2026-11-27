import { useCallback, useLayoutEffect, useRef } from "react";

// Mobile keyboards can shrink the visible area without resizing the layout viewport.
export function useDialogVisualViewport(enabled = true) {
  const dialog = useRef<HTMLDivElement | null>(null);
  const resize = useCallback(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport || !dialog.current) return;
    dialog.current.style.setProperty("--dialog-viewport-height", `${viewport.height}px`);
    dialog.current.style.setProperty("--dialog-viewport-top", `${viewport.offsetTop}px`);
    dialog.current.style.setProperty("--dialog-viewport-center", `${viewport.offsetTop + viewport.height / 2}px`);
  }, [enabled]);

  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, [enabled, resize]);

  return useCallback((element: HTMLDivElement | null) => {
    dialog.current = element;
    resize();
  }, [resize]);
}
