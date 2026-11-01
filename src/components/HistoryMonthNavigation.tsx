import { useRef, useState, type PointerEvent } from "react";

type HistoryMonth = {
  anchorId: string;
  label: string;
};

export default function HistoryMonthNavigation({ months }: { months: HistoryMonth[] }) {
  const navRef = useRef<HTMLElement>(null);
  const draggingPointer = useRef<number | null>(null);
  const touched = useRef(false);
  const lastDraggedMonth = useRef<number | null>(null);
  const [preview, setPreview] = useState<{ index: number; top: number } | null>(null);

  function showMonth(index: number) {
    const nav = navRef.current;
    const link = nav?.querySelectorAll<HTMLAnchorElement>("a")[index];
    if (!nav || !link) return;
    const rect = link.getBoundingClientRect();
    setPreview({ index, top: rect.top - nav.getBoundingClientRect().top + rect.height / 2 });
  }

  function goToMonth(index: number, dragging = false) {
    document.getElementById(months[index].anchorId)?.scrollIntoView({
      // Following a finger needs immediate movement; repeated smooth scrolling would lag behind it.
      behavior: dragging || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }

  function followFinger(event: PointerEvent<HTMLElement>, autoScroll = true) {
    const nav = navRef.current;
    if (!nav) return;
    const list = nav.firstElementChild as HTMLDivElement;
    const bounds = list.getBoundingClientRect();
    // Moving at either end also reveals months in longer histories.
    if (autoScroll && event.clientY < bounds.top + 16) list.scrollTop -= 24;
    if (autoScroll && event.clientY > bounds.bottom - 16) list.scrollTop += 24;

    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a"));
    let nearest = 0;
    let distance = Infinity;
    links.forEach((link, index) => {
      const rect = link.getBoundingClientRect();
      const nextDistance = Math.abs(event.clientY - (rect.top + rect.height / 2));
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = index;
      }
    });
    showMonth(nearest);
    if (nearest !== lastDraggedMonth.current) {
      lastDraggedMonth.current = nearest;
      goToMonth(nearest, true);
    }
  }

  return (
    <nav
      ref={navRef}
      aria-label="Reading history months"
      className="fixed right-1 top-1/2 z-30 -translate-y-1/2 select-none [-webkit-touch-callout:none] sm:right-3"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        touched.current = event.pointerType !== "mouse";
        if (!touched.current || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        draggingPointer.current = event.pointerId;
        lastDraggedMonth.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
        followFinger(event, false);
      }}
      onPointerMove={(event) => {
        if (draggingPointer.current === event.pointerId) followFinger(event);
      }}
      onPointerUp={() => { draggingPointer.current = null; }}
      onPointerCancel={() => {
        draggingPointer.current = null;
        setPreview(null);
      }}
      onLostPointerCapture={() => { draggingPointer.current = null; }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setPreview(null);
      }}
    >
      <div className="max-h-[calc(100dvh-14rem)] touch-none overflow-y-auto overscroll-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {months.map((month, index) => (
          <a
            key={month.anchorId}
            href={`#${month.anchorId}`}
            aria-label={month.label}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") showMonth(index);
            }}
            onFocus={() => showMonth(index)}
            onBlur={() => setPreview(null)}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              // Touch already navigated on pointer down/move. Keyboard clicks have detail 0.
              if (touched.current && event.detail !== 0) return;
              showMonth(index);
              goToMonth(index);
            }}
            className="group flex h-6 w-8 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span
              aria-hidden="true"
              className={`h-1 w-1 rounded-full ${preview?.index === index ? "bg-primary" : "bg-muted-foreground/40 group-hover:bg-primary"}`}
            />
          </a>
        ))}
      </div>
      {preview && (
        <span
          aria-hidden="true"
          style={{ top: preview.top }}
          className="pointer-events-none absolute right-full mr-1 -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-sm sm:text-xs"
        >
          {months[preview.index]?.label}
        </span>
      )}
    </nav>
  );
}
