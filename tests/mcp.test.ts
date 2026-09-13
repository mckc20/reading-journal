import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createMcpRestClient,
  createMcpServer,
  getMcpApiOrigin,
  type McpRestClient,
} from "../api/_lib/mcp";

const BOOK_ID = "4d264b17-1dea-4fa9-b667-f981016f9a82";

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function recordingClient() {
  const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  const client: McpRestClient = {
    get: async (path) => {
      calls.push({ method: "GET", path });
      return textResult({ ok: true });
    },
    send: async (path, method, body) => {
      calls.push({ method, path, body });
      return textResult({ ok: true });
    },
  };
  return { client, calls };
}

async function connectServer(client: McpRestClient) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(client);
  const mcpClient = new Client({ name: "mcp-test-client", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
  return { server, mcpClient };
}

test("exposes the six focused MCP tools with correct read/write annotations", async () => {
  const { client } = recordingClient();
  const { server, mcpClient } = await connectServer(client);
  const result = await mcpClient.listTools();
  const tools = new Map(result.tools.map((tool) => [tool.name, tool]));

  assert.deepEqual([...tools.keys()].sort(), [
    "add_book_journal_entry",
    "get_book_progress",
    "list_books",
    "log_reading_progress",
    "search_books",
    "update_book",
  ]);
  assert.equal(tools.get("list_books")?.annotations?.readOnlyHint, true);
  assert.equal(tools.get("search_books")?.annotations?.readOnlyHint, true);
  assert.equal(tools.get("get_book_progress")?.annotations?.readOnlyHint, true);
  assert.equal(tools.get("log_reading_progress")?.annotations?.readOnlyHint, false);
  assert.equal(tools.get("add_book_journal_entry")?.annotations?.readOnlyHint, false);
  assert.equal(tools.get("update_book")?.annotations?.readOnlyHint, false);
  assert.match(tools.get("search_books")?.description ?? "", /titles only/i);

  await Promise.all([mcpClient.close(), server.close()]);
});

test("maps tool calls to encoded REST paths and matching request bodies", async () => {
  const { client, calls } = recordingClient();
  const { server, mcpClient } = await connectServer(client);

  await mcpClient.callTool({ name: "list_books", arguments: { status: "Reading", limit: 5 } });
  await mcpClient.callTool({ name: "search_books", arguments: { query: "A book & another" } });
  await mcpClient.callTool({ name: "get_book_progress", arguments: { book_id: BOOK_ID } });
  await mcpClient.callTool({
    name: "log_reading_progress",
    arguments: { book_id: BOOK_ID, current_page: 214, reading_time_minutes: 30 },
  });
  await mcpClient.callTool({
    name: "add_book_journal_entry",
    arguments: { book_id: BOOK_ID, label: "quote", content: "Exact quote", page_start: 83 },
  });
  await mcpClient.callTool({ name: "update_book", arguments: { book_id: BOOK_ID, status: "Finished", rating: 5 } });

  assert.deepEqual(calls, [
    { method: "GET", path: "/api/books?status=Reading&limit=5" },
    { method: "GET", path: "/api/books/search?q=A%20book%20%26%20another" },
    { method: "GET", path: `/api/books/${BOOK_ID}/progress` },
    { method: "POST", path: `/api/books/${BOOK_ID}/reading-logs`, body: { current_page: 214, reading_time_minutes: 30 } },
    { method: "POST", path: `/api/books/${BOOK_ID}/journal`, body: { label: "quote", content: "Exact quote", page_start: 83 } },
    { method: "PATCH", path: `/api/books/${BOOK_ID}`, body: { status: "Finished", rating: 5 } },
  ]);

  await Promise.all([mcpClient.close(), server.close()]);
});

test("rejects invalid MCP input before the REST client is called", async () => {
  const { client, calls } = recordingClient();
  const { server, mcpClient } = await connectServer(client);
  const result = await mcpClient.callTool({ name: "log_reading_progress", arguments: { book_id: BOOK_ID, current_page: -1 } });

  assert.equal(result.isError, true);
  assert.equal(calls.length, 0);

  await Promise.all([mcpClient.close(), server.close()]);
});

test("forwards the bearer token only to the configured trusted origin", async () => {
  const requests: Array<{ url: string; authorization: string | null; body: string | undefined }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    requests.push({ url: String(input), authorization: headers.get("Authorization"), body: init?.body as string | undefined });
    return new Response(JSON.stringify({ id: "book" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const client = createMcpRestClient("Bearer rjk_live_secret", "https://journal.example", fetchMock);

  const result = await client.send("/api/books/example", "PATCH", { rating: 5 });

  assert.deepEqual(requests, [{
    url: "https://journal.example/api/books/example",
    authorization: "Bearer rjk_live_secret",
    body: '{"rating":5}',
  }]);
  assert.doesNotMatch(result.content[0].text, /rjk_live_secret/);
});

test("returns REST errors as actionable MCP tool errors", async () => {
  const fetchMock: typeof fetch = async () => new Response(JSON.stringify({ error: "Book not found." }), { status: 404 });
  const client = createMcpRestClient("Bearer rjk_live_secret", "https://journal.example", fetchMock);

  const result = await client.get(`/api/books/${BOOK_ID}/progress`);

  assert.equal(result.isError, true);
  assert.equal(result.content[0].text, "Book not found.");
});

test("only accepts an HTTPS origin or localhost HTTP for MCP REST forwarding", () => {
  assert.equal(getMcpApiOrigin("https://journal.example/path"), "https://journal.example");
  assert.equal(getMcpApiOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.throws(() => getMcpApiOrigin("http://journal.example"), /HTTPS/);
  assert.throws(() => getMcpApiOrigin(undefined), /not configured/);
});
