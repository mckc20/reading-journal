import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ListChecks } from "lucide-react";
import {
  paginateJournalBookEntries,
  type JournalBookPaginatedItem,
  type JournalBookPaginationItem,
} from "@/lib/journalBookPagination";
import { cn } from "@/lib/utils";

export interface BookViewEntry extends JournalBookPaginationItem {
  date: string;
  label: string;
  tags: string[];
}

interface BookViewProps<T extends BookViewEntry> {
  title: string;
  subtitle?: string;
  entries: T[];
  className?: string;
  renderEntry: (entry: JournalBookPaginatedItem<T>) => ReactNode;
  renderComposer?: () => ReactNode;
}

const BOOK_PAGE_CLASS_NAME = "h-[clamp(34rem,calc(100vh-18rem),48rem)]";
const MEASUREMENT_TOLERANCE_PX = 2;

type BookPage<T extends BookViewEntry> =
  | { id: string; type: "cover"; entries: T[] }
  | { id: string; type: "journal"; entries: Array<JournalBookPaginatedItem<T>> };

type MeasurementRequest<T extends BookViewEntry> = {
  id: number;
  entries: Array<JournalBookPaginatedItem<T>>;
};

type MeasurementResult = {
  fits: boolean;
  height: number;
  availableHeight: number;
  lastEntryLineCount: number;
};

function getRenderedContentHeight(element: HTMLElement): number {
  const measuredEntries = Array.from(element.querySelectorAll("[data-book-entry-measure]"));
  if (measuredEntries.length === 0) return 0;

  const containerRect = element.getBoundingClientRect();
  const contentBottom = measuredEntries.reduce((bottom, entry) => {
    const entryRect = entry.getBoundingClientRect();
    return Math.max(bottom, entryRect.bottom);
  }, containerRect.top);

  return Math.max(0, contentBottom - containerRect.top);
}

function formatJournalDate(value: string): string {
  const dateValue = value.includes("T") ? value : `${value}T00:00:00`;
  return new Date(dateValue).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDateRange(entries: BookViewEntry[]): string {
  if (entries.length === 0) return "No entries yet";
  const sortedDates = entries.map((entry) => entry.date).sort((a, b) => a.localeCompare(b));
  const first = sortedDates[0];
  const last = sortedDates[sortedDates.length - 1];
  if (first === last) return formatJournalDate(first);
  return `${formatJournalDate(first)} - ${formatJournalDate(last)}`;
}

function useSinglePageBookLayout(): boolean {
  const [singlePage, setSinglePage] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const update = () => setSinglePage(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return singlePage;
}

function CoverPage({ title, subtitle, entries }: { title: string; subtitle?: string; entries: BookViewEntry[] }) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center px-8 py-12 text-center", BOOK_PAGE_CLASS_NAME)}>
      <BookOpen className="mb-8 h-8 w-8 text-primary" aria-hidden="true" />
      <h2 className="max-w-md font-heading text-4xl font-medium leading-tight text-foreground">{title}</h2>
      <p className="mt-3 text-sm text-muted-foreground">{subtitle ?? "Reading Journal"}</p>
      <div className="mt-8 h-px w-48 bg-border" />
      <p className="mt-6 text-sm text-foreground">{getDateRange(entries)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {entries.length} {entries.length === 1 ? "entry" : "entries"}
      </p>
    </div>
  );
}

function JournalPage<T extends BookViewEntry>({
  pageNumber,
  entries,
  renderEntry,
}: {
  pageNumber: number;
  entries: Array<JournalBookPaginatedItem<T>>;
  renderEntry: (entry: JournalBookPaginatedItem<T>) => ReactNode;
}) {
  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden px-6 py-8 sm:px-8 md:px-10 md:py-12", BOOK_PAGE_CLASS_NAME)}>
      <div className="min-h-0 flex-1 overflow-hidden">
        {entries.map((entry) => (
          <div key={entry.id}>{renderEntry(entry)}</div>
        ))}
      </div>
      <p className="pt-4 text-center text-xs text-muted-foreground">Page {pageNumber}</p>
    </div>
  );
}

function tokenizeForPagination(value: string): string[] {
  return value.match(/\s+|\S+/g) ?? [];
}

