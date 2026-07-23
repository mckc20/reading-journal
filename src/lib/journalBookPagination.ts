export interface JournalBookPaginationItem {
  id: string;
  content: string;
  tagCount?: number;
  hasAttribution?: boolean;
  childCount?: number;
  headingWeight?: number;
  forceNewPage?: boolean;
}

export type JournalBookPaginatedItem<T extends JournalBookPaginationItem> = T & {
  originalId: string;
  segmentIndex: number;
  segmentCount: number;
  isContinuation: boolean;
  sourceStart?: number;
  sourceEnd?: number;
};

export interface JournalBookPage<T extends JournalBookPaginationItem> {
  id: string;
  entries: Array<JournalBookPaginatedItem<T>>;
  weight: number;
}

export interface JournalBookPaginationOptions {
  pageCapacity?: number;
}

const DEFAULT_PAGE_CAPACITY = 24;
const BASE_ENTRY_WEIGHT = 4;
const CHARS_PER_LINE = 42;
const TAG_WEIGHT = 1;
const ATTRIBUTION_WEIGHT = 1;
const CHILD_WEIGHT = 2;

function getFixedMetadataWeight(item: JournalBookPaginationItem): number {
  return BASE_ENTRY_WEIGHT +
    (item.tagCount ?? 0) * TAG_WEIGHT +
    (item.hasAttribution ? ATTRIBUTION_WEIGHT : 0) +
    (item.childCount ?? 0) * CHILD_WEIGHT +
    (item.headingWeight ?? 0);
}

export function estimateJournalBookEntryWeight(item: JournalBookPaginationItem): number {
  const contentWeight = estimateContentLineWeight(item.content);

  return Math.max(BASE_ENTRY_WEIGHT, getFixedMetadataWeight(item) + contentWeight);
}

function estimateContentLineWeight(content: string): number {
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) return 0;

  return trimmedContent.split(/\n{2,}/).reduce((weight, paragraph, index) => {
    const paragraphWeight = paragraph
      .split("\n")
      .reduce((lineWeight, line) => {
        const displayLine = line.replace(/^>\s?/, "").trim();
        return lineWeight + Math.max(1, Math.ceil(displayLine.length / CHARS_PER_LINE));
      }, 0);

    return weight + paragraphWeight + (index > 0 ? 1 : 0);
  }, 0);
}

function splitLongWord(value: string, maxLength: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += maxLength) {
    chunks.push(value.slice(index, index + maxLength));
  }
  return chunks;
}

function splitTextIntoChunks(content: string, maxLineWeight: number): string[] {
  if (estimateContentLineWeight(content) <= maxLineWeight) return [content];

  const chunks: string[] = [];
  let current = "";

  content.split(/(\s+)/).forEach((part) => {
    if (estimateContentLineWeight(part) > maxLineWeight) {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongWord(part, Math.max(1, maxLineWeight * CHARS_PER_LINE)));
      return;
    }

    const candidate = `${current}${part}`;
    if (current.length > 0 && estimateContentLineWeight(candidate) > maxLineWeight) {
      chunks.push(current);
      current = part.trimStart();
      return;
    }

    current = candidate;
  });

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function splitContentIntoPageSizedChunks(content: string, maxLineWeight: number): string[] {
  return splitTextIntoChunks(content, maxLineWeight);
}

function splitLongEntry<T extends JournalBookPaginationItem>(
  item: T,
  pageCapacity: number,
): Array<JournalBookPaginatedItem<T>> {
  const contentCapacity = Math.max(4, pageCapacity - getFixedMetadataWeight(item));
  const chunks = splitContentIntoPageSizedChunks(item.content, contentCapacity);

  return chunks.map((content, index) => ({
    ...item,
    id: chunks.length === 1 ? item.id : `${item.id}:book-page-segment-${index + 1}`,
    originalId: item.id,
    content,
    segmentIndex: index,
    segmentCount: chunks.length,
    isContinuation: index > 0,
    tagCount: index === chunks.length - 1 ? item.tagCount : 0,
    hasAttribution: index === 0 ? item.hasAttribution : false,
    childCount: index === 0 ? item.childCount : 0,
    headingWeight: index === 0 ? item.headingWeight : 0,
    forceNewPage: false,
  }));
}

export function paginateJournalBookEntries<T extends JournalBookPaginationItem>(
  items: T[],
  options: JournalBookPaginationOptions = {},
): JournalBookPage<T>[] {
  if (items.length === 0) return [];

  const pageCapacity = options.pageCapacity ?? DEFAULT_PAGE_CAPACITY;
  const pages: JournalBookPage<T>[] = [];
  let currentEntries: Array<JournalBookPaginatedItem<T>> = [];
  let currentWeight = 0;

  function pushCurrentPage() {
    if (currentEntries.length === 0) return;
    pages.push({
      id: `journal-page-${pages.length + 1}`,
      entries: currentEntries,
      weight: currentWeight,
    });
    currentEntries = [];
    currentWeight = 0;
  }

  function addSegment(segment: JournalBookPaginatedItem<T>) {
    const segmentWeight = estimateJournalBookEntryWeight(segment);
    const wouldOverflow = currentEntries.length > 0 && currentWeight + segmentWeight > pageCapacity;

    if (wouldOverflow) pushCurrentPage();

    currentEntries.push(segment);
    currentWeight += segmentWeight;
  }

  items.forEach((item) => {
    if (item.forceNewPage) pushCurrentPage();

    const itemWeight = estimateJournalBookEntryWeight(item);
    const entrySegments = itemWeight > pageCapacity ? splitLongEntry(item, pageCapacity) : [
      {
        ...item,
        originalId: item.id,
        segmentIndex: 0,
        segmentCount: 1,
        isContinuation: false,
      },
    ];

    entrySegments.forEach(addSegment);
  });

  pushCurrentPage();

  return pages;
}
