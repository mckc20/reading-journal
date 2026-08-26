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
import { useAuthorsContext } from "@/context";
import { cn } from "@/lib/utils";

interface AuthorMultiSelectProps {
  value: string[];
  onChange: (authors: string[]) => void;
  disabled?: boolean;
  onCreateNew?: (name: string) => void;
}

function authorKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function normalizeAuthorName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export default function AuthorMultiSelect({
  value,
  onChange,
  disabled = false,
  onCreateNew,
}: AuthorMultiSelectProps) {
  const { authors, loading } = useAuthorsContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedAuthors = value ?? [];
  const selectedAuthorSet = useMemo(() => new Set(selectedAuthors.map(authorKey)), [selectedAuthors]);
  const normalizedQuery = normalizeAuthorName(query);

  const results = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const sortedAuthors = [...authors].sort((first, second) =>
      first.name.localeCompare(second.name, undefined, { sensitivity: "base", numeric: true }),
    );

    if (!search) return sortedAuthors;
    return sortedAuthors.filter((author) => {
      const haystack = [
        author.name,
        author.bio,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(search);
    });
  }, [authors, query]);

  const queryMatchesExisting = useMemo(
    () => authors.some((author) => authorKey(author.name) === authorKey(query)),
    [authors, query],
  );
  const canAddNewAuthor = Boolean(onCreateNew) && normalizedQuery.length > 0 && !queryMatchesExisting;

  function toggleAuthor(authorName: string) {
    const key = authorKey(authorName);
    if (selectedAuthorSet.has(key)) {
      onChange(selectedAuthors.filter((value) => authorKey(value) !== key));
      return;
    }

    onChange([...selectedAuthors, normalizeAuthorName(authorName)]);
  }

  function removeAuthor(authorName: string) {
    const key = authorKey(authorName);
    onChange(selectedAuthors.filter((value) => authorKey(value) !== key));
  }

  function openCreateDialog() {
    if (!canAddNewAuthor) return;
    onCreateNew?.(normalizedQuery);
    setOpen(false);
  }

  function clearAuthors() {
    onChange([]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedAuthors.map((author) => (
          <Badge key={author} variant="secondary" className="max-w-full gap-1 px-2 py-1">
            <span className="truncate">{author}</span>
            <button
              type="button"
              className="rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() => removeAuthor(author)}
              disabled={disabled}
              aria-label={`Remove ${author}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <Button
          type="button"
          size="sm"
          variant={selectedAuthors.length > 0 ? "ghost" : "outline"}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          disabled={disabled}
          onClick={() => {
            setQuery("");
            setOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {selectedAuthors.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground">No authors selected.</p>
      )}
      {loading && <p className="text-xs text-muted-foreground">Loading authors...</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add authors</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search authors..."
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[22rem] rounded-lg border bg-background">
              {results.length > 0 ? (
                <div role="listbox" aria-label="Author search results" className="space-y-0.5 p-2">
                  {results.map((author) => {
                    const selected = selectedAuthorSet.has(authorKey(author.name));

                    return (
                      <button
                        key={author.id}
                        type="button"
                        className={cn(
                          "flex min-h-8 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                          selected && "bg-accent/60 font-medium",
                        )}
                        onClick={() => toggleAuthor(author.name)}
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
                        <span className="min-w-0 flex-1 truncate">{author.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full min-h-40 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  No matching authors.
                </div>
              )}
            </ScrollArea>

            {selectedAuthors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-t pt-3">
                {selectedAuthors.map((author) => (
                  <Badge key={author} variant="secondary" className="max-w-full gap-1">
                    <span className="truncate">{author}</span>
                    <button
                      type="button"
                      className="rounded-sm text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onClick={() => removeAuthor(author)}
                      aria-label={`Remove ${author}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={!canAddNewAuthor}
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4" />
              Add next author
            </Button>
            {selectedAuthors.length > 0 && (
              <Button type="button" variant="ghost" onClick={clearAuthors}>
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
