import assert from "node:assert/strict";
import test from "node:test";
import { fetchBookByISBN, parsePublicationDate } from "../src/lib/bookLookup";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("uses Open Library metadata before Google Books", async () => {
  const requestedUrls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.startsWith("https://openlibrary.org/api/books")) {
      return jsonResponse({
        "ISBN:9780374104092": {
          title: "Annihilation",
          authors: [{ name: "Jeff VanderMeer" }],
          number_of_pages: 208,
          subjects: [{ name: "Science fiction" }, { name: "Fiction" }, { name: "Science fiction" }],
          languages: [{ key: "/languages/eng" }],
          publishers: [{ name: "Farrar, Straus and Giroux" }],
          publish_date: "February 2014",
          description: { value: "Area X has been cut off from the rest of the continent." },
        },
      });
    }

    if (url.startsWith("https://bookcover.longitood.com")) {
      return jsonResponse({ url: "https://covers.example/annihilation.jpg" });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await fetchBookByISBN("9780374104092");

    assert.deepEqual(result, {
      title: "Annihilation",
      authors: ["Jeff VanderMeer"],
      totalPages: 208,
      genres: ["Science fiction", "Fiction"],
      language: "English",
      publisher: "Farrar, Straus and Giroux",
      publicationDate: "2014-02-01",
      publicationDatePrecision: "month",
      description: "Area X has been cut off from the rest of the continent.",
      coverUrl: "https://covers.example/annihilation.jpg",
      metadataSource: "open_library",
      metadataSourceUrl: "https://openlibrary.org/api/books?bibkeys=ISBN%3A9780374104092&format=json&jscmd=data",
    });
    assert.equal(
      requestedUrls.some((url) => url.startsWith("https://www.googleapis.com/books")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to Google Books when Open Library has no result", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.startsWith("https://openlibrary.org/api/books")) {
      return jsonResponse({});
    }

    if (url.startsWith("https://www.googleapis.com/books")) {
      return jsonResponse({
        items: [
          {
            selfLink: "https://www.googleapis.com/books/v1/volumes/google-id",
            volumeInfo: {
              title: "Station Eleven",
              authors: ["Emily St. John Mandel"],
              pageCount: 333,
              categories: ["Fiction"],
              language: "en",
              publisher: "Vintage",
              publishedDate: "2015-06-02",
              description: "A novel about art, fame, and survival.",
            },
          },
        ],
      });
    }

    if (url.startsWith("https://bookcover.longitood.com")) {
      return jsonResponse({});
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await fetchBookByISBN("9780804172448");

    assert.equal(result?.metadataSource, "google_books");
    assert.equal(result?.metadataSourceUrl, "https://www.googleapis.com/books/v1/volumes/google-id");
    assert.equal(result?.title, "Station Eleven");
    assert.equal(result?.publisher, "Vintage");
    assert.equal(result?.publicationDate, "2015-06-02");
    assert.equal(result?.publicationDatePrecision, "day");
    assert.equal(result?.description, "A novel about art, fame, and survival.");
    assert.equal(result?.coverUrl, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parses publication date precision from common provider formats", () => {
  assert.deepEqual(parsePublicationDate("2002"), {
    date: "2002-01-01",
    precision: "year",
  });
  assert.deepEqual(parsePublicationDate("2002-10"), {
    date: "2002-10-01",
    precision: "month",
  });
  assert.deepEqual(parsePublicationDate("2002-10-10"), {
    date: "2002-10-10",
    precision: "day",
  });
  assert.deepEqual(parsePublicationDate("October 2002"), {
    date: "2002-10-01",
    precision: "month",
  });
  assert.deepEqual(parsePublicationDate("10 October 2002"), {
    date: "2002-10-10",
    precision: "day",
  });
});

test("returns null when both metadata providers miss", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.startsWith("https://openlibrary.org/api/books")) {
      return jsonResponse({});
    }

    if (url.startsWith("https://www.googleapis.com/books")) {
      return jsonResponse({ items: [] });
    }

    if (url.startsWith("https://bookcover.longitood.com")) {
      return jsonResponse({ url: "https://covers.example/missing.jpg" });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    assert.equal(await fetchBookByISBN("9780000000000"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps metadata success when cover lookup fails", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.startsWith("https://openlibrary.org/api/books")) {
      return jsonResponse({
        "ISBN:9780441478125": {
          title: "The Left Hand of Darkness",
          authors: [{ name: "Ursula K. Le Guin" }],
        },
      });
    }

    if (url.startsWith("https://bookcover.longitood.com")) {
      throw new Error("cover service unavailable");
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await fetchBookByISBN("9780441478125");

    assert.equal(result?.title, "The Left Hand of Darkness");
    assert.equal(result?.metadataSource, "open_library");
    assert.equal(result?.coverUrl, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
