import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { authenticate } from "./_lib/auth.js";
import { createMcpRestClient, createMcpServer, getMcpApiOrigin } from "./_lib/mcp.js";
import { json, methodNotAllowed } from "./_lib/http.js";

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== "POST") {
    methodNotAllowed(response, "POST");
    return;
  }

  try {
    const userId = await authenticate(request);
    if (!userId) {
      json(response, 401, { error: "Unauthorized." });
      return;
    }

    const authorization = request.headers.authorization;
    if (typeof authorization !== "string") {
      json(response, 401, { error: "Unauthorized." });
      return;
    }

    const client = createMcpRestClient(authorization, getMcpApiOrigin());
    const server = createMcpServer(client);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);
    await server.close();
  } catch (error) {
    console.error("POST /api/mcp failed", error);
    if (!response.headersSent) json(response, 500, { error: "Internal server error." });
  }
}
