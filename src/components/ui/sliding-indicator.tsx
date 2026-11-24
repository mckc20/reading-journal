import { useLayoutEffect, useRef } from "react";

const defaultActiveSelector = '[aria-current="page"], [aria-pressed="true"], [data-slot="tabs-trigger"][data-state="active"]';

/** Tracks the active control without changing its keyboard or routing behavior. */
export function SlidingIndicator({ activeSelector = defaultActiveSelector }: { activeSelector?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const indicator = ref.current;
    const track = indicator?.parentElement;
    if (!indicator || !track) return;

    const update = () => {
      const tab = Array.from(track.children).find((child): child is HTMLElement =>
        child instanceof HTMLElement && child.matches(activeSelector),
      );
      indicator.hidden = !tab || !tab.offsetWidth;
      if (!tab || indicator.hidden) return;

      const line = track.dataset.variant === "line";
      const vertical = track.dataset.orientation === "vertical";
      const x = tab.offsetLeft + (line && vertical ? tab.offsetWidth : 0);
      const y = tab.offsetTop + (line && !vertical ? tab.offsetHeight : 0);
      indicator.style.setProperty("--tab-x", `${x}px`);
      indicator.style.setProperty("--tab-y", `${y}px`);
      indicator.style.setProperty("--tab-width", `${line && vertical ? 2 : tab.offsetWidth}px`);
      indicator.style.setProperty("--tab-height", `${line && !vertical ? 2 : tab.offsetHeight}px`);
    };

    const resize = new ResizeObserver(update);
    const watchSizes = () => {
      resize.disconnect();
      resize.observe(track);
      Array.from(track.children).forEach(child => {
        if (child !== indicator) resize.observe(child);
      });
    };
    const changes = new MutationObserver((records) => {
      if (records.some(record => record.type === "childList")) watchSizes();
      update();
    });
    changes.observe(track, {
      attributes: true,
      attributeFilter: ["aria-current", "aria-pressed", "data-state", "data-highlighted"],
      childList: true,
      subtree: true,
    });
    watchSizes();
    update();

    return () => {
      resize.disconnect();
      changes.disconnect();
    };
  }, [activeSelector]);

  return <span ref={ref} className="rj-tab-indicator" aria-hidden="true" hidden />;
}
