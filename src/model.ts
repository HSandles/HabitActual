import { addDays, diffDays, type ISODate } from './dates';

export interface Task {
  id: string;
  title: string;
}

export interface Challenge {
  id: string;
  name: string;
  tasks: Task[];
  startDate: ISODate;
  /** null = ongoing habit with no end date */
  durationDays: number | null;
  /** Missing a day restarts the challenge at day 1 (75 Hard rules). */
  strict: boolean;
  /** Task ids ticked off on each date. */
  checks: Record<ISODate, string[]>;
  createdAt: string;
}

export interface AppState {
  version: 1;
  challenges: Challenge[];
}

export const emptyState = (): AppState => ({ version: 1, challenges: [] });

export function newId(): string {
  // randomUUID only exists in secure contexts; a phone testing the dev server over LAN is not one.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export interface Template {
  key: string;
  name: string;
  description: string;
  durationDays: number | null;
  tasks: string[];
}

export const TEMPLATES: Template[] = [
  {
    key: '75hard',
    name: '75 Hard',
    description: '75 days of non-negotiable daily tasks.',
    durationDays: 75,
    tasks: [
      'Follow a diet, no cheat meals',
      'No alcohol',
      'Workout 1 (45 min)',
      'Workout 2 (45 min, outdoors)',
      'Drink 1 gallon (3.8 L) of water',
      'Read 10 pages of non-fiction',
      'Take a progress photo',
    ],
  },
  {
    key: '75soft',
    name: '75 Soft',
    description: 'A gentler 75 days.',
    durationDays: 75,
    tasks: [
      'Eat well, only drink socially',
      'Workout 45 min (one active recovery day a week)',
      'Drink 3 L of water',
      'Read 10 pages',
    ],
  },
  {
    key: 'custom',
    name: 'Custom',
    description: 'Your own goal, tasks and length.',
    durationDays: 30,
    tasks: [],
  },
];

export function isDayComplete(ch: Challenge, date: ISODate): boolean {
  if (ch.tasks.length === 0) return false;
  const done = ch.checks[date];
  return !!done && ch.tasks.every((t) => done.includes(t.id));
}

export function doneCount(ch: Challenge, date: ISODate): number {
  const done = ch.checks[date] ?? [];
  return ch.tasks.filter((t) => done.includes(t.id)).length;
}

export type Status = 'upcoming' | 'active' | 'completed' | 'ended';

export interface Progress {
  status: Status;
  /** Start of the current attempt; later than startDate after a strict-mode restart. */
  attemptStart: ISODate;
  /** 1-based day of the current attempt, capped at the duration. */
  dayNumber: number;
  /** Last day of the current attempt, or null for ongoing challenges. */
  endDate: ISODate | null;
  restarts: number;
  currentStreak: number;
  bestStreak: number;
  completedDays: number;
  todayDone: boolean;
  startsInDays: number;
  /** Date the challenge was completed or ran out, if it has. */
  finishedOn: ISODate | null;
}

/**
 * Everything shown about a challenge is derived from its start date and check history,
 * so ticking off a forgotten past day automatically undoes a strict-mode restart.
 */
export function getProgress(ch: Challenge, today: ISODate): Progress {
  const todayDone = isDayComplete(ch, today);

  if (diffDays(today, ch.startDate) > 0) {
    return {
      status: 'upcoming', attemptStart: ch.startDate, dayNumber: 0,
      endDate: ch.durationDays ? addDays(ch.startDate, ch.durationDays - 1) : null,
      restarts: 0, currentStreak: 0, bestStreak: 0, completedDays: 0, todayDone,
      startsInDays: diffDays(today, ch.startDate), finishedOn: null,
    };
  }

  const dur = ch.durationDays;
  let attemptStart = ch.startDate;
  let restarts = 0;
  let completedOn: ISODate | null = null;

  // Strict mode: any missed day before today restarts at the following day.
  if (ch.strict) {
    for (let d = ch.startDate; diffDays(d, today) >= 0; d = addDays(d, 1)) {
      const complete = isDayComplete(ch, d);
      if (!complete && d !== today) {
        attemptStart = addDays(d, 1);
        continue;
      }
      if (complete && dur && diffDays(attemptStart, d) + 1 === dur) {
        completedOn = d;
        break;
      }
    }
    // A run of misses counts as one restart, not one per missed day.
    restarts = countRuns(ch, ch.startDate, completedOn ?? addDays(today, -1));
  }

  const endDate = dur ? addDays(attemptStart, dur - 1) : null;
  const lastCounted = completedOn ?? (endDate && diffDays(endDate, today) > 0 ? endDate : today);

  let completedDays = 0;
  let bestStreak = 0;
  let run = 0;
  for (let d = attemptStart; diffDays(d, lastCounted) >= 0; d = addDays(d, 1)) {
    if (isDayComplete(ch, d)) {
      completedDays++;
      run++;
      bestStreak = Math.max(bestStreak, run);
    } else {
      run = 0;
    }
  }

  // Current streak runs back from today, or from yesterday if today isn't finished yet.
  let currentStreak = 0;
  let d = isDayComplete(ch, lastCounted) ? lastCounted : addDays(lastCounted, -1);
  while (diffDays(attemptStart, d) >= 0 && isDayComplete(ch, d)) {
    currentStreak++;
    d = addDays(d, -1);
  }

  let status: Status = 'active';
  if (completedOn) status = 'completed';
  else if (endDate && diffDays(endDate, today) > 0) status = completedDays === dur ? 'completed' : 'ended';
  else if (endDate && endDate === today && todayDone && completedDays === dur) status = 'completed';

  const rawDay = diffDays(attemptStart, completedOn ?? today) + 1;
  return {
    status, attemptStart, endDate, restarts, currentStreak, bestStreak, completedDays, todayDone,
    dayNumber: dur ? Math.min(rawDay, dur) : rawDay,
    startsInDays: 0,
    finishedOn: status === 'active' ? null : completedOn ?? endDate,
  };
}

/** Number of separate runs of incomplete days between two dates (inclusive). */
function countRuns(ch: Challenge, from: ISODate, to: ISODate): number {
  let runs = 0;
  let inRun = false;
  for (let d = from; diffDays(d, to) >= 0; d = addDays(d, 1)) {
    const missed = !isDayComplete(ch, d);
    if (missed && !inRun) runs++;
    inRun = missed;
  }
  return runs;
}
