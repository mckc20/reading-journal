import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type BookLibraryFilterKey =
  | "author"
  | "format"
  | "genre"
  | "language"
  | "publicationYear"
  | "series"
  | "source"
  | "status";

export type AuthorLibraryFilterKey = "genre" | "language";

export function buildBookLibraryFilterPath(key: BookLibraryFilterKey, value: string): string {
  const params = new URLSearchParams({ [key]: value });
  return `/library/books?${params.toString()}`;
}

export function buildAuthorLibraryFilterPath(key: AuthorLibraryFilterKey, value: string): string {
  const params = new URLSearchParams({ [key]: value });
  return `/library/authors?${params.toString()}`;
}

export function buildAuthorDetailPath(authorIdOrName: string): string {
  return `/authors/${encodeURIComponent(authorIdOrName)}`;
}

export function buildGenreDetailPath(slugOrId: string): string {
  return `/genres/${slugOrId}`;
}

export function buildSeriesDetailPath(seriesId: string): string {
  return `/series/${seriesId}`;
}

export function MetadataGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-sans text-xs font-normal uppercase tracking-wide text-muted-foreground/70">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function MetadataItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="font-sans text-xs font-normal uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

export function MetadataLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}
