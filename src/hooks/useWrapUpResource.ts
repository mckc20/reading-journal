import { useEffect, useState } from 'react';
import { useAuth } from '@/context';

/** Abort navigation races and never display the previous account's response. */
export function useWrapUpResource<T>(resourceKey: string, load: (signal: AbortSignal) => Promise<T>) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const identity = `${user?.id ?? ''}:${resourceKey}:${attempt}`;
  const [state, setState] = useState<{ identity: string; data?: T; error?: string }>({ identity: '' });
  useEffect(() => {
    const controller = new AbortController();
    if (user) {
      load(controller.signal).then(data => {
        if (!controller.signal.aborted) setState({ identity, data });
      }).catch(error => {
        if (!controller.signal.aborted) setState({ identity, error: error instanceof Error ? error.message : 'Could not load your wrap-up.' });
      });
    }
    return () => controller.abort();
  }, [identity, load, user]);
  const current = state.identity === identity ? state : undefined;
  return { data: current?.data, error: current?.error, loading: !current, retry: () => setAttempt(value => value + 1) };
}
