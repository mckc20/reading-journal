import type { VercelRequest, VercelResponse } from '@vercel/node';
import me from './meHttp.js';
import { json } from './http.js';
import { wrapUpHandler } from './wrapUpHttp.js';

type Handler = (request: VercelRequest, response: VercelResponse) => Promise<void>;
interface Handlers { me: Handler; archive: Handler; report: Handler }
const defaults: Handlers = { me, archive: wrapUpHandler(false), report: wrapUpHandler(true) };

/** Explicit rewrites share one Vercel function without changing each route's auth or behavior. */
export function appHandler(handlers: Handlers = defaults): Handler {
  return async (request, response) => {
    if (request.query.route === 'me') return handlers.me(request, response);
    if (request.query.route === 'wrap-ups') {
      return request.query.monthKey === undefined
        ? handlers.archive(request, response)
        : handlers.report(request, response);
    }
    json(response, 404, { error: 'API route not found.' });
  };
}
