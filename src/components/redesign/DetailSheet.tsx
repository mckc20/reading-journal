import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import "./book-details.css";

export const DETAIL_SHEET_MEDIA = "(max-width: 767px)";

export function DetailSheet({
  label,
  fallbackTo,
  children,
}: {
  label: string;
  fallbackTo: string;
  children: (close: () => void) => ReactNode;
}) {
  const navigate = useNavigate();
  const sheetRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const closingAnimation = useRef<Animation | null>(null);

  const close = useCallback(() => {
    if (closingAnimation.current) return;

    function leave() {
      if (window.history.state?.idx > 0) {
        navigate(-1);
      } else {
        navigate(fallbackTo, { replace: true });
      }
    }

    const sheet = sheetRef.current;
    if (!sheet || !window.matchMedia(DETAIL_SHEET_MEDIA).matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      leave();
      return;
    }

    const animation = sheet.animate(
      [{ transform: getComputedStyle(sheet).transform }, { transform: "translateY(100%)" }],
      { duration: 165, easing: "cubic-bezier(.25, .35, .65, 1)", fill: "forwards" },
    );
    closingAnimation.current = animation;
    void animation.finished.then(leave, () => {
      // Leaving through browser history or navigation cancels this animation.
    });
  }, [fallbackTo, navigate]);

  useEffect(() => {
    const sheet = sheetRef.current;
    const scroller = scrollerRef.current;
    if (!sheet || !scroller) return;
    const phone = window.matchMedia(DETAIL_SHEET_MEDIA);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (phone.matches) sheet.focus({ preventScroll: true });

    let start: { x: number; y: number; id: number; dragging: boolean } | null = null;
    let settle: Animation | null = null;

    function resetDrag() {
      start = null;
      settle?.cancel();
      settle = null;
      if (!sheet?.style.getPropertyValue("--sheet-drag-transform")) return;
      const transform = getComputedStyle(sheet).transform;
      sheet.style.removeProperty("--sheet-drag-transform");
      if (!reducedMotion.matches) {
        settle = sheet.animate([{ transform }, { transform: "none" }], {
          duration: 220,
          easing: "cubic-bezier(.2, .75, .25, 1)",
        });
      }
    }

    function onTouchStart(event: TouchEvent) {
      if (closingAnimation.current) return;
      if (event.touches.length !== 1) {
        resetDrag();
        return;
      }
      if (!phone.matches || settle?.playState === "running" || (scroller?.scrollTop ?? 0) !== 0 ||
        sheet?.getAnimations().some((animation) => animation.playState === "running") ||
        !(event.target instanceof Element) ||
        event.target.closest("button, a, input, select, textarea, summary")) return;

      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY, id: touch.identifier, dragging: false };
    }

    function onTouchMove(event: TouchEvent) {
      if (!start || !sheet) return;
      const touch = Array.from(event.touches).find(({ identifier }) => identifier === start?.id);
      if (!touch) return;
      const dx = Math.abs(touch.clientX - start.x);
      const dy = touch.clientY - start.y;

      if (!start.dragging && Math.max(dx, Math.abs(dy)) < 5) return;
      if (!start.dragging && (dy <= dx * 1.25 || (scroller?.scrollTop ?? 0) > 0 || !event.cancelable)) {
        start = null;
        return;
      }

      start.dragging = true;
      if (event.cancelable) event.preventDefault();
      if (!reducedMotion.matches) {
        // Snap to physical pixels so the rounded edge stays crisp while held.
        const distance = Math.min(sheet.clientHeight, Math.max(0, dy));
        const offset = Math.round(distance * window.devicePixelRatio) / window.devicePixelRatio;
        sheet.style.setProperty("--sheet-drag-transform", `translateY(${offset}px)`);
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (!start) return;
      const touch = Array.from(event.changedTouches).find(({ identifier }) => identifier === start?.id);
      const shouldClose = start.dragging && touch && touch.clientY - start.y >= 80;
      if (shouldClose) {
        start = null;
        close();
      } else {
        resetDrag();
      }
    }

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", resetDrag, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", resetDrag);
      settle?.cancel();
      if (closingAnimation.current) {
        closingAnimation.current.cancel();
        closingAnimation.current = null;
      }
    };
  }, [close]);

  return (
    <section className="rj-detail-sheet" ref={sheetRef} tabIndex={-1} aria-label={label}>
      <div className="rj-detail-scroll" ref={scrollerRef}>
        {children(close)}
      </div>
    </section>
  );
}

export function DetailBack({ label, fallbackTo, onClose }: {
  label: string;
  fallbackTo: string;
  onClose: () => void;
}) {
  return (
    <>
      <Button type="button" variant="ghost" size="icon-lg" className="size-11 md:hidden" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}>
        <ChevronDown className="size-6" aria-hidden="true" />
      </Button>
      <BackButton fallbackTo={fallbackTo} className="hidden min-h-11 min-w-11 md:inline-flex" />
    </>
  );
}
