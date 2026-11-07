import { useId, useMemo } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";
import { buildGenreSlugLookup } from "@/lib/genres";
import type { GenreCollectionEntry } from "@/lib/genreCollection";
import type { Genre } from "@/types";

export default function GenreFavorites({ favorites, genres }: {
  favorites: GenreCollectionEntry[];
  genres: Genre[];
}) {
  const headingId = useId();
  const { slugById } = useMemo(() => buildGenreSlugLookup(genres), [genres]);

  return (
    <section className="space-y-3" aria-labelledby={headingId}>
      <div className="space-y-1">
        <AppHeading level={4} id={headingId}>Your favorite genres</AppHeading>
        <HeadingDescription>Based on how much you read and enjoy each genre.</HeadingDescription>
        <Link to="/help" className="inline-block rounded text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">How the ranking works</Link>
      </div>
      {favorites.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {favorites.map((entry) => (
            <Link key={entry.genre.id} to={`/genres/${slugById.get(entry.genre.id) ?? entry.genre.id}`}
              className="flex flex-col gap-2 rounded-2xl border bg-card p-3 transition-colors hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <h5 className="font-heading text-base leading-snug">{entry.genre.name}</h5>
              <div className="mt-auto space-y-1">
                <p className="flex items-center gap-1.5"><Star aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" /><span className="text-lg font-medium">{entry.averageRating!.toFixed(1)}</span><span className="text-xs text-muted-foreground">/ 5</span></p>
                <p className="text-xs text-muted-foreground">{entry.ratedCount} rated book{entry.ratedCount === 1 ? "" : "s"}</p>
                <p className="text-xs text-muted-foreground">{Number(entry.enjoymentScore.toFixed(2))} enjoyment points</p>
                {entry.smallSample && <p className="text-xs text-muted-foreground">Small sample</p>}
              </div>
            </Link>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">Finish and rate a book to start discovering your favorite genres.</p>}
    </section>
  );
}
