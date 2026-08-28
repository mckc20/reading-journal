import type { VercelResponse } from "@vercel/node";

export function json(response: VercelResponse, status: number, body: unknown): void {
  response.status(status).json(body);
}

export function methodNotAllowed(response: VercelResponse, allowedMethod: string): void {
  response.setHeader("Allow", allowedMethod);
  json(response, 405, { error: "Method not allowed." });
}
