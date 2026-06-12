import type { PublicationDatePrecision } from "@/types";

export interface ParsedPublicationDate {
  date: string;
  precision: PublicationDatePrecision;
}

function normalizeMonthName(value: string): number | undefined {
  const normalized = value.trim().toLowerCase();
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const index = monthNames.findIndex((month) => month.startsWith(normalized.slice(0, 3)));
  return index >= 0 ? index + 1 : undefined;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function parsePublicationDate(value: string | undefined): ParsedPublicationDate | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = isoMatch[2] ? Number(isoMatch[2]) : 1;
    const day = isoMatch[3] ? Number(isoMatch[3]) : 1;
    if (!isValidCalendarDate(year, month, day)) return undefined;

    return {
      date: `${year}-${pad2(month)}-${pad2(day)}`,
      precision: isoMatch[3] ? "day" : isoMatch[2] ? "month" : "year",
    };
  }

  const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = normalizeMonthName(monthYearMatch[1]);
    if (!month) return undefined;
    return {
      date: `${monthYearMatch[2]}-${pad2(month)}-01`,
      precision: "month",
    };
  }

  const dayMonthYearMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dayMonthYearMatch) {
    const day = Number(dayMonthYearMatch[1]);
    const month = normalizeMonthName(dayMonthYearMatch[2]);
    const year = Number(dayMonthYearMatch[3]);
    if (!month || !isValidCalendarDate(year, month, day)) return undefined;
    return {
      date: `${year}-${pad2(month)}-${pad2(day)}`,
      precision: "day",
    };
  }

  const yearMatch = trimmed.match(/\b(\d{4})\b/);
  if (yearMatch) {
    return {
      date: `${yearMatch[1]}-01-01`,
      precision: "year",
    };
  }

  return undefined;
}

export function parsePublicationDateInput(
  value: string,
  precision: PublicationDatePrecision | "",
): ParsedPublicationDate | undefined {
  const trimmed = value.trim();
  if (!trimmed || !precision) return undefined;

  const patterns: Record<PublicationDatePrecision, RegExp> = {
    year: /^(\d{4})$/,
    month: /^(\d{4})-(\d{2})$/,
    day: /^(\d{4})-(\d{2})-(\d{2})$/,
  };

  const match = trimmed.match(patterns[precision]);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = precision === "year" ? 1 : Number(match[2]);
  const day = precision === "day" ? Number(match[3]) : 1;
  if (!isValidCalendarDate(year, month, day)) return undefined;

  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    precision,
  };
}

export function formatPublicationDateInput(
  value: string | null | undefined,
  precision: PublicationDatePrecision | null | undefined,
): string {
  if (!value) return "";
  if (precision === "year") return value.slice(0, 4);
  if (precision === "month") return value.slice(0, 7);
  return value;
}

export function formatPublicationDateForDisplay(
  value: string | null | undefined,
  precision: PublicationDatePrecision | null | undefined,
): string {
  if (!value) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  if (!year) return value;
  if (precision === "year") return String(year);

  const date = new Date(year, (month || 1) - 1, day || 1);
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  if (precision === "month") return `${monthName} ${year}`;
  if (precision === "day") return `${monthName} ${day}, ${year}`;

  return value;
}

export function trimPublicationDateInputForPrecision(
  value: string,
  precision: PublicationDatePrecision | "",
): string {
  if (precision === "year") return value.slice(0, 4);
  if (precision === "month") return value.slice(0, 7);
  return value;
}