function countRenderedTextLines(element: Element | null): number {
  if (!element || typeof document === "undefined") return 0;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const lineTops = new Set<number>();
  let currentNode = walker.nextNode();

  while (currentNode) {
    const text = currentNode.textContent ?? "";
    if (text.trim()) {
      const range = document.createRange();
      range.selectNodeContents(currentNode);
      Array.from(range.getClientRects()).forEach((rect) => {
        if (rect.width > 0 && rect.height > 0) {
          lineTops.add(Math.round(rect.top));
        }
      });
      range.detach();
    }

    currentNode = walker.nextNode();
  }

  return lineTops.size;
}

function makeBookSegment<T extends BookViewEntry>(
  item: T,
  content: string,
  segmentIndex: number,
  segmentCount: number,
  sourceStart = 0,
): JournalBookPaginatedItem<T> {
  const split = segmentCount > 1;
  const isFirst = segmentIndex === 0;
  const isLast = segmentIndex === segmentCount - 1;

  return {
    ...item,
    id: split ? `${item.id}:book-page-segment-${segmentIndex + 1}` : item.id,
    originalId: item.id,
    content,
    segmentIndex,
    segmentCount,
    isContinuation: segmentIndex > 0,
    sourceStart,
    sourceEnd: sourceStart + content.length,
    tagCount: isLast ? item.tagCount : 0,
    hasAttribution: isFirst ? item.hasAttribution : false,
    childCount: isFirst ? item.childCount : 0,
    headingWeight: isFirst ? item.headingWeight : 0,
    forceNewPage: false,
  };
}

function finalizeBookSegments<T extends BookViewEntry>(item: T, chunks: string[]): Array<JournalBookPaginatedItem<T>> {
  let sourceStart = 0;
  return chunks.map((content, index) => {
    const segment = makeBookSegment(item, content, index, chunks.length, sourceStart);
    sourceStart += content.length;
    return segment;
  });
}

function fallbackSplitContent(value: string): [string, string] {
  if (value.length <= 1) return [value, ""];

  const midpoint = Math.max(1, Math.floor(value.length / 2));
  const splitIndex = value.lastIndexOf(" ", midpoint);
  const index = splitIndex > 0 ? splitIndex + 1 : midpoint;

  return [value.slice(0, index), value.slice(index)];
}

