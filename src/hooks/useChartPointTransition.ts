import { useLayoutEffect, useRef, useState } from "react";

export type ChartPosition = { key: string; x: number; y: number };

function sampleLine(points: ChartPosition[], x: number) {
  const nextIndex = points.findIndex((point) => point.x >= x);
  if (nextIndex === 0) return points[0];
  if (nextIndex < 0) return points[points.length - 1];

  const previous = points[nextIndex - 1];
  const next = points[nextIndex];
  const fraction = (x - previous.x) / (next.x - previous.x);
  return { x, y: previous.y + (next.y - previous.y) * fraction };
}

/** Move shared points from their currently drawn positions and ease extra vertices onto the line. */
export function useChartPointTransition(points: ChartPosition[], enabled = true) {
  const [displayed, setDisplayed] = useState(points);
  const current = useRef(points);
  const previouslyEnabled = useRef(enabled);

  useLayoutEffect(() => {
    const previous = current.current;
    const canAnimate = previouslyEnabled.current && enabled && previous.length > 0 &&
      points.length > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    previouslyEnabled.current = enabled;

    function draw(next: ChartPosition[]) {
      current.current = next;
      setDisplayed(next);
    }

    if (!canAnimate || previous === points) {
      draw(points);
      return;
    }

    const previousKeys = new Set(previous.map((point) => point.key));
    const nextByKey = new Map(points.map((point) => [point.key, point]));
    const motion = [
      ...previous.map((point) => ({
        key: point.key,
        start: point,
        end: nextByKey.get(point.key) ?? sampleLine(points, point.x),
      })),
      ...points.filter((point) => !previousKeys.has(point.key)).map((point) => ({
        key: point.key,
        start: sampleLine(previous, point.x),
        end: point,
      })),
    ];
    if (motion.every(({ start, end }) => start.x === end.x && start.y === end.y)) {
      draw(points);
      return;
    }

    const startTime = performance.now();
    let request = 0;
    function step(now: number) {
      const progress = Math.min(1, Math.max(0, (now - startTime) / 340));
      if (progress === 1) {
        draw(points);
        return;
      }
      const eased = 1 - (1 - progress) ** 3;
      draw(motion.map(({ key, start, end }) => ({
        key,
        x: start.x + (end.x - start.x) * eased,
        y: start.y + (end.y - start.y) * eased,
      })).sort((a, b) => a.x - b.x));
      request = requestAnimationFrame(step);
    }
    step(startTime);
    return () => cancelAnimationFrame(request);
  }, [enabled, points]);

  return displayed;
}
