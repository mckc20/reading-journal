import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalyticsDashboardData } from "../src/lib/analyticsDashboard";
import type { Book, ReadingLog } from "../src/types";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1",
    title: "Test Book",
    authors: ["Author One"],
    genres: ["Fantasy"],
    status: "Finished",
    is_favorite: false,
    total_pages: 300,
    current_page: 300,
    rating: 4,
    date_started: "2026-01-01",
    date_finished: "2026-01-10",
    format: "Hardcover",
    user_id: "user-1",
    created_at: "2026-01-01T10:00:00Z",
    ...overrides,
  };
}

function makeLog(overrides: Partial<ReadingLog> = {}): ReadingLog {
  return {
    id: "log-1",
    book_id: "book-1",
    user_id: "user-1",
    current_page: 100,
    reading_time_minutes: 60,
    logged_at: "2026-01-02T12:00:00Z",
    ...overrides,
  };
}

function findDateForWeekday(year: number, weekday: number): string {
  for (let month = 0; month < 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const date = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (date.getUTCMonth() !== month) continue;
      if (date.getUTCDay() === weekday) return date.toISOString().slice(0, 10);
    }
  }

  throw new Error(`No weekday ${weekday} found for ${year}`);
}

test("builds overview and monthly trend metrics from books and reading logs", () => {
  const data = buildAnalyticsDashboardData(
    [
      makeBook({ id: "book-1", total_pages: 300, date_finished: "2026-01-10" }),
      makeBook({
        id: "book-2",
        title: "Currently Reading",
        status: "Reading",
        total_pages: 500,
        current_page: 150,
        date_finished: undefined,
      }),
    ],
    [
      makeLog({ id: "a", book_id: "book-1", current_page: 100, reading_time_minutes: 30, logged_at: "2026-01-02T12:00:00Z" }),
      makeLog({ id: "b", book_id: "book-1", current_page: 160, reading_time_minutes: 45, logged_at: "2026-01-03T12:00:00Z" }),
      makeLog({ id: "c", book_id: "book-2", current_page: 80, reading_time_minutes: 40, logged_at: "2026-02-01T12:00:00Z" }),
    ],
  );

  assert.equal(data.overview.booksFinished, 1);
  assert.equal(data.overview.pagesRead, 300);
  assert.equal(data.overview.readingMinutes, 115);
  assert.equal(data.overview.averagePace, 80);
  assert.deepEqual(data.trends.pagesReadByMonth.map((bucket) => [bucket.key, bucket.value]), [
    ["2026-01", 160],
    ["2026-02", 80],
  ]);
  assert.deepEqual(data.trends.readingMinutesByMonth.map((bucket) => [bucket.key, bucket.value]), [
    ["2026-01", 75],
    ["2026-02", 40],
  ]);
});

test("builds average pace over time as cumulative overall pace", () => {
  const data = buildAnalyticsDashboardData(
    [makeBook({ id: "book-1", total_pages: 400, date_finished: "2026-02-10" })],
    [
      makeLog({ id: "jan-a", current_page: 100, logged_at: "2026-01-02T12:00:00Z" }),
      makeLog({ id: "jan-b", current_page: 160, logged_at: "2026-01-03T12:00:00Z" }),
      makeLog({ id: "feb-a", current_page: 240, logged_at: "2026-02-01T12:00:00Z" }),
    ],
  );

  assert.equal(data.overview.averagePace, 80);
  assert.deepEqual(
    data.trends.averagePaceByMonth.map((bucket) => [bucket.key, bucket.value]),
    [
      ["2026-01", 80],
      ["2026-02", 80],
    ],
  );
});

test("groups genre evolution overflow into Others so each year fills the full bar", () => {
  const data = buildAnalyticsDashboardData(
    ["Fantasy", "Science Fiction", "History", "Mystery", "Romance", "Horror", "Travel"].map((genre, index) =>
      makeBook({
        id: `book-${index}`,
        title: `Book ${index}`,
        genres: [genre],
        date_finished: "2026-03-10",
      })
    ),
    [],
  );

  const genres = data.preferences.genreEvolution[0]?.genres ?? [];
  const totalPercentage = genres.reduce((sum, genre) => sum + genre.percentage, 0);

  assert.equal(genres.length, 7);
  assert.equal(genres.at(-1)?.label, "Others");
  assert.equal(genres.at(-1)?.value, 1);
  assert.ok(Math.abs(totalPercentage - 100) < 0.000001);
});

