import { supabase } from './supabase';
import type { SavedMonthlyReport, WrapUpArchive } from './wrapUpArchive';

export class WrapUpRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(path: string, signal: AbortSignal, method = 'GET'): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new WrapUpRequestError('Please sign in again to view your wrap-ups.', 401);
  const response = await fetch(path, {
    method, signal, headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store',
  });
  const payload = await response.json().catch(() => {
    throw new WrapUpRequestError('Could not load your wrap-up. Please try again.', response.status);
  });
  if (!response.ok) throw new WrapUpRequestError(payload.error ?? 'Could not load your wrap-up.', response.status);
  return payload as T;
}
export const fetchWrapUpArchive = (signal: AbortSignal) => request<WrapUpArchive>('/api/wrap-ups', signal);
export async function openWrapUp(key: string, signal: AbortSignal): Promise<SavedMonthlyReport> {
  const path = `/api/wrap-ups/${encodeURIComponent(key)}`;
  try { return await request<SavedMonthlyReport>(path, signal); }
  catch (error) {
    if (!(error instanceof WrapUpRequestError) || error.status !== 404) throw error;
    return request<SavedMonthlyReport>(path, signal, 'POST');
  }
}
