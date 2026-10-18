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
    let target = markdown?.lastElementChild ?? null;
    // Place the mark inside the final text block, so formatted paragraphs and
    // lists keep their layout while the mark flows directly after the text.
    while (target?.lastElementChild && target.matches("ul, ol, blockquote, div") && !target.lastElementChild.hasAttribute("data-quote-closing")) {
      target = target.lastElementChild;
    }
    if (target?.matches("img, hr, br, input")) target = markdown ?? null;
    setClosingMarkTarget(target);
  }, [children]);

  const quotationMarkClassName = cn(
    "font-serif text-4xl font-semibold leading-none text-primary",
    markClassName,
  );

  const closingMark = (
    <span data-quote-closing aria-hidden="true" className={cn(quotationMarkClassName, "relative top-3 ml-5 inline-block align-top")}>
      ”
    </span>
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
          {closingMarkTarget ? createPortal(closingMark, closingMarkTarget) : closingMark}
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
