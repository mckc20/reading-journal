export function formatMediumDate(date: Date, timeStyle?: Intl.DateTimeFormatOptions["timeStyle"]): string {
  // A narrow nonbreaking space keeps dotted dates together without crowding the numbers.
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle }).replace(/(\p{Nd})\.(?=\p{Nd})/gu, "$1.\u202f");
}
