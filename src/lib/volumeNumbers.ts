export function formatVolumeNumber(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return Number(value.toFixed(2)).toString();
}

export function parseVolumeNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isValidVolumeNumberInput(value: string): boolean {
  return parseVolumeNumberInput(value) !== null;
}
