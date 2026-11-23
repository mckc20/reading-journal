export const libraryTabs = [
  { label: "Books", to: "/library" },
  { label: "Collections", to: "/library/collections" },
  { label: "Series", to: "/library/series" },
] as const;

export function getLibraryTab(pathname: string) {
  const path = pathname.replace(/\/$/, "");
  return libraryTabs.find(tab => tab.to === path);
}
