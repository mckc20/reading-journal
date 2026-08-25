import { useEffect, useRef, useState, type ReactNode } from "react";
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
}

export default function AboutSection({
  title,
  text,
  emptyText = "No description yet.",
  clampClassName = "line-clamp-4",
  className,
}: AboutSectionProps) {
  const measurementRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasHiddenText, setHasHiddenText] = useState(false);
  const displayText = text?.trim();

  useEffect(() => {
    setExpanded(false);
  }, [displayText]);

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
  }, [clampClassName, displayText]);

  return (
    <section className={cn("space-y-4", className)}>
      <AppHeading level={2}>{title}</AppHeading>
      {displayText ? (
        <div className="relative space-y-3">
          <p
            ref={measurementRef}
            className={cn(
              "pointer-events-none invisible absolute inset-x-0 top-0 whitespace-pre-line text-sm leading-7 text-foreground/85",
              clampClassName,
            )}
            aria-hidden
          >
            {displayText}
          </p>
          <p
            className={cn(
              "whitespace-pre-line text-sm leading-7 text-foreground/85",
              hasHiddenText && !expanded && clampClassName,
            )}
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
      ) : (
        <p className="text-sm leading-7 text-muted-foreground">{emptyText}</p>
      )}
    </section>
  );
}
