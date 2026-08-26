import type { Book, Genre, GenreTreeNode } from "@/types";

export const GENRE_ROOT_NAMES = new Set([
  "Fiction",
  "Non-Fiction",
  "Age Target",
  "Age Targets",
  "Age Target Tags",
  "Age Target Tags (not genres)",
]);

const GENRE_ROOT_ORDER = new Map(
  Array.from(GENRE_ROOT_NAMES).map((name, index) => [name, index]),
);

export type GenreSearchResult = {
  genre: Genre;
  path: Genre[];
  pathLabel: string;
};

export type GenreSlugLookup = {
  slugById: Map<string, string>;
  genreBySlug: Map<string, Genre>;
};

export type GenreBookCount = {
  direct: number;
  descendant: number;
  total: number;
};

function compareGenres(a: Genre, b: Genre): number {
  const rootOrderA = !a.parent_id ? GENRE_ROOT_ORDER.get(a.name) : undefined;
  const rootOrderB = !b.parent_id ? GENRE_ROOT_ORDER.get(b.name) : undefined;

  if (rootOrderA !== undefined || rootOrderB !== undefined) {
    return (rootOrderA ?? Number.MAX_SAFE_INTEGER) - (rootOrderB ?? Number.MAX_SAFE_INTEGER);
  }

  if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
}

export function normalizeGenreName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function slugifyGenreName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " ")
    .replace(/['’]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "genre";
}

export function isGenreRoot(genre: Pick<Genre, "name" | "parent_id">): boolean {
  return !genre.parent_id && GENRE_ROOT_NAMES.has(genre.name);
}

export function buildGenreMaps(genres: Genre[]) {
  const byId = new Map(genres.map((genre) => [genre.id, genre]));
  const childrenByParentId = new Map<string | null, Genre[]>();

  for (const genre of genres) {
    const key = genre.parent_id ?? null;
    const children = childrenByParentId.get(key) ?? [];
    children.push(genre);
    childrenByParentId.set(key, children);
  }

  for (const children of childrenByParentId.values()) {
    children.sort(compareGenres);
  }

  return { byId, childrenByParentId };
}

function getGenrePathFromMap(genreId: string, byId: Map<string, Genre>): Genre[] {
  const path: Genre[] = [];
  const visited = new Set<string>();
  let current = byId.get(genreId);

  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return path;
}

export function buildGenreSlugLookup(genres: Genre[]): GenreSlugLookup {
  const { byId } = buildGenreMaps(genres);
  const slugById = new Map<string, string>();
  const genreBySlug = new Map<string, Genre>();
  const usedSlugs = new Set<string>();
  const sortedGenres = [...genres].sort((a, b) => {
    const pathA = getGenrePathFromMap(a.id, byId).map((item) => item.name).join(" -> ");
    const pathB = getGenrePathFromMap(b.id, byId).map((item) => item.name).join(" -> ");
    return pathA.localeCompare(pathB, undefined, { sensitivity: "base", numeric: true });
  });

  for (const genre of sortedGenres) {
    const path = getGenrePathFromMap(genre.id, byId);
    const parent = path.length > 1 ? path[path.length - 2] : null;
    const candidates = [
      slugifyGenreName(genre.name),
      parent ? `${slugifyGenreName(parent.name)}-${slugifyGenreName(genre.name)}` : "",
      path.map((item) => slugifyGenreName(item.name)).join("-"),
      `${path.map((item) => slugifyGenreName(item.name)).join("-")}-${genre.id.slice(0, 8)}`,
    ].filter(Boolean);

    let slug = candidates.find((candidate) => !usedSlugs.has(candidate));
    if (!slug) slug = `${slugifyGenreName(genre.name)}-${genre.id.slice(0, 8)}`;

    usedSlugs.add(slug);
    slugById.set(genre.id, slug);
    genreBySlug.set(slug, genre);
  }

  return { slugById, genreBySlug };
}

export function getGenreSlug(genreId: string, genres: Genre[]): string | null {
  return buildGenreSlugLookup(genres).slugById.get(genreId) ?? null;
}

export function resolveGenreSlug(slugOrId: string, genres: Genre[]): Genre | null {
  const { byId } = buildGenreMaps(genres);
  if (byId.has(slugOrId)) return byId.get(slugOrId) ?? null;
  return buildGenreSlugLookup(genres).genreBySlug.get(slugOrId) ?? null;
}

export function getGenrePath(genreId: string, genres: Genre[]): Genre[] {
  const { byId } = buildGenreMaps(genres);
  return getGenrePathFromMap(genreId, byId);
}

export function getGenrePathLabel(genreId: string, genres: Genre[]): string {
  return getGenrePath(genreId, genres)
    .map((genre) => genre.name)
    .join(" -> ");
}

export function formatGenrePathForDisplay(pathLabel: string): string {
  let displayPath = pathLabel;

  for (const rootName of GENRE_ROOT_NAMES) {
    const prefix = `${rootName} -> `;
    if (displayPath.startsWith(prefix)) {
      displayPath = displayPath.slice(prefix.length);
      break;
    }
  }

  return displayPath.replace(/ -> /g, " → ");
}

export function buildGenreTree(genres: Genre[]): GenreTreeNode[] {
  const { childrenByParentId } = buildGenreMaps(genres);

  function buildNode(genre: Genre, depth: number, parentPath: Genre[]): GenreTreeNode {
    const path = [...parentPath, genre];
    const children = (childrenByParentId.get(genre.id) ?? []).map((child) =>
      buildNode(child, depth + 1, path),
    );

    return {
      ...genre,
      children,
      depth,
      path,
      pathLabel: path.map((item) => item.name).join(" -> "),
    };
  }

  return (childrenByParentId.get(null) ?? []).map((genre) => buildNode(genre, 0, []));
}

export function flattenGenreTree(nodes: GenreTreeNode[]): GenreTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenGenreTree(node.children)]);
}

