import type { InsightsPeriod } from '@/components/redesign/InsightsPreview';

// Manually supplied fictional summaries. These do not execute production calculations.
export const insightsPeriods: InsightsPeriod[] = [
  {
    id: 'month', label: 'October 2026', range: '1–31 October 2026', days: 18, logs: 24, timedLogs: 20, averageMinutes: 22, finished: 5,
    buckets: [{ label: '1–7 Oct', days: 4, available: 7 }, { label: '8–14 Oct', days: 5, available: 7 }, { label: '15–21 Oct', days: 3, available: 7 }, { label: '22–28 Oct', days: 4, available: 7 }, { label: '29–31 Oct', days: 2, available: 3 }],
    previous: { label: 'September 2026', days: 12, averageMinutes: 31 },
    genres: [{ name: 'Fantasy', count: 3, rated: 3, rating: 3.7 }, { name: 'Literary fiction', count: 2, rated: 2, rating: 4.5 }, { name: 'Mystery', count: 1, rated: 0, rating: null }],
    returns: ['Two finished books by Mira Vale — an author you returned to.', 'Two volumes of The Tideglass Letters finished this month.'],
    journeys: ['A Garden After Rain · 4–16 October · 13 elapsed days from start to finish.', 'The Last Lantern · paused on 12 October and resumed on 20 October.', 'The Glass Orchard · marked DNF on 24 October. A story you chose to leave here.'],
  },
  {
    id: 'year', label: '2026 so far', range: '1 January–22 November 2026', days: 136, logs: 180, timedLogs: 144, averageMinutes: 28, finished: 24,
    buckets: [{ label: 'Jan–Mar', days: 35, available: 90 }, { label: 'Apr–Jun', days: 38, available: 91 }, { label: 'Jul–Sep', days: 32, available: 92 }, { label: 'Oct–22 Nov', days: 31, available: 53 }],
    genres: [{ name: 'Fantasy', count: 12, rated: 10, rating: 3.9 }, { name: 'Literary fiction', count: 8, rated: 7, rating: 4.6 }, { name: 'Mystery', count: 6, rated: 4, rating: 4.0 }],
    returns: ['Four finished books by Mira Vale this year.', 'Three volumes of The Tideglass Letters finished this year.'],
    journeys: ['A Garden After Rain · 4–16 October · 13 elapsed days from start to finish.', 'The Last Lantern · paused 12–20 October, then finished on 8 November.', 'The Glass Orchard · marked DNF on 24 October.'],
  },
];
export const sparsePeriods: InsightsPeriod[] = [{
  id: 'sparse', label: 'October 2026', range: '1–31 October 2026', days: 1, logs: 1, timedLogs: 0, averageMinutes: null, finished: 1,
  buckets: [{ label: '1–7 Oct', days: 0, available: 7 }, { label: '8–14 Oct', days: 0, available: 7 }, { label: '15–21 Oct', days: 1, available: 7 }, { label: '22–28 Oct', days: 0, available: 7 }, { label: '29–31 Oct', days: 0, available: 3 }],
  genres: [{ name: 'Literary fiction', count: 1, rated: 1, rating: 5 }], returns: [], journeys: [],
}];
export const emptyPeriods: InsightsPeriod[] = [{ ...sparsePeriods[0], days: 0, logs: 0, finished: 0, buckets: sparsePeriods[0].buckets.map(bucket => ({ ...bucket, days: 0 })), genres: [] }];
export const insightsGoal = { year: '2026', finished: 24, target: 30 };
export const insightsWrapUp = { label: 'September 2026', finished: 3, excerpt: 'A month of returning to familiar worlds. The Quiet Atlas stayed with you, and three new reflections found a home in your journal.' };
