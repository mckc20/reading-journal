import { useMemo, useState } from "react";
import { PieChart } from "lucide-react";
import type { Book } from "@/types";

interface GenreDistributionChartProps {
  books: Book[];
  loading?: boolean;
  error?: string | null;
}

interface GenreDatum {
  genre: string;
  count: number;
  percentage: number;
}

const CHART_SIZE = 360;
const RADIUS = 132;
const STROKE_WIDTH = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const DONUT_PALETTE = [
  "#4B88B2",
  "#56A2B8",
  "#66B6AE",
  "#7DC2A4",
  "#97CC98",
  "#B3D48F",
  "#C9DA8A",
  "#DCE094",
  "#E8DE98",
  "#ECD08A",
  "#EEBC72",
  "#F0A55D",
  "#F1894F",
  "#EE6D47",
  "#E85546",
  "#D43A4B",
];

function hashLabel(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildPaletteAssignments(labels: string[]): Map<string, string> {
  const assignments = new Map<string, string>();
  const usedIndices = new Set<number>();

  const sortedLabels = [...labels].sort((a, b) => a.localeCompare(b));
  for (const label of sortedLabels) {
    let index = hashLabel(label.toLowerCase()) % DONUT_PALETTE.length;

    if (usedIndices.size < DONUT_PALETTE.length) {
      while (usedIndices.has(index)) {
        index = (index + 1) % DONUT_PALETTE.length;
      }
      usedIndices.add(index);
    }

    assignments.set(label, DONUT_PALETTE[index]);
  }

  return assignments;
}

function normalizeGenreLabel(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "unknown" || lowered === "unspecified" || lowered === "n/a") {
    return "Unknown/Unspecified";
  }
  return trimmed;
}

function buildGenreData(books: Book[]): {
  data: GenreDatum[];
  booksWithGenre: number;
  totalGenreAssignments: number;
  paletteAssignments: Map<string, string>;
} {
  const counts = new Map<string, number>();
  let booksWithGenre = 0;

  for (const book of books) {
    const labels = (book.genres ?? [])
      .map(normalizeGenreLabel)
      .filter((value): value is string => Boolean(value));

    if (labels.length === 0) continue;

    booksWithGenre += 1;
    const uniqueLabels = new Set(labels);
    for (const label of uniqueLabels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  const totalGenreAssignments = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const paletteAssignments = buildPaletteAssignments([...counts.keys()]);

  const data = [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: booksWithGenre > 0 ? (count / booksWithGenre) * 100 : 0,
    }));

  return { data, booksWithGenre, totalGenreAssignments, paletteAssignments };
}

function formatPercent(value: number): string {
  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)}%`;
}

export default function GenreDistributionChart({ books, loading = false, error = null }: GenreDistributionChartProps) {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);

  const { data, booksWithGenre, totalGenreAssignments, paletteAssignments } = useMemo(() => buildGenreData(books), [books]);

  const activeEntry = useMemo(() => {
    if (!activeGenre) return null;
    return data.find((entry) => entry.genre === activeGenre) ?? null;
  }, [activeGenre, data]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,14rem)]">
        <div className="h-[22rem] animate-pulse rounded-xl border bg-muted/30" />
        <div className="h-[22rem] animate-pulse rounded-xl border bg-muted/30" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (data.length === 0 || booksWithGenre === 0) {
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
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,14rem)]">
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
            {data.map((entry) => {
              const arcLength = (entry.count / totalGenreAssignments) * CIRCUMFERENCE;
              const dashArray = `${arcLength} ${CIRCUMFERENCE - arcLength}`;
              const dashOffset = -arcOffset;
              arcOffset += arcLength;
              const isActive = activeEntry?.genre === entry.genre;
              return (
                <circle
                  key={entry.genre}
                  cx={CHART_SIZE / 2}
                  cy={CHART_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={paletteAssignments.get(entry.genre)}
                  strokeWidth={isActive ? STROKE_WIDTH + 3 : STROKE_WIDTH}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${CHART_SIZE / 2} ${CHART_SIZE / 2})`}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setActiveGenre(entry.genre)}
                  onMouseLeave={() => setActiveGenre(null)}
                  onFocus={() => setActiveGenre(entry.genre)}
                  onBlur={() => setActiveGenre(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${entry.genre}: ${entry.count} book${entry.count === 1 ? "" : "s"}, ${formatPercent(entry.percentage)}`}
                />
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {activeEntry ? (
              <>
                <p className="max-w-28 text-xs text-muted-foreground">{activeEntry.genre}</p>
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

      <ul className="grid w-full min-w-0 max-h-[22rem] gap-1 overflow-y-auto" aria-label="Genre distribution legend">
        {data.map((entry) => {
          const isActive = activeEntry?.genre === entry.genre;
          const color = paletteAssignments.get(entry.genre);
          return (
            <li key={entry.genre}>
              <button
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background/70 px-2 py-1.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                onMouseEnter={() => setActiveGenre(entry.genre)}
                onMouseLeave={() => setActiveGenre(null)}
                onFocus={() => setActiveGenre(entry.genre)}
                onBlur={() => setActiveGenre(null)}
                aria-label={`${entry.genre}: ${entry.count} book${entry.count === 1 ? "" : "s"}, ${formatPercent(entry.percentage)}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border/60"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-xs font-medium">{entry.genre}</span>
                </span>
                <span className="text-[10px] text-right text-muted-foreground">
                  <span className={isActive ? "text-foreground" : ""}>{entry.count}</span> ({formatPercent(entry.percentage)})
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
