import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { todayISO, type ISODate } from './dates';
import type { AppState, Challenge } from './model';
import { loadState, requestPersistence, saveState } from './storage';
import { deleteChallengePhotos } from './photos';

interface Store {
  state: AppState;
  today: ISODate;
  update: (fn: (s: AppState) => AppState) => void;
  saveChallenge: (ch: Challenge) => void;
  deleteChallenge: (id: string) => void;
  toggleTask: (challengeId: string, date: ISODate, taskId: string) => void;
  setChecked: (challengeId: string, date: ISODate, taskId: string, checked: boolean) => void;
  setAmount: (challengeId: string, date: ISODate, taskId: string, amount: number) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [today, setToday] = useState(todayISO());
  const loaded = useRef(false);

  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (state && loaded.current) saveState(state);
  }, [state]);

  // Keep "today" right if the app is left open past midnight or resumed the next day.
  useEffect(() => {
    const tick = () => setToday(todayISO());
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => (s ? fn(s) : s)), []);

  const saveChallenge = useCallback((ch: Challenge) => {
    update((s) => {
      const exists = s.challenges.some((c) => c.id === ch.id);
      return { ...s, challenges: exists ? s.challenges.map((c) => (c.id === ch.id ? ch : c)) : [...s.challenges, ch] };
    });
    requestPersistence();
  }, [update]);

  const deleteChallenge = useCallback((id: string) => {
    update((s) => ({ ...s, challenges: s.challenges.filter((c) => c.id !== id) }));
    deleteChallengePhotos(id);
  }, [update]);

  const setChecked = useCallback((challengeId: string, date: ISODate, taskId: string, checked: boolean | 'toggle') => {
    update((s) => ({
      ...s,
      challenges: s.challenges.map((c) => {
        if (c.id !== challengeId) return c;
        const done = c.checks[date] ?? [];
        const on = checked === 'toggle' ? !done.includes(taskId) : checked;
        const next = on ? [...new Set([...done, taskId])] : done.filter((t) => t !== taskId);
        const checks = { ...c.checks };
        if (next.length) checks[date] = next;
        else delete checks[date];
        return { ...c, checks };
      }),
    }));
  }, [update]);

  const toggleTask = useCallback(
    (challengeId: string, date: ISODate, taskId: string) => setChecked(challengeId, date, taskId, 'toggle'),
    [setChecked],
  );

  const setAmount = useCallback((challengeId: string, date: ISODate, taskId: string, amount: number) => {
    // Round away floating-point drift from repeated 0.25 steps.
    const value = Math.max(0, Math.round(amount * 1000) / 1000);
    update((s) => ({
      ...s,
      challenges: s.challenges.map((c) => {
        if (c.id !== challengeId) return c;
        const day = { ...c.amounts?.[date] };
        if (value) day[taskId] = value;
        else delete day[taskId];
        const amounts = { ...c.amounts };
        if (Object.keys(day).length) amounts[date] = day;
        else delete amounts[date];
        return { ...c, amounts };
      }),
    }));
  }, [update]);

  if (!state) return null;
  return (
    <StoreContext.Provider value={{ state, today, update, saveChallenge, deleteChallenge, toggleTask, setChecked, setAmount }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
