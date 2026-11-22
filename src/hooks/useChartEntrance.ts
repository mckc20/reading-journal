import { useEffect, useRef, useState } from "react";

/** Start the animation on the first visible frame, including charts below the fold. */
export function useChartEntrance<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (visible || !element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        setVisible(true);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  });

  return { ref, "data-chart-motion": visible ? "ready" : "waiting" } as const;
}
