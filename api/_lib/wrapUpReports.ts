import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin.js';
import { buildMonthlyReport, localDate, monthlyPeriod, shiftMonth, type ReportBook, type ReportLog, type ReportJournalEntry } from '../../src/lib/wrapUpReports.js';
import type { SavedMonthlyReport } from '../../src/lib/wrapUpArchive.js';
export type { SavedMonthlyReport } from '../../src/lib/wrapUpArchive.js';


interface BookRow extends Omit<ReportBook, 'authors'> {
  book_authors: { position: number; authors: { name: string; user_id: string } | null }[];
  book_genres: { genres: { name: string; user_id: string | null; is_system: boolean } | null }[];
}

// A small repository boundary lets tests exercise retries/races without a production database.
export interface ReportRepository {
  find(userId: string, key: string): Promise<SavedMonthlyReport | null>;
  timezone(userId: string): Promise<string | null>;
  sources(userId: string): Promise<{ books: ReportBook[]; logs: ReportLog[]; journalEntries?: ReportJournalEntry[] }>;
  insert(row: Record<string, unknown>): Promise<SavedMonthlyReport>;
}

export function reportRepository(admin: SupabaseClient): ReportRepository {
  async function all<T>(table: string, fields: string, userId: string): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await admin.from(table).select(fields).eq('user_id', userId).order('id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data as T[]);
      if (data.length < 500) return rows;
    }
  }
  return {
    async find(userId, key) {
      const { data, error } = await admin.from('wrap_up_reports').select('*').eq('user_id', userId).eq('period_type', 'monthly').eq('period_key', key).maybeSingle();
      if (error) throw error;
      return data as SavedMonthlyReport | null;
    },
    async timezone(userId) {
      const { data, error } = await admin.from('profiles').select('timezone').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data?.timezone ?? null;
    },
    async sources(userId) {
      const books = await all<BookRow>('books', 'id,user_id,title,genres,total_pages,cover_url,rating,is_favorite,format,language,date_started,date_finished,book_authors(position,authors(name,user_id)),book_genres(genres(name,user_id,is_system))', userId);
      const logs = await all<ReportLog>('reading_logs', 'id,user_id,book_id,current_page,reading_time_minutes,logged_at', userId);
      const journalEntries = await all<ReportJournalEntry>('book_journal', 'id,user_id,book_id,label,content,attribution,entry_date,is_favorite', userId);
      return { logs, journalEntries, books: books.map(({ book_authors, book_genres, ...book }) => {
        // Service-role joins bypass RLS too: never trust a cross-owner relationship.
        if ((book_authors ?? []).some(link => link.authors && link.authors.user_id !== userId)
          || (book_genres ?? []).some(link => link.genres && !(link.genres.is_system && link.genres.user_id === null) && link.genres.user_id !== userId)) {
          throw new Error('Report metadata ownership mismatch');
        }
        return { ...book, genres: (book_genres ?? []).length ? book_genres.map(link => link.genres?.name).filter((name): name is string => Boolean(name)) : book.genres ?? [],
          authors: [...book_authors ?? []].sort((a,b) => a.position - b.position).flatMap(link => link.authors ? [link.authors.name] : []) };
      }) };
    },
    async insert(row) {
      const { data, error } = await admin.from('wrap_up_reports').insert(row).select('*').single();
      if (error) throw error;
      return data as SavedMonthlyReport;
    },
  };
}

export async function generateMonthlyReport(userId: string, monthKey: string, options: { repository?: ReportRepository; now?: Date } = {}): Promise<SavedMonthlyReport> {
  if (!userId) throw new Error('A user ID is required');
  monthlyPeriod(monthKey); // Validate before any database work.
  const repository = options.repository ?? reportRepository(getSupabaseAdmin());
  const existing = await repository.find(userId, monthKey);
  if (existing) return existing;
  const now = options.now ?? new Date();
  const period = monthlyPeriod(monthKey, await repository.timezone(userId));
  if (now.getTime() < Date.parse(period.endAt)) throw new Error('Only completed months can be generated');
  const { books, logs, journalEntries } = await repository.sources(userId);
  const snapshot = buildMonthlyReport(userId, period, books, logs, journalEntries);
  try {
    return await repository.insert({ user_id: userId, period_type: 'monthly', period_key: monthKey,
      start_date: period.startDate, end_date: period.endDate, start_at: period.startAt, end_at: period.endAt,
      timezone: period.timezone, timezone_fallback: period.timezoneFallback, payload_version: snapshot.version,
      snapshot, is_historical: monthKey < shiftMonth(localDate(now, period.timezone).slice(0,7), -1), source_as_of: now.toISOString() });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      const winner = await repository.find(userId, monthKey);
      if (winner) return winner;
    }
    throw error;
  }
}
