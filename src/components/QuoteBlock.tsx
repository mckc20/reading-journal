import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface QuoteBlockProps {
  children: ReactNode;
  attribution?: ReactNode;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  attributionClassName?: string;
  markClassName?: string;
}

export function ClosingQuoteMark() {
  return <span data-quote-closing aria-hidden="true">{"\u2060”"}</span>;
}

export default function QuoteBlock({
  children,
  attribution,
  actions,
  className,
  contentClassName,
  attributionClassName,
  markClassName,
}: QuoteBlockProps) {
  const contentRef = useRef<HTMLQuoteElement>(null);
  const [closingMarkTarget, setClosingMarkTarget] = useState<Element | null>(null);

  useLayoutEffect(() => {
    const markdownBlocks = contentRef.current?.querySelectorAll(".journal-markdown");
    const markdown = markdownBlocks?.[markdownBlocks.length - 1];
    if (!markdown) {
      setClosingMarkTarget(null);
      return;
    }
    // Find the last text block even if a list, image or divider ends the Markdown.
    const walker = document.createTreeWalker(markdown, NodeFilter.SHOW_TEXT);
    let text = walker.lastChild();
    while (text && (!text.textContent?.trim() || text.parentElement?.closest("[data-quote-closing]"))) {
      text = walker.previousNode();
    }
    setClosingMarkTarget(
      text?.parentElement?.closest("p, li, td, th, pre, h1, h2, h3, h4, h5, h6, blockquote, div") ?? null,
    );
  }, [children]);

  const quotationMarkClassName = cn(
    "font-serif text-4xl font-semibold leading-none text-primary",
    markClassName,
  );

  return (
    <figure className={cn("grid grid-cols-[2.25rem_1fr] gap-x-3", className)}>
      <div aria-hidden="true" className="flex justify-center">
        <span
          className={quotationMarkClassName}
        >
          “
        </span>
      </div>
      <div className="min-w-0">
        <blockquote
          ref={contentRef}
          className={cn(
            "font-heading text-base leading-7 text-foreground",
            contentClassName,
          )}
        >
          {children}
          {closingMarkTarget && createPortal(<ClosingQuoteMark />, closingMarkTarget)}
        </blockquote>
        {(attribution || actions) && (
          <figcaption
            className={cn(
              "mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground",
              attributionClassName,
            )}
          >
            <div className="min-w-0">{attribution}</div>
            {actions}
          </figcaption>
        )}
      </div>
    </figure>
  );
}
