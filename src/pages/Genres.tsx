import { Link } from "react-router-dom";
import { BookOpen, ChevronRight, ListTree } from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import {
  buildGenreSlugLookup,
  getGenreBookCounts,
  isGenreRoot,
} from "@/lib/genres";
import type { GenreTreeNode } from "@/types";

function formatBookCount(count: number): string {
  return `${count} book${count === 1 ? "" : "s"}`;
}

function GenreTreeRow({
  node,
  slugById,
  countsById,
}: {
  node: GenreTreeNode;
  slugById: Map<string, string>;
  countsById: ReturnType<typeof getGenreBookCounts>;
}) {
  const count = countsById.get(node.id)?.total ?? 0;
  const slug = slugById.get(node.id) ?? node.id;

  return (
    <li>
      <Link
        to={`/genres/${slug}`}
        className="group grid min-h-11 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ paddingLeft: `${12 + Math.max(0, node.depth - 1) * 18}px` }}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{node.name}</span>
          {node.children.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              {node.children.length} subgenre{node.children.length === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <Badge variant="secondary" className="justify-self-end whitespace-nowrap">
          {formatBookCount(count)}
        </Badge>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      {node.children.length > 0 && (
        <ul className="mt-1 space-y-1">
          {node.children.map((child) => (
            <GenreTreeRow
              key={child.id}
              node={child}
              slugById={slugById}
              countsById={countsById}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Genres() {
  const { genres, tree, loading: genresLoading, error: genresError } = useGenresContext();
  const { books, loading: booksLoading } = useBooksContext();
  const { slugById } = buildGenreSlugLookup(genres);
  const countsById = getGenreBookCounts(genres, books);
  const loading = genresLoading || booksLoading;
  const rootSections = tree.filter((node) => isGenreRoot(node));
  const customRoots = tree.filter((node) => !isGenreRoot(node));

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (genresError) {
    return <p className="text-sm text-destructive">{genresError}</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListTree className="h-4 w-4" />
          Genre discovery
        </div>
        <AppHeading level={1}>Browse Genres</AppHeading>
        <HeadingDescription className="max-w-2xl">
          Explore your genre tree from broad categories down to specific subgenres. Counts include books tagged directly on a genre and books tagged on any of its descendants.
        </HeadingDescription>
      </section>

      {tree.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No genres are available yet.</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/library">Back to Library</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {rootSections.map((section) => {
            const sectionSlug = slugById.get(section.id) ?? section.id;

            return (
              <section key={section.id} className="rounded-xl border bg-card p-4">
                <Link
                  to={`/genres/${sectionSlug}`}
                  className="group mb-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md border-b px-3 pb-3 pt-1 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0">
                    <AppHeading level={4} as="h2" className="truncate">{section.name}</AppHeading>
                    <HeadingDescription className="text-xs">
                      {section.children.length} top-level genre{section.children.length === 1 ? "" : "s"}
                    </HeadingDescription>
                  </div>
                  <Badge variant="outline" className="justify-self-end whitespace-nowrap">
                    {formatBookCount(countsById.get(section.id)?.total ?? 0)}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
                <ul className="space-y-1">
                  {section.children.map((child) => (
                    <GenreTreeRow
                      key={child.id}
                      node={child}
                      slugById={slugById}
                      countsById={countsById}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {customRoots.length > 0 && (
            <section className="rounded-xl border bg-card p-4">
              <div className="mb-3 border-b pb-3">
                <AppHeading level={4} as="h2">Custom Genres</AppHeading>
                <HeadingDescription className="text-xs">Genres you created outside the system sections.</HeadingDescription>
              </div>
              <ul className="space-y-1">
                {customRoots.map((node) => (
                  <GenreTreeRow
                    key={node.id}
                    node={node}
                    slugById={slugById}
                    countsById={countsById}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
