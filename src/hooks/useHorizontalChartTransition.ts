import { useLayoutEffect, useRef, useState, type RefObject } from "react";

type BarPosition = { left: number; top: number; width: number };

function getRows(chart: HTMLElement) {
  return Array.from(chart.querySelectorAll<HTMLElement>("[data-chart-row]"));
}

function getBar(row: HTMLElement) {
  return row.querySelector<HTMLElement>(".rj-chart-bar-horizontal");
}

function measureBar(bar: HTMLElement): BarPosition {
  const { left, top, width } = bar.getBoundingClientRect();
  return { left, top, width };
}

const slide: KeyframeAnimationOptions = { duration: 340, easing: "cubic-bezier(.2, .75, .25, 1)", fill: "backwards" };

/** Capture the painted bars before changing modes, including any in-flight slide. */
export function useHorizontalChartTransition(
  chartRef: RefObject<HTMLElement>,
  mode: string | undefined,
) {
  const snapshot = useRef<Map<string, BarPosition> | null>(null);
  const animations = useRef<Animation[]>([]);
  const [hasSwitched, setHasSwitched] = useState(false);

  function capture() {
    const chart = chartRef.current;
    snapshot.current = null;
    if (chart && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const positions = new Map<string, BarPosition>();
      for (const row of getRows(chart)) {
        const bar = getBar(row);
        if (bar) positions.set(row.dataset.chartRow!, measureBar(bar));
      }
      snapshot.current = positions;
    }
    setHasSwitched(true);
  }

  useLayoutEffect(() => {
    for (const animation of animations.current) animation.cancel();
    animations.current = [];

    const chart = chartRef.current;
    const before = snapshot.current;
    snapshot.current = null;
    if (!chart || !before) return;

    // Read destinations before applying transforms so no row affects the measurements.
    const rows = getRows(chart).flatMap((row) => {
      const bar = getBar(row);
      return bar ? [{ row, bar, next: measureBar(bar), previous: before.get(row.dataset.chartRow!) }] : [];
    });

    for (const { row, bar, previous, next } of rows) {
      if (!previous) {
        animations.current.push(row.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, fill: "backwards" }));
        continue;
      }

      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (dx || dy) {
        animations.current.push(row.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "none" },
        ], slide));
      }
      if (previous.width !== next.width) {
        animations.current.push(bar.animate([
          { width: `${previous.width}px` },
          { width: `${next.width}px` },
        ], slide));
      }
    }
  }, [chartRef, mode]);

  useLayoutEffect(() => () => {
    for (const animation of animations.current) animation.cancel();
  }, []);

  return { capture, hasSwitched };
}
