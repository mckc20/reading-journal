export interface ParsedPublicationDate {
  date: string;
}

function storedYearDate(year: string): ParsedPublicationDate {
  return { date: `${year}-01-01` };
}

export function parsePublicationDate(value: string | undefined): ParsedPublicationDate | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (yearMatch) return storedYearDate(yearMatch[1]);

  return undefined;
}

export function parsePublicationDateInput(value: string): ParsedPublicationDate | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const match = trimmed.match(/^(\d{4})$/);
  if (!match) return undefined;
  return storedYearDate(match[1]);
}

export function formatPublicationDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const year = value.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "";
}

export function formatPublicationDateForDisplay(value: string | null | undefined): string {
  if (!value) return "Not set";
  const [year] = value.split("-").map(Number);
  if (!year) return value;
  return String(year);
}