test("builds drill-down metrics and new small insights", () => {
  const currentYear = new Date().getFullYear();
  const monday = findDateForWeekday(currentYear, 1);
  const tuesday = findDateForWeekday(currentYear, 2);
  const expectedMondayLabel = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(`${monday}T12:00:00Z`));
  const data = buildAnalyticsDashboardData(
    [
      makeBook({
        id: "fantasy-reread-1",
        title: "Reread Me",
        authors: ["Repeat Author"],
        genres: ["Fantasy"],
        date_finished: `${currentYear}-01-10`,
        rating: 5,
      }),
      makeBook({
        id: "fantasy-reread-2",
        title: "Reread Me",
        authors: ["Repeat Author"],
        genres: ["Fantasy"],
        date_finished: `${currentYear}-02-10`,
        rating: 4,
      }),
      makeBook({
        id: "history-dnf",
        title: "Abandoned",
        genres: ["History"],
        status: "DNF",
        date_finished: undefined,
      }),
    ],
    [
      makeLog({ id: "monday-a", current_page: 50, reading_time_minutes: 30, logged_at: `${monday}T12:00:00Z` }),
      makeLog({ id: "monday-b", current_page: 110, reading_time_minutes: 45, logged_at: `${monday}T13:00:00Z` }),
      makeLog({ id: "tuesday", current_page: 150, reading_time_minutes: 10, logged_at: `${tuesday}T12:00:00Z` }),
    ],
  );

  assert.equal(data.insights.mostRereadAuthor, "Repeat Author");
  assert.equal(data.insights.genreExploredMostThisYear, "Fantasy");
  assert.equal(data.insights.mostReadWeekday, expectedMondayLabel);
  assert.equal(data.preferences.genreRatings[0].label, "Fantasy");
  assert.equal(data.preferences.genreRatings[0].value, 4.5);
  assert.equal(data.preferences.genreCompletionRates.find((genre) => genre.label === "History")?.value, 0);
  assert.deepEqual(data.trends.pagesPerDayDistribution.map((bucket) => [bucket.key, bucket.value]), [
    ["1-24", 0],
    ["25-49", 1],
    ["50-74", 0],
    ["75-99", 0],
    ["100-124", 1],
    ["125-149", 0],
    ["150-199", 0],
    ["200+", 0],
  ]);
});

test("calculates completion rate from finished and DNF outcomes only", () => {
  const data = buildAnalyticsDashboardData(
    [
      makeBook({ id: "finished-1" }),
      makeBook({ id: "finished-2", title: "Second" }),
      makeBook({ id: "dnf", status: "DNF", title: "Abandoned", date_finished: undefined }),
      makeBook({ id: "to-read", status: "To Read", title: "To Read", date_finished: undefined }),
    ],
    [],
  );

  assert.equal(Math.round(data.completion.completedPercentage ?? 0), 67);
  assert.equal(Math.round(data.completion.dnfPercentage ?? 0), 33);
});

test("requires at least three DNF books before abandoned genres are considered reliable", () => {
  const notEnough = buildAnalyticsDashboardData(
    [
      makeBook({ id: "dnf-1", status: "DNF", genres: ["Fantasy"] }),
      makeBook({ id: "dnf-2", status: "DNF", genres: ["Fantasy"] }),
    ],
    [],
  );
  const enough = buildAnalyticsDashboardData(
    [
      makeBook({ id: "dnf-1", status: "DNF", genres: ["Fantasy"] }),
      makeBook({ id: "dnf-2", status: "DNF", genres: ["Fantasy"] }),
      makeBook({ id: "dnf-3", status: "DNF", genres: ["History"] }),
    ],
    [],
  );

  assert.equal(notEnough.completion.hasEnoughDnfData, false);
  assert.equal(enough.completion.hasEnoughDnfData, true);
  assert.equal(enough.completion.abandonedGenres[0].label, "Fantasy");
});

test("groups format distribution with physical split into hardcover and paperback", () => {
  const data = buildAnalyticsDashboardData(
    [
      makeBook({ id: "hardcover", format: "Hardcover" }),
      makeBook({ id: "paperback", format: "Paperback" }),
      makeBook({ id: "ebook", format: "eBook" }),
      makeBook({ id: "audio", format: "Audiobook" }),
    ],
    [],
  );

  assert.deepEqual(data.preferences.formatDistribution, {
    physical: {
      total: 2,
      hardcover: 1,
      paperback: 1,
    },
    ebook: 1,
    audiobook: 1,
    total: 4,
  });
});

test("builds hall of fame records from log and book data", () => {
  const data = buildAnalyticsDashboardData(
    [
      makeBook({ id: "book-1", title: "Fast Book", total_pages: 120, date_started: "2026-01-01", date_finished: "2026-01-02" }),
      makeBook({ id: "book-2", title: "Long Book", total_pages: 900, date_started: "2026-02-01", date_finished: "2026-03-01" }),
    ],
    [
      makeLog({ id: "a", book_id: "book-1", current_page: 100, reading_time_minutes: 30, logged_at: "2026-01-01T12:00:00Z" }),
      makeLog({ id: "b", book_id: "book-2", current_page: 200, reading_time_minutes: 180, logged_at: "2026-02-01T12:00:00Z" }),
    ],
  );

  assert.equal(data.hallOfFame.longestSession?.book?.id, "book-2");
  assert.equal(data.hallOfFame.fastestFinishedBook?.book?.id, "book-1");
  assert.equal(data.hallOfFame.longestFinishedBook?.book?.id, "book-2");
});
