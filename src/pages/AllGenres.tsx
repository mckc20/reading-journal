import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ChevronRight } from "lucide-react";
import BackButton from "@/components/BackButton";
import LoadingIndicator from "@/components/LoadingIndicator";
import { AppHeading, HeadingDescription } from "@/components/design";
import { useBooksContext } from "@/context/BooksContext";
import { useGenresContext } from "@/context/GenresContext";
import { buildGenreSlugLookup, getGenreBookCounts, isGenreRoot } from "@/lib/genres";
import { getGenreArtwork } from "@/lib/genreMetadata";
import type { GenreTreeNode } from "@/types";

function GenreLabel({ name, slug }: { name: string; slug: string }) {
  const artwork = getGenreArtwork(slug);
  const Icon = artwork.illustration;
  return (
    <span className={`flex min-w-0 items-center gap-2 ${artwork.iconClassName}`}>
      <Icon aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 shrink-0" />
      <span className="min-w-0 rounded-md px-2 py-1" style={{ backgroundColor: "color-mix(in oklch, currentColor 18%, transparent)" }}>
        <span className="break-words text-foreground">{name}</span>
      </span>
    </span>
  );
}

function GenreTreeRow({ node, slugById, countsById }: {
  node: GenreTreeNode;
  slugById: Map<string, string>;
  countsById: ReturnType<typeof getGenreBookCounts>;
}) {
  const slug = slugById.get(node.id) ?? node.id;
  const count = countsById.get(node.id)?.total ?? 0;
  return (
    <li>
      <Link to={`/genres/${slug}`}
        className="flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1 font-medium"><GenreLabel name={node.name} slug={slug} /></span>
        <span className="shrink-0 text-xs text-muted-foreground">{count} book{count === 1 ? "" : "s"}</span>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </Link>
      {node.children.length > 0 && (
        <ul className="ml-3 border-l pl-2 sm:ml-4">
          {node.children.map((child) => <GenreTreeRow key={child.id} node={child} slugById={slugById} countsById={countsById} />)}
        </ul>
      )}
    </li>
  );
}

export default function AllGenres() {
  const { genres, tree, loading: genresLoading, error: genresError } = useGenresContext();
  const { books, loading: booksLoading, error: booksError } = useBooksContext();
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);
  const countsById = useMemo(() => getGenreBookCounts(genres, books), [genres, books]);
  const rootSections = tree.filter(isGenreRoot);
  const legacyRoots = tree.filter((node) => !isGenreRoot(node));

  if (genresLoading || booksLoading) return <LoadingIndicator variant="page" />;
  if (genresError || booksError) return <p role="alert" className="text-sm text-destructive">{genresError || booksError}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <BackButton fallbackTo="/library/genres" />
          <AppHeading level={1}>All genres</AppHeading>
        </div>
        <HeadingDescription>Find your next direction, including genres you haven’t explored yet.</HeadingDescription>
      </header>
      {tree.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-5 py-12 text-center">
          <BookOpen aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No genres are available yet.</p>
        </div>
      ) : (
        <div className="grid items-start gap-8 md:grid-cols-2">
          {rootSections.map((section) => {
            const slug = slugById.get(section.id) ?? section.id;
            return <section key={section.id} className="space-y-3" aria-labelledby={`genre-group-${section.id}`}>
              <h2 id={`genre-group-${section.id}`} className="font-heading text-xl">
                <Link to={`/genres/${slug}`} className="inline-block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <GenreLabel name={section.name.startsWith("Age Target") ? "Reading audiences" : section.name} slug={slug} />
                </Link>
              </h2>
              <ul>{section.children.map((node) => <GenreTreeRow key={node.id} node={node} slugById={slugById} countsById={countsById} />)}</ul>
            </section>;
          })}
          {legacyRoots.length > 0 && <section className="space-y-3" aria-labelledby="legacy-genres">
            <AppHeading level={3} as="h2" id="legacy-genres">More from your library</AppHeading>
            <ul>{legacyRoots.map((node) => <GenreTreeRow key={node.id} node={node} slugById={slugById} countsById={countsById} />)}</ul>
          </section>}
        </div>
      )}
    </div>
  );
}
