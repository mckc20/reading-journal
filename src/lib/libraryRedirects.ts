import { filterKeys, type LibraryFilterKey } from "@/lib/libraryBookFilters";
import { wishlistCollectionPath } from "@/lib/libraryCollections";

export const libraryAuthorFiltersPath = "/library?filters=author";
export const libraryGenreFiltersPath = "/library?filters=genre";

const statusByView = new Map([
  ["tbr", "To Read"],
  ["reading", "Currently Reading"],
  ["finished", "Finished"],
  ["dnf", "DNF"],
]);

const filterByView = new Map<string, LibraryFilterKey>([
  ["series", "series"],
  ["authors", "author"],
  ["genres", "genre"],
  ["rating", "rating"],
  ["languages", "language"],
  ["format", "format"],
  ["source", "source"],
]);

export function legacyLibraryDestination(search: string, browseBy?: "author" | "genre") {
  const legacy = new URLSearchParams(search);
  const view = legacy.get("view") ?? "";
  const value = legacy.get("value");
  if (view === "wishlist") return wishlistCollectionPath;
  if (view === "journalEntries") return "/library/journal";
  if (view === "series" && !value) return "/library/series";

  const next = new URLSearchParams();
  for (const key of filterKeys) {
    for (const filterValue of legacy.getAll(key)) next.append(key, filterValue);
  }
  const query = legacy.get("q");
  if (query) next.set("q", query);
  const sort = legacy.get("sort");
  if (sort === "title" || sort === "author" || sort === "recent") next.set("sort", sort);

  const status = statusByView.get(view);
  if (status) next.set("status", status);
  if (view === "favorites") next.set("favorite", "Yes");
  const key = filterByView.get(view);
  if (key) {
    if (value) next.set(key, value);
    else if (key === "author" || key === "genre") browseBy = key;
  }
  if (browseBy && !filterKeys.some(key => next.has(key))) next.set("filters", browseBy);

  return next.size ? `/library?${next}` : "/library";
}
