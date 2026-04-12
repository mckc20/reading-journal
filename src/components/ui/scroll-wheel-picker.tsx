import { useRef, useEffect, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollWheelPickerItem {
  value: number;
  label: string;
}

interface ScrollWheelPickerProps {
  items: ScrollWheelPickerItem[];
  selectedValue: number;
  onChange: (value: number) => void;
  height?: number;
  itemHeight?: number;
  className?: string;
}

export function ScrollWheelPicker({
  items,
  selectedValue,
  onChange,
  height = 150,
  itemHeight = 40,
  className,
}: ScrollWheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [centerIndex, setCenterIndex] = useState(() => {
    const idx = items.findIndex((i) => i.value === selectedValue);
    return idx >= 0 ? idx : 0;
  });

  const spacer = (height - itemHeight) / 2;

  // Compute selected index from scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    isUserScrolling.current = true;
    const index = Math.round(el.scrollTop / itemHeight);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    setCenterIndex(clamped);

    // Debounce the onChange call to fire after scroll settles
    clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      isUserScrolling.current = false;
      if (items[clamped] && items[clamped].value !== selectedValue) {
        onChange(items[clamped].value);
      }
    }, 100);
  }, [items, itemHeight, onChange, selectedValue]);

  // Scroll to selected value on mount or when selectedValue changes externally
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isUserScrolling.current) return;

    const idx = items.findIndex((i) => i.value === selectedValue);
    if (idx < 0) return;

    setCenterIndex(idx);
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      el.scrollTo({ top: idx * itemHeight, behavior: "auto" });
    });
  }, [selectedValue, items, itemHeight]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(scrollTimeout.current);
  }, []);

  function itemOpacity(index: number): string {
    const dist = Math.abs(index - centerIndex);
    if (dist === 0) return "opacity-100";
    if (dist === 1) return "opacity-50";
    return "opacity-25";
  }

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg", className)}
      style={{ height }}
    >
      {/* Gradient overlay top */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none bg-gradient-to-b from-background to-transparent"
        style={{ height: spacer }}
      />

      {/* Selection indicator */}
      <div
        className="absolute left-2 right-2 z-10 pointer-events-none border-t border-b border-border rounded-sm"
        style={{ top: spacer, height: itemHeight }}
      />

      {/* Scrollable list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory"
        style={{
          scrollbarWidth: "none",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Top spacer */}
        <div style={{ height: spacer }} />

        {items.map((item, index) => (
          <div
            key={item.value}
            className={cn(
              "snap-center flex items-center justify-center transition-opacity duration-150 select-none text-sm font-medium",
              itemOpacity(index)
            )}
            style={{ height: itemHeight }}
          >
            {item.label}
          </div>
        ))}

        {/* Bottom spacer */}
        <div style={{ height: spacer }} />
      </div>

      {/* Gradient overlay bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none bg-gradient-to-t from-background to-transparent"
        style={{ height: spacer }}
      />

      {/* Hide webkit scrollbar */}
      <style>{`
        div[class*="snap-y"]::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