export function getDescendantGenreIds(genreId: string, genres: Genre[]): string[] {
  const { childrenByParentId } = buildGenreMaps(genres);
  const ids: string[] = [];
  const stack = [...(childrenByParentId.get(genreId) ?? [])];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || visited.has(current.id)) continue;

    visited.add(current.id);
    ids.push(current.id);
    stack.push(...(childrenByParentId.get(current.id) ?? []));
  }

  return ids;
}

export function getGenreSubtreeIds(genreId: string, genres: Genre[]): string[] {
  const { byId } = buildGenreMaps(genres);
  const genre = byId.get(genreId);
  const descendantIds = getDescendantGenreIds(genreId, genres);

  if (genre && isGenreRoot(genre)) {
    return descendantIds;
  }

  return [genreId, ...descendantIds];
}

export function bookMatchesGenreSubtree(book: Pick<Book, "genre_ids">, genreId: string, genres: Genre[]): boolean {
  const subtreeIds = new Set(getGenreSubtreeIds(genreId, genres));
  return book.genre_ids?.some((bookGenreId) => subtreeIds.has(bookGenreId)) ?? false;
}

export function getBooksForGenreSubtree<T extends Pick<Book, "genre_ids">>(
  books: T[],
  genreId: string,
  genres: Genre[],
): T[] {
  const subtreeIds = new Set(getGenreSubtreeIds(genreId, genres));
  return books.filter((book) => book.genre_ids?.some((bookGenreId) => subtreeIds.has(bookGenreId)));
}

export function getGenreBookCount(
  genreId: string,
  books: Array<Pick<Book, "genre_ids">>,
  genres: Genre[],
): GenreBookCount {
  const { byId } = buildGenreMaps(genres);
  const genre = byId.get(genreId);
  const countDirectAssignments = !genre || !isGenreRoot(genre);
  const descendantIds = new Set(getDescendantGenreIds(genreId, genres));
  let direct = 0;
  let descendant = 0;
  let total = 0;

  for (const book of books) {
    const genreIds = new Set(book.genre_ids ?? []);
    const hasDirectMatch = countDirectAssignments && genreIds.has(genreId);
    const hasDescendantMatch = [...genreIds].some((id) => descendantIds.has(id));
    if (hasDirectMatch) direct += 1;
    if (hasDescendantMatch) descendant += 1;
    if (hasDirectMatch || hasDescendantMatch) total += 1;
  }

  return {
    direct,
    descendant,
    total,
  };
}

export function getGenreBookCounts(
  genres: Genre[],
  books: Array<Pick<Book, "genre_ids">>,
): Map<string, GenreBookCount> {
  return new Map(genres.map((genre) => [genre.id, getGenreBookCount(genre.id, books, genres)]));
}

export function searchGenres(genres: Genre[], query: string): GenreSearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return genres
    .map((genre) => {
      const path = getGenrePath(genre.id, genres);
      return {
        genre,
        path,
        pathLabel: path.map((item) => item.name).join(" -> "),
      };
    })
    .filter((result) => {
      const normalizedPath = result.pathLabel.toLocaleLowerCase();
      return queryTokens.every((token) => normalizedPath.includes(token));
    })
    .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel, undefined, { sensitivity: "base" }));
}

