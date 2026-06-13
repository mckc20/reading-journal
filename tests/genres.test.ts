import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenreTree,
  formatGenrePathForDisplay,
  getGenrePathLabel,
  getMostSpecificGenres,
  getSelectedGenreTags,
  mapGenreLabelsToIds,
  searchGenres,
} from "../src/lib/genreTree";
import type { Genre } from "../src/types";

function makeGenre(overrides: Partial<Genre> & Pick<Genre, "id" | "name">): Genre {
  return {
    parent_id: null,
    user_id: null,
    is_system: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const genres = [
  makeGenre({ id: "fiction", name: "Fiction" }),
  makeGenre({ id: "fantasy", name: "Fantasy", parent_id: "fiction" }),
  makeGenre({ id: "epic", name: "Epic Fantasy", parent_id: "fantasy" }),
  makeGenre({ id: "dark", name: "Dark Fantasy", parent_id: "fantasy" }),
  makeGenre({ id: "nonfiction", name: "Non-Fiction" }),
  makeGenre({ id: "history", name: "History", parent_id: "nonfiction" }),
  makeGenre({ id: "age", name: "Age Target" }),
  makeGenre({ id: "ya", name: "Young Adult", parent_id: "age" }),
];

test("builds an unlimited-depth genre tree", () => {
  const tree = buildGenreTree(genres);
  const fiction = tree.find((genre) => genre.id === "fiction");
  const fantasy = fiction?.children.find((genre) => genre.id === "fantasy");

  assert.equal(fantasy?.children.find((genre) => genre.id === "epic")?.pathLabel, "Fiction -> Fantasy -> Epic Fantasy");
});

test("generates breadcrumb labels from parent relationships", () => {
  assert.equal(getGenrePathLabel("epic", genres), "Fiction -> Fantasy -> Epic Fantasy");
});

test("formats genre paths without top-level section noise", () => {
  assert.equal(formatGenrePathForDisplay("Age Target -> Young Adult"), "Young Adult");
  assert.equal(formatGenrePathForDisplay("Fiction -> Fantasy -> Epic Fantasy"), "Fantasy → Epic Fantasy");
});

test("searches by full path", () => {
  const results = searchGenres(genres, "fiction fantasy epic");

  assert.deepEqual(results.map((result) => result.pathLabel), ["Fiction -> Fantasy -> Epic Fantasy"]);
});

test("keeps only most-specific selected genres for compact display", () => {
  const selected = genres.filter((genre) => ["fantasy", "epic", "history"].includes(genre.id));

  assert.deepEqual(
    getMostSpecificGenres(selected, genres).map((genre) => genre.name),
    ["Epic Fantasy", "History"],
  );
});

test("keeps selected parents as separate tags instead of path prefixes", () => {
  const selected = genres.filter((genre) => ["fantasy", "epic", "history"].includes(genre.id));

  assert.deepEqual(
    getSelectedGenreTags(selected).map((genre) => genre.name),
    ["Epic Fantasy", "Fantasy", "History"],
  );
});

test("maps external genre labels and age labels to known genre ids case-insensitively", () => {
  assert.deepEqual(mapGenreLabelsToIds(["epic fantasy", "History", "young adult", "graphic novel", "Unknown"], genres), [
    "epic",
    "history",
    "ya",
  ]);
});
