import { useMemo, useState } from "react";
import { Check, PieChart } from "lucide-react";
import {
  buildGenreChartColorMap,
  getGenreChartColor,
  getSubgenreGenreChartColor,
  OTHERS_GENRE_CHART_COLOR,
} from "@/lib/genreChartColors";
import { getGenrePath, isGenreRoot } from "@/lib/genres";
import { cn } from "@/lib/utils";
import type { Book, Genre } from "@/types";

interface GenreDistributionChartProps {
  books: Book[];
  genres?: Genre[];
  loading?: boolean;
  error?: string | null;
}

interface RawGenreEntry {
  parentKey: string;
  parentLabel: string;
  segmentKey: string;
  segmentLabel: string;
  isSubgenre: boolean;
}

interface GenreSegment {
  key: string;
  genre: string;
  parentGenre: string;
  isSubgenre: boolean;
  count: number;
  arcCount: number;
  percentage: number;
  color: string;
}

interface ParentGenreDatum {
  key: string;
  genre: string;
  count: number;
  percentage: number;
  color: string;
  segments: GenreSegment[];
  others?: Array<{
    genre: string;
    parentGenre: string;
    isSubgenre: boolean;
  }>;
}

const CHART_SIZE = 360;
const RADIUS = 132;
const STROKE_WIDTH = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_OTHERS_PREVIEW = 3;

function normalizeGenreLabel(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "unknown" || lowered === "unspecified" || lowered === "n/a") {
    return "Unknown/Unspecified";
  }
  return trimmed;
}

function getBookGenreEntries(book: Book, genres: Genre[]): RawGenreEntry[] {
  if (genres.length === 0 || !book.genre_ids?.length) {
    const labels = (book.genres ?? [])
      .map(normalizeGenreLabel)
      .filter((value): value is string => Boolean(value));

    return labels.map((label) => ({
      parentKey: label,
      parentLabel: label,
      segmentKey: label,
      segmentLabel: label,
      isSubgenre: false,
    }));
  }

  const entries: RawGenreEntry[] = [];

  for (const genreId of book.genre_ids) {
    const path = getGenrePath(genreId, genres).filter((genre) => !isGenreRoot(genre));
    if (path.length === 0) continue;

    const parent = path[0];
    const selected = path[path.length - 1];

    entries.push({
      parentKey: parent.id,
      parentLabel: parent.name,
      segmentKey: selected.id,
      segmentLabel: selected.name,
      isSubgenre: selected.id !== parent.id,
    });
  }

  return entries;
}

