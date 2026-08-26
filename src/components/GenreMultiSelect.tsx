import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGenresContext } from "@/context/GenresContext";
import {
  buildGenreMaps,
  getGenrePath,
  isGenreRoot,
  searchGenres,
} from "@/lib/genres";
import { cn } from "@/lib/utils";
import type { Genre } from "@/types";

interface GenreMultiSelectProps {
  value: string[];
  onChange: (genreIds: string[]) => void;
  disabled?: boolean;
}

type GenreOption = {
  genre: Genre;
  group: Genre;
  context: string;
  depth: number;
  sortPath: string[];
};

const GENRE_GROUP_ORDER = new Map([
  ["Fiction", 0],
  ["Non-Fiction", 1],
  ["Age Target", 2],
]);

function getSelectableGenres(genres: Genre[]): Genre[] {
  return genres.filter((genre) => genre.is_system && !isGenreRoot(genre));
}

function getGenreGroup(path: Genre[]): Genre {
  return path.find((genre) => isGenreRoot(genre)) ?? path[0];
}

function getGenreContext(path: Genre[]): string {
  const parents = path.slice(0, -1).filter((genre) => !isGenreRoot(genre));
  return parents.length > 0 ? parents[parents.length - 1].name : "";
}

function getOptionDepth(path: Genre[]): number {
  return Math.max(0, path.filter((genre) => !isGenreRoot(genre)).length - 1);
}

function compareGenreOptions(a: GenreOption, b: GenreOption): number {
  const groupCompare =
    (GENRE_GROUP_ORDER.get(a.group.name) ?? Number.MAX_SAFE_INTEGER) -
    (GENRE_GROUP_ORDER.get(b.group.name) ?? Number.MAX_SAFE_INTEGER);
  if (groupCompare !== 0) return groupCompare;

  const groupNameCompare = a.group.name.localeCompare(b.group.name, undefined, {
    sensitivity: "base",
    numeric: true,
  });
  if (groupNameCompare !== 0) return groupNameCompare;

  const maxLength = Math.max(a.sortPath.length, b.sortPath.length);
  for (let index = 0; index < maxLength; index += 1) {
    const aPart = a.sortPath[index];
    const bPart = b.sortPath[index];
    if (!aPart) return -1;
    if (!bPart) return 1;

    const partCompare = aPart.localeCompare(bPart, undefined, {
      sensitivity: "base",
      numeric: true,
    });
    if (partCompare !== 0) return partCompare;
  }

  return a.genre.name.localeCompare(b.genre.name, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

function buildGenreOptions(genres: Genre[]): GenreOption[] {
  return getSelectableGenres(genres)
    .map((genre) => {
      const path = getGenrePath(genre.id, genres);
      return {
        genre,
        group: getGenreGroup(path),
        context: getGenreContext(path),
        depth: getOptionDepth(path),
        sortPath: path.filter((item) => !isGenreRoot(item)).map((item) => item.name),
      };
    })
    .sort(compareGenreOptions);
}

export default function GenreMultiSelect({
  value,
  onChange,
  disabled = false,
}: GenreMultiSelectProps) {
  const { genres, loading } = useGenresContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedIds = value ?? [];
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const { byId } = useMemo(() => buildGenreMaps(genres), [genres]);
  const selectedGenres = selectedIds
    .map((id) => byId.get(id))
    .filter((genre): genre is Genre => {
      if (!genre) return false;
      return genre.is_system && !isGenreRoot(genre);
    });
  const allOptions = useMemo(() => buildGenreOptions(genres), [genres]);
  const options = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return allOptions;

    const matchingIds = new Set(searchGenres(genres, trimmedQuery).map((result) => result.genre.id));
    return allOptions.filter((option) => matchingIds.has(option.genre.id));
  }, [allOptions, genres, query]);
  const groupedOptions = useMemo(() => {
    const groups: Array<{ group: Genre; options: GenreOption[] }> = [];
    const groupById = new Map<string, { group: Genre; options: GenreOption[] }>();

    for (const option of options) {
      const existing = groupById.get(option.group.id);
      if (existing) {
        existing.options.push(option);
      } else {
        const group = { group: option.group, options: [option] };
        groupById.set(option.group.id, group);
        groups.push(group);
      }
    }

    return groups;
  }, [options]);

  function toggleGenre(genreId: string) {
    if (selectedIdSet.has(genreId)) {
      onChange(selectedIds.filter((id) => id !== genreId));
      return;
    }

    onChange([...selectedIds, genreId]);
  }

  function clearGenres() {
    onChange([]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedGenres.map((genre) => (
          <Badge key={genre.id} variant="secondary" className="max-w-full gap-1 px-2 py-1">
            <span className="truncate">{genre.name}</span>
            <button
              type="button"
              className="rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => toggleGenre(genre.id)}
              disabled={disabled}
              aria-label={`Remove ${genre.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Button
          type="button"
          size="sm"
          variant={selectedGenres.length > 0 ? "ghost" : "outline"}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          disabled={disabled}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          {selectedGenres.length > 0 ? "Add" : "Add genre"}
        </Button>
      </div>

      {selectedGenres.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">No genres selected.</p>
      )}
      {loading && <p className="text-xs text-muted-foreground">Loading genres...</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add genres</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search genres..."
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[22rem] rounded-lg border bg-background">
              {groupedOptions.length > 0 ? (
                <div className="space-y-2 p-2">
                  {groupedOptions.map(({ group, options }) => (
                    <section key={group.id} className="space-y-0.5">
                      <div className="px-2 pb-0.5 pt-1 text-xs font-medium uppercase text-muted-foreground">
                        {group.name}
                      </div>
                      <div className="space-y-0.5">
                        {options.map((option) => {
                          const selected = selectedIdSet.has(option.genre.id);

                          return (
                            <div key={option.genre.id} style={{ paddingLeft: `${option.depth * 18}px` }}>
                              <button
                                type="button"
                                className={cn(
                                  "flex min-h-8 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                                  selected && "bg-accent/60 font-medium",
                                )}
                                onClick={() => toggleGenre(option.genre.id)}
                                aria-pressed={selected}
                              >
                                <span
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input bg-background",
                                    selected && "border-primary bg-primary text-primary-foreground",
                                  )}
                                >
                                  {selected && <Check className="h-3 w-3" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">{option.genre.name}</span>
                                  {option.context && query.trim() && (
                                    <span className="block truncate text-xs font-normal text-muted-foreground">
                                      {option.context}
                                    </span>
                                  )}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  No matching genres.
                </div>
              )}
            </ScrollArea>

            {selectedGenres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t pt-3">
                {selectedGenres.map((genre) => (
                  <Badge key={genre.id} variant="secondary" className="max-w-full gap-1">
                    <span className="truncate">{genre.name}</span>
                    <button
                      type="button"
                      className="rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onClick={() => toggleGenre(genre.id)}
                      aria-label={`Remove ${genre.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            {selectedGenres.length > 0 && (
              <Button type="button" variant="ghost" onClick={clearGenres}>
                Clear
              </Button>
            )}
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
