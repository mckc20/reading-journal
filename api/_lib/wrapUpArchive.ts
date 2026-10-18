import type { SupabaseClient } from '@supabase/supabase-js';
import { buildWrapUpArchive, type HistoryBook, type ReportSummary, type WrapUpArchive } from '../../src/lib/wrapUpArchive.js';
import { reportRepository } from './wrapUpReports.js';

/** Page every source query so a large library never silently truncates history. */
export async function loadWrapUpArchive(admin: SupabaseClient, userId: string, now = new Date()): Promise<WrapUpArchive> {
  async function all<T>(table: string, fields: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = admin.from(table).select(fields).eq('user_id', userId);
      if (table === 'wrap_up_reports') query = query.eq('period_type', 'monthly');
      const { data, error } = await query.order('id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data as T[]);
      if (data.length < 500) return rows;
    }
  }
  const [books, logs, reports, timezone, journalEntries] = await Promise.all([
    all<HistoryBook>('books', 'id,date_started,date_finished,created_at'),
    all<{ logged_at: string }>('reading_logs', 'id,logged_at'),
    all<ReportSummary>('wrap_up_reports', 'id,period_key,booksFinished:snapshot->totals->booksFinished'),
    reportRepository(admin).timezone(userId),
    all<{ entry_date: string }>('book_journal', 'id,entry_date'),
  ]);
  return buildWrapUpArchive(books, logs, reports, timezone, now, journalEntries);
}
