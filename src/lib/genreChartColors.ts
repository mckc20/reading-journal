export const OTHERS_GENRE_CHART_COLOR = "#3c414b";

const PALETTE_COLORS = [
  "#d22d3a",
  "#e75d5a",
  "#f6c174",
  "#8fb2c4",
  "#615377",
  "#121626",
  "#3c1837",
  "#5c1c3e",
  "#85204f",
  "#a81e58",
  "#70c5a8",
  "#dfe3ae",
  "#e5be61",
  "#bf5632",
  "#3c414b",
  "#b90076",
  "#f20c4d",
  "#ff633f",
  "#f8db6d",
  "#389695",
];

const FIXED_GENRE_COLORS: Record<string, string> = {
  fiction: "#d22d3a",
  "contemporary fiction": "#e75d5a",
  "historical fiction": "#f6c174",
  "literary fiction": "#dfe3ae",
  romance: "#b90076",
  "mystery & crime": "#3c1837",
  mystery: "#615377",
  crime: "#e5be61",
  "thriller & suspense": "#121626",
  "science fiction": "#8fb2c4",
  fantasy: "#d22d3a",
  horror: "#5c1c3e",
  "action & adventure": "#70c5a8",
  "humor & satire": "#f8db6d",
  "biography & memoir": "#3c414b",
  history: "#bf5632",
  "true crime": "#85204f",
  "politics & current events": "#121626",
  "self-help & personal development": "#dfe3ae",
  "business & economics": "#389695",
  "science & technology": "#389695",
  "philosophy & spirituality": "#615377",
  "health & wellness": "#70c5a8",
  travel: "#8fb2c4",
  "cookbooks & food": "#f6c174",
  "art, photography & design": "#a81e58",
  "essays & anthologies": "#5c1c3e",
  "children's": "#f8db6d",
  childrens: "#f8db6d",
  "middle grade": "#dfe3ae",
  "young adult": "#a81e58",
  "new adult": "#f20c4d",
  adult: "#3c414b",
  "popular science": "#389695",
  "nature & environment": "#70c5a8",
  "high fantasy": "#e75d5a",
  "epic fantasy": "#bf5632",
  "urban fantasy": "#ff633f",
  "space opera": "#8fb2c4",
  dystopian: "#615377",
  "hard sci-fi": "#389695",
  others: OTHERS_GENRE_CHART_COLOR,
};

function hashLabel(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getGenreChartColor(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return "var(--primary)";

  return FIXED_GENRE_COLORS[normalized] ?? PALETTE_COLORS[hashLabel(normalized) % PALETTE_COLORS.length];
}

export function buildGenreChartColorMap(labels: string[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  const uniqueLabels = Array.from(new Set(labels.map((label) => label.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );

  for (const label of uniqueLabels) {
    colorMap.set(label, getGenreChartColor(label));
  }

  return colorMap;
}

export function getSubgenreGenreChartColor(parentColor: string, variantIndex: number): string {
  const parentWeight = Math.max(52, 82 - variantIndex * 8);
  return `color-mix(in oklch, ${parentColor} ${parentWeight}%, var(--background))`;
}