function useMeasuredJournalPages<T extends BookViewEntry>({
  entries,
  renderEntry,
  singlePage,
  gridRef,
}: {
  entries: T[];
  renderEntry: (entry: JournalBookPaginatedItem<T>) => ReactNode;
  singlePage: boolean;
  gridRef: RefObject<HTMLDivElement>;
}) {
  const fallbackPages = useMemo(() => paginateJournalBookEntries(entries), [entries]);
  const [journalPages, setJournalPages] = useState(fallbackPages);
  const [measurePageWidth, setMeasurePageWidth] = useState<number | null>(null);
  const [measurementRequest, setMeasurementRequest] = useState<MeasurementRequest<T> | null>(null);
  const measurementContentRef = useRef<HTMLDivElement>(null);
  const measurementResolverRef = useRef<((result: MeasurementResult) => void) | null>(null);
  const measurementIdRef = useRef(0);

  useEffect(() => {
    setJournalPages(fallbackPages);
  }, [fallbackPages]);

  useEffect(() => {
    const element = gridRef.current;
    if (!element) return;
    const observedElement = element;

    function updateWidth() {
      const width = observedElement.getBoundingClientRect().width;
      setMeasurePageWidth(width / (singlePage ? 1 : 2));
    }

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(observedElement);

    return () => observer.disconnect();
  }, [gridRef, singlePage]);

  useLayoutEffect(() => {
    if (!measurementRequest) return;

    const frameId = window.requestAnimationFrame(() => {
      const contentElement = measurementContentRef.current;
      const resolver = measurementResolverRef.current;
      if (!contentElement || !resolver) return;

      const height = getRenderedContentHeight(contentElement);
      const availableHeight = contentElement.clientHeight;
      const measuredEntries = contentElement.querySelectorAll("[data-book-entry-measure]");
      const lastMeasuredEntry = measuredEntries[measuredEntries.length - 1] ?? null;
      const lastEntryBody = lastMeasuredEntry?.querySelector(".journal-markdown") ?? lastMeasuredEntry;
      resolver({
        fits: height <= availableHeight + MEASUREMENT_TOLERANCE_PX,
        height,
        availableHeight,
        lastEntryLineCount: countRenderedTextLines(lastEntryBody),
      });
      measurementResolverRef.current = null;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [measurementRequest]);

  const measure = useCallback((candidateEntries: Array<JournalBookPaginatedItem<T>>): Promise<MeasurementResult> => {
    return new Promise((resolve) => {
      measurementResolverRef.current = resolve;
      measurementIdRef.current += 1;
      setMeasurementRequest({
        id: measurementIdRef.current,
        entries: candidateEntries,
      });
    });
  }, []);

  const splitToFit = useCallback(async (
    leadingEntries: Array<JournalBookPaginatedItem<T>>,
    item: T,
    remainingContent: string,
    segmentIndex: number,
    sourceStart: number,
  ): Promise<[string, string]> => {
    const tokens = tokenizeForPagination(remainingContent);
    if (tokens.length <= 1) {
      const [head, tail] = fallbackSplitContent(remainingContent);
      const fallbackCandidate = makeBookSegment(item, head, segmentIndex, segmentIndex + 2, sourceStart);
      const fallbackResult = await measure([...leadingEntries, fallbackCandidate]);

      const startsNewEntryAtPageBottom = leadingEntries.length > 0 && segmentIndex === 0;
      if (fallbackResult.fits && (!startsNewEntryAtPageBottom || fallbackResult.lastEntryLineCount > 1)) {
        return [head, tail];
      }
      if (leadingEntries.length === 0) return [head, tail];
      return ["", remainingContent];
    }

    let low = 1;
    let high = tokens.length - 1;
    let best = "";
    let bestTokenCount = 0;

    while (low <= high) {
      const midpoint = Math.floor((low + high) / 2);
      const candidateContent = tokens.slice(0, midpoint).join("");
      const candidate = makeBookSegment(item, candidateContent, segmentIndex, segmentIndex + 2, sourceStart);
      const result = await measure([...leadingEntries, candidate]);

      if (result.fits) {
        best = candidateContent;
        bestTokenCount = midpoint;
        low = midpoint + 1;
      } else {
        high = midpoint - 1;
      }
    }

    if (!best && leadingEntries.length > 0) return ["", remainingContent];
    if (!best) return fallbackSplitContent(remainingContent);

    for (let tokenCount = bestTokenCount; tokenCount >= 1; tokenCount -= 1) {
      const candidateContent = tokens.slice(0, tokenCount).join("");
      const candidate = makeBookSegment(item, candidateContent, segmentIndex, segmentIndex + 2, sourceStart);
      const candidateResult = await measure([...leadingEntries, candidate]);

      if (!candidateResult.fits) continue;
      if (
        leadingEntries.length > 0 &&
        segmentIndex === 0 &&
        candidateResult.lastEntryLineCount <= 1
      ) {
        continue;
      }

      return [candidateContent, remainingContent.slice(candidateContent.length)];
    }

    if (leadingEntries.length > 0) return ["", remainingContent];
    return [best, remainingContent.slice(best.length)];
  }, [measure]);

  useEffect(() => {
    let cancelled = false;

    async function buildMeasuredPages() {
      if (!measurePageWidth || entries.length === 0) {
        setJournalPages(fallbackPages);
        return;
      }

      if ("fonts" in document) {
        await document.fonts.ready;
        if (cancelled) return;
      }

      const pages: Array<{ id: string; entries: Array<JournalBookPaginatedItem<T>>; weight: number }> = [];
      let currentEntries: Array<JournalBookPaginatedItem<T>> = [];

      function pushCurrentPage() {
        if (currentEntries.length === 0) return;
        pages.push({
          id: `journal-page-${pages.length + 1}`,
          entries: currentEntries,
          weight: 0,
        });
        currentEntries = [];
      }

      for (const item of entries) {
        if (cancelled) return;
        if (item.forceNewPage) pushCurrentPage();

        const wholeEntry = makeBookSegment(item, item.content, 0, 1);
        const wholeCandidate = [...currentEntries, wholeEntry];
        const wholeResult = await measure(wholeCandidate);
        if (cancelled) return;

        if (wholeResult.fits) {
          currentEntries = wholeCandidate;
          continue;
        }

        let remainingContent = item.content;
        const chunks: string[] = [];
        let firstChunkLeadingEntries: Array<JournalBookPaginatedItem<T>> | null = null;

        if (currentEntries.length > 0) {
          const [head, tail] = await splitToFit(currentEntries, item, remainingContent, 0, 0);
          if (cancelled) return;

          if (head) {
            firstChunkLeadingEntries = currentEntries;
            currentEntries = [];
            chunks.push(head);
            remainingContent = tail;
          } else {
            pushCurrentPage();
            const emptyPageWholeResult = await measure([wholeEntry]);
            if (cancelled) return;

            if (emptyPageWholeResult.fits) {
              currentEntries = [wholeEntry];
              continue;
            }
          }
        }

        while (remainingContent.length > 0) {
          const segmentIndex = chunks.length;
          const sourceStart = item.content.length - remainingContent.length;
          const finalCandidate = makeBookSegment(item, remainingContent, segmentIndex, segmentIndex + 1, sourceStart);
          const finalCandidateResult = await measure([finalCandidate]);
          if (cancelled) return;

          if (finalCandidateResult.fits) {
            chunks.push(remainingContent);
            remainingContent = "";
            break;
          }

          const [head, tail] = await splitToFit([], item, remainingContent, segmentIndex, sourceStart);
          if (cancelled) return;

          if (!head) break;
          chunks.push(head);
          remainingContent = tail;
        }

        const finalSegments = finalizeBookSegments(item, chunks.length > 0 ? chunks : [item.content]);
        finalSegments.forEach((segment, index) => {
          if (index < finalSegments.length - 1) {
            pages.push({
              id: `journal-page-${pages.length + 1}`,
              entries: index === 0 && firstChunkLeadingEntries ? [...firstChunkLeadingEntries, segment] : [segment],
              weight: 0,
            });
            return;
          }

          currentEntries = [segment];
        });
      }

      pushCurrentPage();
      if (!cancelled) setJournalPages(pages);
    }

    void buildMeasuredPages();

    return () => {
      cancelled = true;
    };
  }, [entries, fallbackPages, measure, measurePageWidth, splitToFit]);

  const measurementNode = (
    <div
      className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] opacity-0"
      aria-hidden="true"
      style={{ width: measurePageWidth ?? 700 }}
    >
      <div className={cn("flex flex-1 flex-col overflow-hidden px-6 py-8 sm:px-8 md:px-10 md:py-12", BOOK_PAGE_CLASS_NAME)}>
        <div ref={measurementContentRef} className="min-h-0 flex-1 overflow-hidden">
          {measurementRequest?.entries.map((entry) => (
            <div key={`${measurementRequest.id}:${entry.id}`} data-book-entry-measure>
              {renderEntry(entry)}
            </div>
          ))}
        </div>
        <p className="pt-4 text-center text-xs text-muted-foreground">Page</p>
      </div>
    </div>
  );

  return { journalPages, measurementNode };
}

function EmptyPage({ pageNumber }: { pageNumber: number }) {
  return (
    <div className={cn("hidden flex-1 items-end justify-center px-6 py-8 md:flex md:px-10 md:py-12", BOOK_PAGE_CLASS_NAME)}>
      <p className="text-xs text-muted-foreground">Page {pageNumber}</p>
    </div>
  );
}

function AnnotationSidebar({ entries }: { entries: BookViewEntry[] }) {
  const labelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => counts.set(entry.label, (counts.get(entry.label) ?? 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [entries]);
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => entry.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts.entries()].sort(([, leftCount], [, rightCount]) => rightCount - leftCount).slice(0, 5);
  }, [entries]);
  const activeDates = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => counts.set(entry.date.slice(0, 10), (counts.get(entry.date.slice(0, 10)) ?? 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => right.localeCompare(left)).slice(0, 6);
  }, [entries]);

  return (
    <aside className="hidden w-56 shrink-0 border-l border-border/80 px-7 py-10 xl:block" aria-label="Journal summary">
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
          Mini Calendar
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          {activeDates.length === 0 ? (
            <p>No dated entries</p>
          ) : (
            activeDates.map(([date, count]) => (
              <div key={date} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0">
                <span>{formatJournalDate(date)}</span>
                <span>{count}</span>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="mt-10 border-t border-border pt-8">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
          Annotations
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {labelCounts.map(([label, count]) => (
            <div key={label} className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>{label}</span>
              <span>{count}</span>
            </div>
          ))}
          {tagCounts.length > 0 && <div className="border-t border-border pt-3" />}
          {tagCounts.map(([tag, count]) => (
            <div key={tag} className="flex items-center justify-between gap-3 text-muted-foreground">
              <span className="truncate">{tag}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function PaginationControls({
  pageIndex,
  pageCount,
  pageStep,
  onPageIndexChange,
}: {
  pageIndex: number;
  pageCount: number;
  pageStep: number;
  onPageIndexChange: (pageIndex: number) => void;
}) {
  const lastPageIndex = Math.max(0, pageCount - 1);
  const lastSpreadStart = pageStep > 1 ? Math.floor(lastPageIndex / pageStep) * pageStep : lastPageIndex;
  const canGoPrevious = pageIndex > 0;
  const canGoNext = pageIndex < lastSpreadStart;
  const visibleEndPage = Math.min(pageCount, pageIndex + pageStep);
  const pageLabel = pageStep > 1 && visibleEndPage > pageIndex + 1
    ? `Pages ${pageIndex + 1}-${visibleEndPage} of ${pageCount}`
    : `Page ${pageIndex + 1} of ${pageCount}`;
  const iconButtonClassName = "inline-flex h-9 w-9 items-center justify-center rounded-full bg-transparent text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={iconButtonClassName}
            onClick={() => onPageIndexChange(0)}
            disabled={!canGoPrevious}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconButtonClassName}
            onClick={() => onPageIndexChange(Math.max(0, pageIndex - pageStep))}
            disabled={!canGoPrevious}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          {pageLabel}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={iconButtonClassName}
            onClick={() => onPageIndexChange(Math.min(lastSpreadStart, pageIndex + pageStep))}
            disabled={!canGoNext}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={iconButtonClassName}
            onClick={() => onPageIndexChange(lastSpreadStart)}
            disabled={!canGoNext}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={pageCount}
        value={pageIndex + 1}
        aria-label="Journal page"
        className="h-2 w-full accent-primary"
        onChange={(event) => onPageIndexChange(Number(event.target.value) - 1)}
      />
    </div>
  );
}

export default function BookView<T extends BookViewEntry>({
  title,
  subtitle,
  entries,
  className,
  renderEntry,
  renderComposer,
}: BookViewProps<T>) {
  const singlePage = useSinglePageBookLayout();
  const gridRef = useRef<HTMLDivElement>(null);
  const { journalPages, measurementNode } = useMeasuredJournalPages({
    entries,
    renderEntry,
    singlePage,
    gridRef,
  });
  const pages = useMemo(
    () => [
      { id: "cover", type: "cover" as const, entries: [] as T[] },
      ...journalPages.map((page) => ({ id: page.id, type: "journal" as const, entries: page.entries })),
    ] satisfies Array<BookPage<T>>,
    [journalPages],
  );
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = Math.max(1, pages.length);

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const spreadStart = singlePage ? pageIndex : Math.floor(pageIndex / 2) * 2;
  const visiblePages = singlePage ? [pages[pageIndex]] : [pages[spreadStart], pages[spreadStart + 1]].filter(Boolean);
  const navigationStep = singlePage ? 1 : 2;

  return (
    <div className={cn("space-y-5", className)}>
      {renderComposer?.()}
      {measurementNode}
      <div className="mx-auto flex w-full max-w-[1400px] rounded-[20px] border border-border bg-background">
        <div
          ref={gridRef}
          className={cn("relative grid min-w-0 flex-1 grid-cols-1 md:grid-cols-2", !singlePage && "md:before:absolute md:before:inset-y-0 md:before:left-1/2 md:before:w-px md:before:bg-border")}
        >
          {visiblePages.map((page, visibleIndex) => {
            const realPageIndex = singlePage ? pageIndex : spreadStart + visibleIndex;
            const isLeft = visibleIndex === 0;
            const isRight = visibleIndex === 1;

            return (
              <div
                key={page.id}
                className={cn(
                  "min-w-0",
                  isLeft && "rounded-l-[20px]",
                  isRight && "rounded-r-[20px]",
                )}
              >
                {page.type === "cover" ? (
                  <CoverPage title={title} subtitle={subtitle} entries={entries} />
                ) : (
                  <JournalPage pageNumber={realPageIndex + 1} entries={page.entries} renderEntry={renderEntry} />
                )}
              </div>
            );
          })}
          {!singlePage && visiblePages.length === 1 && <EmptyPage pageNumber={spreadStart + 2} />}
        </div>
        <AnnotationSidebar entries={entries} />
      </div>
      <PaginationControls
        pageIndex={spreadStart}
        pageCount={pageCount}
        pageStep={navigationStep}
        onPageIndexChange={setPageIndex}
      />
    </div>
  );
}
