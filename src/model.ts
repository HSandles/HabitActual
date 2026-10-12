import { addDays, diffDays, type ISODate } from './dates';

export interface Task {
  id: string;
  title: string;
  /** Set for counter tasks (e.g. 3.8 L of water); the task is done once the amount reaches it. */
  target?: number;
  unit?: string;
  /** Amount added per tap of +. */
  step?: number;
  /** Done by taking a photo, which is stored on the device only (see photos.ts). */
  photo?: boolean;
  /** Done by logging a value for the day (e.g. a weigh-in); there is no target, the trend is the point. */
  measure?: boolean;
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
  /** Amounts logged for counter tasks, by date then task id. */
  amounts?: Record<ISODate, Record<string, number>>;
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
  tasks: (string | Omit<Task, 'id'>)[];
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
      { title: 'Drink 1 gallon of water', target: 3.8, unit: 'L', step: 0.25 },
      'Read 10 pages of non-fiction',
      { title: 'Take a progress photo', photo: true },
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
      { title: 'Drink water', target: 3, unit: 'L', step: 0.25 },
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

export const isCounter = (t: Task): t is Task & { target: number } => typeof t.target === 'number' && t.target > 0;

export const isMeasure = (t: Task) => !!t.measure && !isCounter(t);

export const isPhoto = (t: Task) => !!t.photo && !isCounter(t) && !isMeasure(t);

export function getAmount(ch: Challenge, date: ISODate, taskId: string): number {
  return ch.amounts?.[date]?.[taskId] ?? 0;
}

export function isTaskDone(ch: Challenge, date: ISODate, t: Task): boolean {
  if (isCounter(t)) return getAmount(ch, date, t.id) >= t.target;
  const ticked = (ch.checks[date] ?? []).includes(t.id);
  // A tick still counts for a measure task, so days ticked before it was switched from a tick-box stay complete.
  return isMeasure(t) ? ticked || getAmount(ch, date, t.id) > 0 : ticked;
}

export interface Measurement {
  date: ISODate;
  value: number;
}

/** Values logged for a measure task since the challenge started, oldest first. */
export function getMeasurements(ch: Challenge, taskId: string): Measurement[] {
  return Object.entries(ch.amounts ?? {})
    .filter(([date, day]) => day[taskId] > 0 && diffDays(ch.startDate, date) >= 0)
    .map(([date, day]) => ({ date, value: day[taskId] }))
    .sort((a, b) => diffDays(b.date, a.date));
}

export interface MeasureSummary {
  first: Measurement;
  latest: Measurement;
  change: number;
  /** Change as a percentage of the first value. */
  changePct: number;
  lowest: number;
  highest: number;
}

export function summariseMeasurements(points: Measurement[]): MeasureSummary | null {
  if (!points.length) return null;
  const first = points[0];
  const latest = points[points.length - 1];
  const values = points.map((p) => p.value);
  // Rounded so 81.9 - 84.2 reads as -2.3 rather than -2.3000000000000114.
  const change = Math.round((latest.value - first.value) * 1000) / 1000;
  return {
    first, latest, change,
    changePct: (change / first.value) * 100,
    lowest: Math.min(...values),
    highest: Math.max(...values),
  };
}

/** "-2.3 kg", "+0.5 kg", "0 kg": a change always shows its direction. */
export function formatChange(n: number, unit?: string, minDecimals = 0): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return sign + formatAmount(Math.abs(n), unit, minDecimals);
}

/** Decimal places (up to 2) needed to show every value the same way, so 83 sits beside 82.9 as 83.0. */
export function sharedDecimals(values: number[]): number {
  return Math.max(0, ...values.map((v) => (String(Math.round(v * 100) / 100).split('.')[1] ?? '').length));
}

export function isDayComplete(ch: Challenge, date: ISODate): boolean {
  return ch.tasks.length > 0 && ch.tasks.every((t) => isTaskDone(ch, date, t));
}

export function doneCount(ch: Challenge, date: ISODate): number {
  return ch.tasks.filter((t) => isTaskDone(ch, date, t)).length;
}

/** True if anything at all was logged that day, including part of a counter. */
export function hasProgress(ch: Challenge, date: ISODate): boolean {
  return doneCount(ch, date) > 0 || ch.tasks.some((t) => isCounter(t) && getAmount(ch, date, t.id) > 0);
}

/** "3.8 L", "10,000 steps" */
export function formatAmount(n: number, unit?: string, minDecimals = 0): string {
  const num = n.toLocaleString(undefined, { minimumFractionDigits: minDecimals, maximumFractionDigits: Math.max(2, minDecimals) });
  return unit ? `${num} ${unit}` : num;
}

/** Task title plus its target, for lists outside the checklist. */
export function taskLabel(t: Task): string {
  return isCounter(t) ? `${t.title} (${formatAmount(t.target, t.unit)})` : t.title;
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