export function getMostSpecificGenres(selectedGenres: Genre[], allGenres: Genre[]): Genre[] {
  return selectedGenres
    .filter((genre) => {
      if (isGenreRoot(genre)) return false;

      return !selectedGenres.some((candidate) => {
        if (candidate.id === genre.id) return false;
        return getGenrePath(candidate.id, allGenres).some((ancestor) => ancestor.id === genre.id);
      });
    })
    .sort(compareGenres);
}

export function getSelectedGenreTags(selectedGenres: Genre[]): Genre[] {
  return selectedGenres
    .filter((genre) => !isGenreRoot(genre))
    .sort(compareGenres);
}

export function getMostSpecificGenreLabels(book: { selected_genres?: Genre[]; genres?: string[] }, allGenres?: Genre[]): string[] {
  if (book.selected_genres?.length && allGenres?.length) {
    return getMostSpecificGenres(book.selected_genres, allGenres).map((genre) => genre.name);
  }

  return book.genres ?? [];
}

export function mapGenreLabelsToIds(labels: string[] | undefined, genres: Genre[]): string[] {
  if (!labels) return [];
  const byName = new Map(
    genres
      .filter((genre) => !isGenreRoot(genre))
      .map((genre) => [genre.name.trim().toLocaleLowerCase(), genre.id]),
  );
  const aliases = new Map<string, string>([
    ["juvenile fiction", "young adult"],
    ["sci-fi", "science fiction"],
    ["science fiction & fantasy", "science fiction"],
    ["mystery", "mystery & crime"],
    ["crime", "mystery & crime"],
    ["detective and mystery stories", "mystery & crime"],
    ["thriller", "thriller & suspense"],
    ["suspense", "thriller & suspense"],
    ["adventure", "action & adventure"],
    ["action", "action & adventure"],
    ["childrens", "children's"],
    ["middle grade / mg", "middle grade"],
    ["mg", "middle grade"],
    ["ya", "young adult"],
    ["new adult / na", "new adult"],
    ["na", "new adult"],
    ["memoir", "biography & memoir"],
    ["biography", "biography & memoir"],
    ["autobiography", "biography & memoir"],
    ["autobiography / memoir", "biography & memoir"],
    ["self-help", "self-help & personal development"],
    ["self-improvement", "self-help & personal development"],
    ["personal development", "self-help & personal development"],
    ["business", "business & economics"],
    ["economics", "business & economics"],
    ["science", "science & technology"],
    ["technology", "science & technology"],
    ["cooking/food", "cookbooks & food"],
    ["cookbooks / food", "cookbooks & food"],
    ["cooking", "cookbooks & food"],
    ["food", "cookbooks & food"],
    ["art/design", "art, photography & design"],
    ["art", "art, photography & design"],
    ["photography", "art, photography & design"],
    ["design", "art, photography & design"],
    ["comedy", "humor & satire"],
    ["satire", "humor & satire"],
    ["humor", "humor & satire"],
    ["health, wellness & fitness", "health & wellness"],
    ["wellness", "health & wellness"],
    ["philosophy", "philosophy & spirituality"],
    ["spirituality", "philosophy & spirituality"],
    ["politics", "politics & current events"],
    ["current events", "politics & current events"],
    ["social science", "politics & current events"],
    ["essays", "essays & anthologies"],
    ["anthologies", "essays & anthologies"],
    ["romantic fantasy", "romance"],
    ["fantasy romance", "romance"],
    ["dark fantasy", "fantasy"],
    ["historical fantasy", "fantasy"],
    ["cyberpunk", "science fiction"],
    ["climate fiction", "science fiction"],
    ["cli-fi", "science fiction"],
  ]);

  return Array.from(
    new Set(
      labels
        .map((label) => {
          const normalizedLabel = label.trim().toLocaleLowerCase();
          const normalizedParts = normalizedLabel
            .split(/[>/,;|]+/)
            .map((part) => part.trim())
            .filter(Boolean);
          const candidates = [normalizedLabel, ...normalizedParts.reverse()];
          const match = candidates
            .map((candidate) => byName.get(candidate) ?? byName.get(aliases.get(candidate) ?? ""))
            .find(Boolean);

          return match;
        })
        .filter((id): id is string => Boolean(id)),
    ),
  );
}