function buildGenreData(books: Book[], genres: Genre[], includeSubgenres: boolean): {
  data: ParentGenreDatum[];
  booksWithGenre: number;
  totalGenreAssignments: number;
} {
  const parentCounts = new Map<string, { label: string; count: number }>();
  const segmentCounts = new Map<
    string,
    Map<
      string,
      {
        label: string;
        parentLabel: string;
        isSubgenre: boolean;
        count: number;
      }
    >
  >();
  let booksWithGenre = 0;

  for (const book of books) {
    const entries = getBookGenreEntries(book, genres);
    if (entries.length === 0) continue;

    booksWithGenre += 1;

    const uniqueParents = new Map(entries.map((entry) => [entry.parentKey, entry]));
    for (const entry of uniqueParents.values()) {
      const current = parentCounts.get(entry.parentKey) ?? { label: entry.parentLabel, count: 0 };
      current.count += 1;
      parentCounts.set(entry.parentKey, current);
    }

    const uniqueSegments = new Map(entries.map((entry) => [`${entry.parentKey}:${entry.segmentKey}`, entry]));
    for (const entry of uniqueSegments.values()) {
      const parentSegments = segmentCounts.get(entry.parentKey) ?? new Map();
      const current = parentSegments.get(entry.segmentKey) ?? {
        label: entry.segmentLabel,
        parentLabel: entry.parentLabel,
        isSubgenre: entry.isSubgenre,
        count: 0,
      };
      current.count += 1;
      parentSegments.set(entry.segmentKey, current);
      segmentCounts.set(entry.parentKey, parentSegments);
    }
  }

  const sortedParents = [...parentCounts.entries()].sort((a, b) => {
    if (b[1].count !== a[1].count) return b[1].count - a[1].count;
    return a[1].label.localeCompare(b[1].label);
  });
  const singleBookParents = sortedParents.filter(([, entry]) => entry.count === 1);
  const groupedParents = sortedParents.filter(([, entry]) => entry.count > 1);
  const parentColorMap = buildGenreChartColorMap(groupedParents.map(([, entry]) => entry.label));

  const data: ParentGenreDatum[] = groupedParents.map(([parentKey, parent]) => {
    const parentColor = parentColorMap.get(parent.label) ?? getGenreChartColor(parent.label);
    const childEntries = [...(segmentCounts.get(parentKey)?.entries() ?? [])].sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return a[1].label.localeCompare(b[1].label);
    });
    const childTotal = childEntries.reduce((sum, [, child]) => sum + child.count, 0);
    const shouldSplitParent = includeSubgenres && childEntries.length > 1;

    const segments: GenreSegment[] = shouldSplitParent
      ? childEntries.map(([childKey, child], index) => ({
          key: `${parentKey}:${childKey}`,
          genre: child.label,
          parentGenre: parent.label,
          isSubgenre: child.isSubgenre,
          count: child.count,
          arcCount: childTotal > 0 ? (parent.count * child.count) / childTotal : 0,
          percentage: booksWithGenre > 0 ? (child.count / booksWithGenre) * 100 : 0,
          color: child.isSubgenre ? getSubgenreGenreChartColor(parentColor, index) : parentColor,
        }))
      : [
          {
            key: parentKey,
            genre: parent.label,
            parentGenre: parent.label,
            isSubgenre: false,
            count: parent.count,
            arcCount: parent.count,
            percentage: booksWithGenre > 0 ? (parent.count / booksWithGenre) * 100 : 0,
            color: parentColor,
          },
        ];

    return {
      key: parentKey,
      genre: parent.label,
      count: parent.count,
      percentage: booksWithGenre > 0 ? (parent.count / booksWithGenre) * 100 : 0,
      color: parentColor,
      segments,
    };
  });

  if (singleBookParents.length > 0) {
    const count = singleBookParents.reduce((sum, [, entry]) => sum + entry.count, 0);
    data.push({
      key: "others",
      genre: "Others",
      count,
      percentage: booksWithGenre > 0 ? (count / booksWithGenre) * 100 : 0,
      color: OTHERS_GENRE_CHART_COLOR,
      segments: [
        {
          key: "others",
          genre: "Others",
          parentGenre: "Others",
          isSubgenre: false,
          count,
          arcCount: count,
          percentage: booksWithGenre > 0 ? (count / booksWithGenre) * 100 : 0,
          color: OTHERS_GENRE_CHART_COLOR,
        },
      ],
      others: singleBookParents.map(([, entry]) => ({
        genre: entry.label,
        parentGenre: entry.label,
        isSubgenre: false,
      })),
    });
  }

  const totalGenreAssignments = data.reduce((sum, entry) => sum + entry.count, 0);
  return { data, booksWithGenre, totalGenreAssignments };
}

