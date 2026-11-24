export const libraryTabs = [
  { label: "Books", to: "/library" },
  { label: "Collections", to: "/library/collections" },
  { label: "Series", to: "/library/series" },
] as const;

export function getLibraryTab(pathname: string) {
  const path = pathname.replace(/\/$/, "");
  return libraryTabs.find(tab => tab.to === path);
}

export const librarySorts = [
  { value: "recent", label: "Recently added" },
  { value: "title", label: "Title A–Z" },
  { value: "author", label: "Author A–Z" },
] as const;

export type LibrarySort = (typeof librarySorts)[number]["value"];
export type LibraryLayout = "grid" | "list";

export function compareLibraryItems(
  a: { title: string; author?: string; addedAt?: string },
  b: { title: string; author?: string; addedAt?: string },
  sort: LibrarySort,
) {
  const byTitle = a.title.localeCompare(b.title);
  if (sort === "author") {
    return Number(!a.author) - Number(!b.author)
      || (a.author ?? "").localeCompare(b.author ?? "")
      || byTitle;
  }
  if (sort === "recent") {
    const date = (value?: string) => Date.parse(value ?? "") || 0;
    return date(b.addedAt) - date(a.addedAt) || byTitle;
  }
  return byTitle;
}
