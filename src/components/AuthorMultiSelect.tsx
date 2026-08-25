import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function AuthorMultiSelect({
  value,
  onChange,
  disabled = false,
  onCreateNew,
}: AuthorMultiSelectProps) {
  const { authors, loading } = useAuthorsContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedAuthors = value ?? [];
  const selectedAuthorSet = useMemo(() => new Set(selectedAuthors.map(authorKey)), [selectedAuthors]);

  const results = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return authors;
    return authors.filter((author) => {
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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleAuthor(authorName: string) {
    const key = authorKey(authorName);
    if (selectedAuthorSet.has(key)) {
      onChange(selectedAuthors.filter((value) => authorKey(value) !== key));
      return;
    }

    onChange([...selectedAuthors, authorName]);
  }

  function removeAuthor(authorName: string) {
    const key = authorKey(authorName);
    onChange(selectedAuthors.filter((value) => authorKey(value) !== key));
  }

  function openCreateDialog() {
    const trimmed = query.trim();
    onCreateNew?.(trimmed);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-9 w-full justify-between gap-2 px-3 py-2 text-left font-normal"
        onClick={() => {
          setOpen((current) => {
            if (!current) setQuery("");
            return !current;
          });
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedAuthors.length > 0 ? (
            selectedAuthors.map((author) => (
              <Badge key={author} variant="secondary" className="max-w-full gap-1">
                <span className="truncate">{author}</span>
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              {loading ? "Loading authors..." : "No authors selected"}
            </span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      {open && (
        <div
          id={listId}
          className="absolute z-50 mt-1 w-full rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="space-y-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search authors"
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto rounded-md border bg-background p-1">
              {results.length > 0 ? (
                <div role="listbox" aria-label="Author search results" className="space-y-1">
                  {results.map((author) => {
                    const selected = selectedAuthorSet.has(authorKey(author.name));

                    return (
                      <button
                        key={author.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                          selected && "font-medium",
                        )}
                        onClick={() => toggleAuthor(author.name)}
                        aria-pressed={selected}
                      >
                        <span className="min-w-0 truncate">{author.name}</span>
                        {selected && <span className="text-xs text-muted-foreground">Selected</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No matching authors.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={openCreateDialog}
                disabled={disabled || queryMatchesExisting || !onCreateNew}
              >
                + Add new author...
              </Button>
              {selectedAuthors.length > 0 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
                  Clear
                </Button>
              )}
            </div>

            {selectedAuthors.length > 0 && (
              <div className="border-t pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedAuthors.map((author) => (
                    <Badge key={author} variant="secondary" className="gap-1">
                      <span className="max-w-40 truncate" title={author}>
                        {author}
                      </span>
                      <button
                        type="button"
                        className="rounded-sm hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => removeAuthor(author)}
                        aria-label={`Remove ${author}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
