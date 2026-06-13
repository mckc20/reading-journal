import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, ChevronRight, Settings, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenresContext } from "@/context/GenresContext";
import {
  getGenrePathLabel,
  getMostSpecificGenres,
  isGenreRoot,
  searchGenres,
} from "@/lib/genres";
import { cn } from "@/lib/utils";
import type { GenreTreeNode } from "@/types";

interface GenreMultiSelectProps {
  value: string[];
  onChange: (genreIds: string[]) => void;
  disabled?: boolean;
}

export default function GenreMultiSelect({
  value,
  onChange,
  disabled = false,
}: GenreMultiSelectProps) {
  const { genres, tree, loading } = useGenresContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedIds = value ?? [];
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedGenres = selectedIds
    .map((id) => genres.find((genre) => genre.id === id))
    .filter((genre): genre is NonNullable<typeof genre> => Boolean(genre));
  const visibleSelectedGenres = getMostSpecificGenres(selectedGenres, genres);
  const results = useMemo(() => searchGenres(genres, query), [genres, query]);
  const idsWithChildren = useMemo(() => {
    const ids = new Set<string>();

    function collect(nodes: GenreTreeNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) ids.add(node.id);
        collect(node.children);
      }
    }

    collect(tree);
    return ids;
  }, [tree]);

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

  function toggleGenre(genreId: string, hasChildren = idsWithChildren.has(genreId)) {
    if (selectedIdSet.has(genreId)) {
      onChange(selectedIds.filter((id) => id !== genreId));
      if (hasChildren) {
        setExpandedIds((current) => {
          const next = new Set(current);
          next.delete(genreId);
          return next;
        });
      }
      return;
    }

    onChange([...selectedIds, genreId]);
    if (hasChildren) {
      setExpandedIds((current) => new Set(current).add(genreId));
    }
  }

  function toggleExpanded(genreId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(genreId)) {
        next.delete(genreId);
      } else {
        next.add(genreId);
      }
      return next;
    });
  }

  function removeGenre(genreId: string) {
    onChange(selectedIds.filter((id) => id !== genreId));
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-9 w-full justify-between gap-2 px-3 py-2 text-left font-normal"
        onClick={() => {
          setOpen((current) => {
            if (!current) {
              setExpandedIds(new Set());
              setQuery("");
            }

            return !current;
          });
        }}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {visibleSelectedGenres.length > 0 ? (
            visibleSelectedGenres.map((genre) => (
              <Badge key={genre.id} variant="secondary" className="max-w-full">
                <span className="truncate">{genre.name}</span>
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              {loading ? "Loading genres..." : "No genres selected"}
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
              placeholder="Search genres"
              autoFocus
            />

            <div className="max-h-72 overflow-y-auto rounded-md border bg-background p-1">
              {query.trim() ? (
                results.length > 0 ? (
                  <div role="listbox" aria-label="Genre search results">
                    {results.map((result) => {
                      const selected = selectedIdSet.has(result.genre.id);
                      const root = isGenreRoot(result.genre);
                      const hasChildren = idsWithChildren.has(result.genre.id);

                      return (
                        <button
                          key={result.genre.id}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                            selected && "font-medium",
                            root && "text-muted-foreground",
                          )}
                          onClick={() => !root && toggleGenre(result.genre.id, hasChildren)}
                          disabled={root}
                          aria-pressed={selected}
                        >
                          {!root && (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input">
                              {selected && <Check className="h-3 w-3" />}
                            </span>
                          )}
                          <span className="min-w-0 truncate">{result.pathLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No matching genres.
                  </p>
                )
              ) : (
                <div role="tree" aria-label="Genre tree">
                  {tree.map((node) => (
                    <GenreTreeRow
                      key={node.id}
                      node={node}
                      selectedIds={selectedIdSet}
                      expandedIds={expandedIds}
                      onToggleGenre={toggleGenre}
                      onToggleExpanded={toggleExpanded}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button asChild type="button" size="sm" variant="ghost" className="gap-1.5">
                <Link to="/settings/genres" onClick={() => setOpen(false)}>
                  <Settings className="h-3.5 w-3.5" />
                  Manage genres
                </Link>
              </Button>
              {selectedGenres.length > 0 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
                  Clear
                </Button>
              )}
            </div>

            {selectedGenres.length > 0 && (
              <div className="border-t pt-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedGenres.map((genre) => (
                    <Badge key={genre.id} variant="secondary" className="gap-1">
                      <span className="max-w-40 truncate" title={getGenrePathLabel(genre.id, genres)}>
                        {genre.name}
                      </span>
                      <button
                        type="button"
                        className="rounded-sm hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => removeGenre(genre.id)}
                        aria-label={`Remove ${genre.name}`}
                      >
                        <X className="h-3 w-3" />
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

function GenreTreeRow({
  node,
  selectedIds,
  expandedIds,
  onToggleGenre,
  onToggleExpanded,
}: {
  node: GenreTreeNode;
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleGenre: (genreId: string, hasChildren?: boolean) => void;
  onToggleExpanded: (genreId: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const selected = selectedIds.has(node.id);
  const root = isGenreRoot(node);

  return (
    <div role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className="flex items-center gap-1 rounded-md py-0.5 pr-1 text-sm"
        style={{ paddingLeft: `${node.depth * 16}px` }}
      >
        {!root && (
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={() => hasChildren && onToggleExpanded(node.id)}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>
        )}
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-left outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            selected && "font-medium",
            root && "font-medium text-muted-foreground",
          )}
          onClick={() => {
            if (root && hasChildren) {
              onToggleExpanded(node.id);
              return;
            }

            if (!root) onToggleGenre(node.id, hasChildren);
          }}
          aria-pressed={root ? undefined : selected}
          aria-expanded={root && hasChildren ? expanded : undefined}
        >
          {!root && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input">
              {selected && <Check className="h-3 w-3" />}
            </span>
          )}
          <span className="truncate">{node.name}</span>
          {hasChildren && root && (
            <span className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
          {hasChildren && !root && (
            <span className="ml-auto shrink-0 text-[11px] font-normal text-muted-foreground">
              broad
            </span>
          )}
        </button>
      </div>
      {hasChildren && expanded && (
        <div role="group">
          {node.children.map((child) => (
            <GenreTreeRow
              key={child.id}
              node={child}
              selectedIds={selectedIds}
              expandedIds={expandedIds}
              onToggleGenre={onToggleGenre}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
