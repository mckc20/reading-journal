type SelectionKind = "book" | "author" | "series" | "wish";

/** Include the count for multiple items, especially "series", whose plural is unchanged. */
export function selectionLabel(kind: SelectionKind, count: number): string {
  if (count === 1) return kind;
  const plural = kind === "series" ? "series" : kind === "wish" ? "wishes" : `${kind}s`;
  return `${count} ${plural}`;
}
