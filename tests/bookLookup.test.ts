import assert from "node:assert/strict";
import test from "node:test";
import { fetchBookByISBN, parsePublicationDate, searchBooksByTitle } from "../src/lib/bookLookup";

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
      publicationDate: "2014-01-01",
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
    assert.equal(result?.publicationDate, "2015-01-01");
    assert.equal(result?.description, "A novel about art, fame, and survival.");
    assert.equal(result?.coverUrl, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parses publication years from common provider formats", () => {
  assert.deepEqual(parsePublicationDate("2002"), {
    date: "2002-01-01",
  });
  assert.deepEqual(parsePublicationDate("2002-10"), {
    date: "2002-01-01",
  });
  assert.deepEqual(parsePublicationDate("2002-10-10"), {
    date: "2002-01-01",
  });
  assert.deepEqual(parsePublicationDate("October 2002"), {
    date: "2002-01-01",
  });
  assert.deepEqual(parsePublicationDate("10 October 2002"), {
    date: "2002-01-01",
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

test("searches Google Books by title and normalizes selectable editions", async () => {
  const requestedUrls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    return jsonResponse({
      items: [
        {
          selfLink: "https://www.googleapis.com/books/v1/volumes/edition-1",
          volumeInfo: {
            title: "The Left Hand of Darkness",
            authors: ["Ursula K. Le Guin"],
            pageCount: 304,
            categories: ["Fiction", "Science fiction"],
            language: "en",
            publishedDate: "1969-03-01",
            description: "A classic science fiction novel.",
            imageLinks: {
              thumbnail: "http://books.google.com/books/content?id=edition-1",
            },
            industryIdentifiers: [
              { type: "ISBN_10", identifier: "0441478123" },
              { type: "ISBN_13", identifier: "9780441478125" },
            ],
          },
        },
        {
          volumeInfo: {
            title: "The Left Hand of Darkness",
            industryIdentifiers: [{ type: "ISBN_10", identifier: "0441478123" }],
          },
        },
      ],
    });
  };

  try {
    const results = await searchBooksByTitle("The Left Hand of Darkness");

    assert.deepEqual(requestedUrls, [
      "https://www.googleapis.com/books/v1/volumes?q=intitle:The%20Left%20Hand%20of%20Darkness&maxResults=10",
    ]);
    assert.deepEqual(results, [
      {
        id: "https://www.googleapis.com/books/v1/volumes/edition-1",
        title: "The Left Hand of Darkness",
        authors: ["Ursula K. Le Guin"],
        totalPages: 304,
        genres: ["Fiction", "Science fiction"],
        language: "English",
        coverUrl: "https://books.google.com/books/content?id=edition-1",
        publicationDate: "1969-01-01",
        description: "A classic science fiction novel.",
        isbn: "9780441478125",
        metadataSource: "google_books",
        metadataSourceUrl: "https://www.googleapis.com/books/v1/volumes/edition-1",
      },
      {
        id: "https://www.googleapis.com/books/v1/volumes?q=intitle:The%20Left%20Hand%20of%20Darkness&maxResults=10#1",
        title: "The Left Hand of Darkness",
        authors: ["Unknown"],
        totalPages: undefined,
        genres: undefined,
        language: undefined,
        coverUrl: undefined,
        publicationDate: undefined,
        description: undefined,
        isbn: "0441478123",
        metadataSource: "google_books",
        metadataSourceUrl:
          "https://www.googleapis.com/books/v1/volumes?q=intitle:The%20Left%20Hand%20of%20Darkness&maxResults=10",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns an empty title search for a blank query without requesting the API", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return jsonResponse({ items: [] });
  };

  try {
    assert.deepEqual(await searchBooksByTitle("  "), []);
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to Open Library when Google Books title search is unavailable", async () => {
  const requestedUrls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.startsWith("https://www.googleapis.com/books")) {
      return new Response(null, { status: 429 });
    }

    if (url.startsWith("https://openlibrary.org/search.json")) {
      return jsonResponse({
        docs: [
          {
            key: "/works/OL27482W",
            title: "The Hobbit",
            author_name: ["J.R.R. Tolkien"],
            number_of_pages_median: 310,
            subject: ["Fantasy", "Fiction"],
            language: ["eng"],
            first_publish_year: 1937,
            cover_i: 14627509,
            isbn: ["0261103303", "9780261103308"],
          },
        ],
      });
    }

    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const [result] = await searchBooksByTitle("The Hobbit");

    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[1], /^https:\/\/openlibrary\.org\/search\.json\?/);
    assert.deepEqual(result, {
      id: "https://openlibrary.org/works/OL27482W",
      title: "The Hobbit",
      authors: ["J.R.R. Tolkien"],
      totalPages: 310,
      genres: ["Fantasy", "Fiction"],
      language: "English",
      coverUrl: "https://covers.openlibrary.org/b/id/14627509-M.jpg",
      publicationDate: "1937-01-01",
      isbn: "9780261103308",
      metadataSource: "open_library",
      metadataSourceUrl: requestedUrls[1],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("keeps title results selectable when optional metadata is missing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse({
      items: [
        {
          volumeInfo: {
            title: "A Manual Entry",
            imageLinks: { thumbnail: "javascript:alert(1)" },
          },
        },
      ],
    });

  try {
    const [result] = await searchBooksByTitle("A Manual Entry");
    assert.deepEqual(result, {
      id: "https://www.googleapis.com/books/v1/volumes?q=intitle:A%20Manual%20Entry&maxResults=10#0",
      title: "A Manual Entry",
      authors: ["Unknown"],
      totalPages: undefined,
      genres: undefined,
      language: undefined,
      coverUrl: undefined,
      publicationDate: undefined,
      description: undefined,
      isbn: undefined,
      metadataSource: "google_books",
      metadataSourceUrl:
        "https://www.googleapis.com/books/v1/volumes?q=intitle:A%20Manual%20Entry&maxResults=10",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports title search request failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 503 });

  try {
    await assert.rejects(() => searchBooksByTitle("Unavailable book"), /failed with status 503/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns no title results for an empty Google Books response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ items: [] });

  try {
    assert.deepEqual(await searchBooksByTitle("No matching book"), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
