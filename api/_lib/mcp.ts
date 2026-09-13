import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { API_BOOK_STATUSES, API_JOURNAL_LABELS } from "./books.js";

const SERVER_INSTRUCTIONS = [
  "Resolve a book before performing a write. For a currently reading book, call list_books with status Reading.",
  "Inspect both title and authors in returned books. search_books searches titles only.",
  "If more than one book is plausible, ask the user to clarify; never write to a guessed book.",
  "Preserve quote wording exactly. A five-star rating does not mean a book is finished unless the user says so.",
  "Combine compatible updates, such as status Finished and rating 5, in one update_book call.",
].join(" ");

export type McpRestClient = {
  get(path: string): Promise<McpToolResult>;
  send(path: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<McpToolResult>;
};

export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function textResult(value: unknown): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function errorResult(message: string): McpToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function responseMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function getMcpApiOrigin(value = process.env.READING_JOURNAL_API_ORIGIN): string {
  if (!value) throw new Error("READING_JOURNAL_API_ORIGIN is not configured.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("READING_JOURNAL_API_ORIGIN must be an absolute URL.");
  }

  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error("READING_JOURNAL_API_ORIGIN must use HTTPS, or localhost HTTP for local development.");
  }

  return url.origin;
}

export function createMcpRestClient(authorization: string, apiOrigin = getMcpApiOrigin(), fetchImpl = fetch): McpRestClient {
  async function request(path: string, init: RequestInit): Promise<McpToolResult> {
    try {
      const response = await fetchImpl(new URL(path, apiOrigin), {
        ...init,
        headers: {
          Authorization: authorization,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      });
      const body = await responseBody(response);

      if (!response.ok) return errorResult(responseMessage(body, "Reading Journal could not complete that request."));
      return textResult(body);
    } catch {
      return errorResult("Reading Journal could not be reached. Please try again.");
    }
  }

  return {
    get: (path) => request(path, { method: "GET" }),
    send: (path, method, body) => request(path, { method, body: JSON.stringify(body) }),
  };
}

export function createMcpServer(client: McpRestClient): McpServer {
  const server = new McpServer(
    { name: "reading-journal", version: "1.0.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "list_books",
    {
      title: "List books",
      description: "List the user's books. Filter by status, especially Reading for a currently reading book.",
      inputSchema: {
        status: z.enum(API_BOOK_STATUSES).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ status, limit }) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (limit !== undefined) params.set("limit", String(limit));
      const query = params.toString();
      return client.get(`/api/books${query ? `?${query}` : ""}`);
    },
  );

  server.registerTool(
    "search_books",
    {
      title: "Search books",
      description: "Find books by full or partial title. This search currently matches titles only; inspect authors in results too.",
      inputSchema: { query: z.string().trim().min(1) },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ query }) => client.get(`/api/books/search?q=${encodeURIComponent(query)}`),
  );

  server.registerTool(
    "get_book_progress",
    {
      title: "Get book progress",
      description: "Get a book's page progress, status, dates, percentage, and latest reading session.",
      inputSchema: { book_id: z.string().uuid() },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ book_id }) => client.get(`/api/books/${encodeURIComponent(book_id)}/progress`),
  );

  server.registerTool(
    "log_reading_progress",
    {
      title: "Log reading progress",
      description: "Record the current page and optional reading duration or ISO timestamp for a resolved book.",
      inputSchema: {
        book_id: z.string().uuid(),
        current_page: z.number().int().min(0),
        reading_time_minutes: z.number().int().min(0).optional(),
        logged_at: z.string().datetime().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ book_id, ...body }) => client.send(`/api/books/${encodeURIComponent(book_id)}/reading-logs`, "POST", body),
  );

  server.registerTool(
    "add_book_journal_entry",
    {
      title: "Add book journal entry",
      description: "Add a note, review, or exact quote to a resolved book. Do not rewrite quote content.",
      inputSchema: {
        book_id: z.string().uuid(),
        label: z.enum(API_JOURNAL_LABELS),
        content: z.string().trim().min(1),
        page_start: z.number().int().min(1).optional(),
        quote_speaker: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    ({ book_id, ...body }) => client.send(`/api/books/${encodeURIComponent(book_id)}/journal`, "POST", body),
  );

  server.registerTool(
    "update_book",
    {
      title: "Update book",
      description: "Update a resolved book's status, rating, current page, or reading dates. Combine compatible changes in one call.",
      inputSchema: {
        book_id: z.string().uuid(),
        status: z.enum(API_BOOK_STATUSES).optional(),
        rating: z.number().int().min(1).max(5).nullable().optional(),
        current_page: z.number().int().min(0).nullable().optional(),
        date_started: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        date_finished: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ book_id, ...body }) => client.send(`/api/books/${encodeURIComponent(book_id)}`, "PATCH", body),
  );

  return server;
}
