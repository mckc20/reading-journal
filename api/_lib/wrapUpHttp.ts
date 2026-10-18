import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateUserSession } from './auth.js';
import { json, methodNotAllowed } from './http.js';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { generateMonthlyReport, reportRepository } from './wrapUpReports.js';
import { loadWrapUpArchive } from './wrapUpArchive.js';
import { monthlyPeriod } from '../../src/lib/wrapUpReports.js';
import type { SavedMonthlyReport, WrapUpArchive } from '../../src/lib/wrapUpArchive.js';

interface Dependencies {
  authenticate(request: VercelRequest): Promise<string | null>;
  archive(userId: string): Promise<WrapUpArchive>;
  find(userId: string, key: string): Promise<SavedMonthlyReport | null>;
  generate(userId: string, key: string): Promise<SavedMonthlyReport>;
}
const defaults: Dependencies = {
  authenticate: authenticateUserSession,
  archive: userId => loadWrapUpArchive(getSupabaseAdmin(), userId),
  find: (userId, key) => reportRepository(getSupabaseAdmin()).find(userId, key),
  generate: generateMonthlyReport,
};

export function wrapUpHandler(detail: boolean, dependencies: Dependencies = defaults) {
  return async (request: VercelRequest, response: VercelResponse): Promise<void> => {
    response.setHeader('Cache-Control', 'private, no-store');
    if (request.method !== 'GET' && !(detail && request.method === 'POST')) {
      methodNotAllowed(response, detail ? 'GET, POST' : 'GET');
      return;
    }
    try {
      const userId = await dependencies.authenticate(request);
      if (!userId) { json(response, 401, { error: 'A valid signed-in session is required.' }); return; }
      if (!detail) { json(response, 200, await dependencies.archive(userId)); return; }
      const key = request.query.monthKey;
      try {
        if (typeof key !== 'string') throw new Error('Invalid month');
        monthlyPeriod(key);
      } catch { json(response, 400, { error: 'Use a valid month in YYYY-MM format.' }); return; }
      const monthKey = key as string;
      const existing = await dependencies.find(userId, monthKey);
      if (existing) { json(response, 200, existing); return; }
      if (request.method === 'GET') { json(response, 404, { error: 'This report has not been saved.' }); return; }
      const archive = await dependencies.archive(userId);
      if (!archive.months.some(month => month.key === monthKey)) {
        json(response, 404, { error: 'This month is outside your completed reading history.' }); return;
      }
      json(response, 200, await dependencies.generate(userId, monthKey));
    } catch (error) {
      console.error('Wrap-up API failed', error instanceof Error ? error.message : 'unknown error');
      json(response, 500, { error: 'Could not load your wrap-up. Please try again.' });
    }
  };
}
