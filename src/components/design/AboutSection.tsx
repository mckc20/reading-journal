import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronRight } from "lucide-react";
import { AppHeading } from "@/components/design/Typography";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AboutSectionProps {
  title: ReactNode;
  text?: string | null;
  emptyText?: string;
  clampClassName?: string;
  className?: string;
  titleContent?: ReactNode;
  collapsedBottomRef?: RefObject<HTMLElement | null>;
  collapsedBottomMinWidth?: number;
}

export default function AboutSection({
  title,
  text,
  emptyText = "No description yet.",
  clampClassName = "line-clamp-4",
  className,
  titleContent,
  collapsedBottomRef,
  collapsedBottomMinWidth = 0,
}: AboutSectionProps) {
  const measurementRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasHiddenText, setHasHiddenText] = useState(false);
  const [matchedCollapsedHeight, setMatchedCollapsedHeight] = useState<number | null>(null);
  const displayText = text?.trim();
  const usesMatchedHeight = matchedCollapsedHeight !== null;
  const collapsedTextStyle: CSSProperties | undefined = usesMatchedHeight
    ? { maxHeight: `${matchedCollapsedHeight}px` }
    : undefined;
  const collapsedTextClassName = usesMatchedHeight ? "overflow-hidden" : clampClassName;

  useEffect(() => {
    setExpanded(false);
  }, [displayText]);

  useEffect(() => {
    const textElement = measurementRef.current;
    const bottomElement = collapsedBottomRef?.current;

    if (!textElement || !bottomElement || !displayText) {
      setMatchedCollapsedHeight(null);
      return;
    }

    const measure = () => {
      if (collapsedBottomMinWidth > 0 && window.innerWidth < collapsedBottomMinWidth) {
        setMatchedCollapsedHeight(null);
        return;
      }

      const textTop = textElement.getBoundingClientRect().top;
      const targetBottom = bottomElement.getBoundingClientRect().bottom;
      const nextHeight = Math.max(0, Math.floor(targetBottom - textTop));
      setMatchedCollapsedHeight((current) => (Math.abs((current ?? -1) - nextHeight) > 1 ? nextHeight : current));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(textElement);
    observer.observe(bottomElement);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [collapsedBottomMinWidth, collapsedBottomRef, displayText]);

  useEffect(() => {
    const element = measurementRef.current;
    if (!element || !displayText) {
      setHasHiddenText(false);
      return;
    }

    const measure = () => {
      setHasHiddenText(element.scrollHeight > element.clientHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [clampClassName, displayText, matchedCollapsedHeight, usesMatchedHeight]);

  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-3">
        <AppHeading level={2}>{title}</AppHeading>
        {titleContent}
      </div>
      {displayText ? (
        <div className="relative space-y-3">
          <p
            ref={measurementRef}
            className={cn(
              "pointer-events-none invisible absolute inset-x-0 top-0 whitespace-pre-line text-sm leading-7 text-foreground/85",
              collapsedTextClassName,
            )}
            style={collapsedTextStyle}
            aria-hidden
          >
            {displayText}
          </p>
          <p
            className={cn(
              "whitespace-pre-line text-sm leading-7 text-foreground/85",
              hasHiddenText && !expanded && collapsedTextClassName,
            )}
            style={hasHiddenText && !expanded ? collapsedTextStyle : undefined}
          >
            {displayText}
          </p>
          {hasHiddenText && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Show more"}
              <ChevronRight
                className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
              />
            </Button>
          )}
        </div>
      ) : emptyText ? (
        <p className="text-sm leading-7 text-muted-foreground">{emptyText}</p>
      ) : null}
    </section>
  );
}