function formatPercent(value: number): string {
  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)}%`;
}

function formatOthersPreview(others: ParentGenreDatum["others"]): string | null {
  if (!others?.length) return null;

  const labels = others.map((item) => item.genre);
  if (labels.length <= MAX_OTHERS_PREVIEW) return labels.join(", ");

  return `${labels.slice(0, MAX_OTHERS_PREVIEW).join(", ")} +${labels.length - MAX_OTHERS_PREVIEW} more`;
}

export default function GenreDistributionChart({ books, genres = [], loading = false, error = null }: GenreDistributionChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [includeSubgenres, setIncludeSubgenres] = useState(false);

  const { data, booksWithGenre, totalGenreAssignments } = useMemo(
    () => buildGenreData(books, genres, includeSubgenres),
    [books, genres, includeSubgenres]
  );
  const activeParent = useMemo(() => data.find((entry) => entry.key === activeKey) ?? null, [activeKey, data]);
  const activeSegment = useMemo(
    () => data.flatMap((entry) => entry.segments).find((entry) => entry.key === activeKey) ?? null,
    [activeKey, data]
  );
  const activeEntry = activeSegment ?? activeParent;

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="h-[22rem] animate-pulse rounded-xl border bg-muted/30" />
        <div className="h-[22rem] animate-pulse rounded-xl border bg-muted/30" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (data.length === 0 || booksWithGenre === 0 || totalGenreAssignments === 0) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/15 text-center">
        <PieChart className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">No genre data yet</p>
        <p className="text-xs text-muted-foreground">Add one or more genres to your books to unlock this chart.</p>
      </div>
    );
  }

  let arcOffset = 0;

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        onClick={() => setIncludeSubgenres((current) => !current)}
        aria-pressed={includeSubgenres}
      >
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-sm border",
            includeSubgenres ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60 bg-background"
          )}
          aria-hidden="true"
        >
          {includeSubgenres ? <Check className="h-3 w-3" /> : null}
        </span>
        Include subgenres
      </button>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="mx-auto w-full max-w-[26rem]">
          <div className="relative">
            <svg
              viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
              role="img"
              aria-label="Donut chart showing book counts by genre"
              className="h-auto w-full"
            >
              <circle
                cx={CHART_SIZE / 2}
                cy={CHART_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={STROKE_WIDTH}
              />
              {data.flatMap((parent) =>
                parent.segments.map((segment) => {
                  const arcLength = (segment.arcCount / totalGenreAssignments) * CIRCUMFERENCE;
                  const dashArray = `${arcLength} ${CIRCUMFERENCE - arcLength}`;
                  const dashOffset = -arcOffset;
                  arcOffset += arcLength;
                  const isActive = activeKey === parent.key || activeKey === segment.key;
                  return (
                    <circle
                      key={segment.key}
                      cx={CHART_SIZE / 2}
                      cy={CHART_SIZE / 2}
                      r={RADIUS}
                      fill="none"
                      stroke={segment.color}
                      strokeWidth={isActive ? STROKE_WIDTH + 3 : STROKE_WIDTH}
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="butt"
                      transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setActiveKey(segment.key)}
                      onMouseLeave={() => setActiveKey(null)}
                      onFocus={() => setActiveKey(segment.key)}
                      onBlur={() => setActiveKey(null)}
                      tabIndex={0}
                      role="img"
                      aria-label={`${segment.genre}: ${segment.count} book${segment.count === 1 ? "" : "s"}, ${formatPercent(segment.percentage)}`}
                    />
                  );
                })
              )}
            </svg>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              {activeEntry ? (
                <>
                  <p className="max-w-36 text-xs text-muted-foreground">
                    {"parentGenre" in activeEntry && activeEntry.isSubgenre
                      ? `${activeEntry.parentGenre} / ${activeEntry.genre}`
                      : activeEntry.genre}
                  </p>
                  <p className="text-base font-semibold leading-none">{formatPercent(activeEntry.percentage)}</p>
                  <p className="text-xs text-muted-foreground">{activeEntry.count} books</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Genres tracked</p>
                  <p className="text-base font-semibold leading-none">{data.length}</p>
                  <p className="text-xs text-muted-foreground">{booksWithGenre} books with genre</p>
                </>
              )}
            </div>
          </div>
        </div>

        <ul className="grid w-full min-w-0 content-start gap-0.5" aria-label="Genre distribution legend">
          {data.map((entry) => {
            const isActive = activeKey === entry.key;
            const visibleSubgenres = includeSubgenres && entry.segments.length > 1 ? entry.segments : [];
            const othersPreview = formatOthersPreview(entry.others);
            const othersTitle = entry.others?.map((item) => item.genre).join(", ");
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center justify-between gap-2 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  onMouseEnter={() => setActiveKey(entry.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(entry.key)}
                  onBlur={() => setActiveKey(null)}
                  aria-label={`${entry.genre}: ${entry.count} book${entry.count === 1 ? "" : "s"}, ${formatPercent(entry.percentage)}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm border border-border/60"
                      style={{ backgroundColor: entry.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 text-[11px] font-medium leading-none">
                      <span className="block truncate leading-tight">{entry.genre}</span>
                      {othersPreview ? (
                        <span
                          className="mt-0.5 block truncate text-[9px] font-normal leading-tight text-muted-foreground"
                          title={othersTitle}
                        >
                          {othersPreview}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[9px] leading-tight text-muted-foreground">
                    <span className={isActive ? "text-foreground" : ""}>{entry.count}</span> ({formatPercent(entry.percentage)})
                  </span>
                </button>
                {visibleSubgenres.length > 0 ? (
                  <ul className="ml-3 mt-0.5 grid gap-0.5">
                    {visibleSubgenres.map((segment) => {
                      const segmentActive = activeKey === segment.key;
                      const segmentLabel = segment.isSubgenre ? segment.genre : "Directly assigned";

                      return (
                        <li key={segment.key}>
                          <button
                            type="button"
                            className="flex w-full min-w-0 items-center justify-between gap-2 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                            onMouseEnter={() => setActiveKey(segment.key)}
                            onMouseLeave={() => setActiveKey(null)}
                            onFocus={() => setActiveKey(segment.key)}
                            onBlur={() => setActiveKey(null)}
                            aria-label={`${entry.genre} / ${segmentLabel}: ${segment.count} book${segment.count === 1 ? "" : "s"}, ${formatPercent(segment.percentage)}`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-sm border border-border/50"
                                style={{ backgroundColor: segment.color }}
                                aria-hidden="true"
                              />
                              <span className="min-w-0 truncate text-[10px] leading-none text-muted-foreground">
                                {segmentLabel}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-[9px] leading-tight text-muted-foreground">
                              <span className={segmentActive ? "text-foreground" : ""}>{segment.count}</span> ({formatPercent(segment.percentage)})
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
