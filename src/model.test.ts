import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from './dates';
import { doneCount, getProgress, hasProgress, isDayComplete, type Challenge } from './model';

const START = '2026-03-01';

function challenge(opts: Partial<Challenge> & { completeDays?: number[] } = {}): Challenge {
  const tasks = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];
  const checks: Challenge['checks'] = {};
  for (const n of opts.completeDays ?? []) checks[addDays(START, n)] = ['a', 'b'];
  return {
    id: 'c', name: 'Test', tasks, startDate: START, durationDays: 5, strict: false,
    checks, createdAt: '', ...opts,
  };
}

const day = (n: number) => addDays(START, n);

describe('dates', () => {
  it('crosses month ends and DST changes', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31);
  });
});

describe('getProgress', () => {
  it('reports upcoming challenges', () => {
    const p = getProgress(challenge(), day(-3));
    expect(p.status).toBe('upcoming');
    expect(p.startsInDays).toBe(3);
  });

  it('counts the day number and streak', () => {
    const p = getProgress(challenge({ completeDays: [0, 1, 2] }), day(3));
    expect(p.dayNumber).toBe(4);
    expect(p.currentStreak).toBe(3); // today not done yet, so the streak isn't broken
    expect(p.todayDone).toBe(false);
  });

  it('partial days do not count as complete', () => {
    const ch = challenge({ completeDays: [0] });
    ch.checks[day(1)] = ['a'];
    const p = getProgress(ch, day(2));
    expect(p.completedDays).toBe(1);
    expect(p.currentStreak).toBe(0);
  });

  it('non-strict: a miss breaks the streak but keeps the day count', () => {
    const p = getProgress(challenge({ completeDays: [0, 1, 3] }), day(4));
    expect(p.dayNumber).toBe(5);
    expect(p.currentStreak).toBe(1);
    expect(p.bestStreak).toBe(2);
    expect(p.restarts).toBe(0);
  });

  it('non-strict: ends after the duration', () => {
    const ended = getProgress(challenge({ completeDays: [0, 1, 3] }), day(10));
    expect(ended.status).toBe('ended');
    expect(ended.completedDays).toBe(3);
    const done = getProgress(challenge({ completeDays: [0, 1, 2, 3, 4] }), day(10));
    expect(done.status).toBe('completed');
  });

  it('completes on the last day once today is done', () => {
    const p = getProgress(challenge({ completeDays: [0, 1, 2, 3, 4] }), day(4));
    expect(p.status).toBe('completed');
    expect(p.dayNumber).toBe(5);
  });

  it('strict: a missed day restarts at day 1', () => {
    const p = getProgress(challenge({ strict: true, completeDays: [0, 1, 3] }), day(4));
    expect(p.attemptStart).toBe(day(3));
    expect(p.dayNumber).toBe(2);
    expect(p.restarts).toBe(1);
    expect(p.status).toBe('active');
  });

  it('strict: missing yesterday makes today day 1', () => {
    const p = getProgress(challenge({ strict: true, completeDays: [0, 1] }), day(3));
    expect(p.attemptStart).toBe(day(3));
    expect(p.dayNumber).toBe(1);
  });

  it('strict: several missed days in a row count as one restart', () => {
    const p = getProgress(challenge({ strict: true, completeDays: [0, 4, 5] }), day(6));
    expect(p.restarts).toBe(1);
    expect(p.attemptStart).toBe(day(4));
  });

  it('strict: ticking a forgotten day undoes the restart', () => {
    const ch = challenge({ strict: true, completeDays: [0, 1, 3] });
    ch.checks[day(2)] = ['a', 'b'];
    const p = getProgress(ch, day(4));
    expect(p.attemptStart).toBe(START);
    expect(p.restarts).toBe(0);
  });

  it('strict: completes after a full clean run, even following a restart', () => {
    const p = getProgress(challenge({ strict: true, completeDays: [0, 2, 3, 4, 5, 6] }), day(12));
    expect(p.status).toBe('completed');
    expect(p.attemptStart).toBe(day(2));
    expect(p.restarts).toBe(1);
    expect(p.dayNumber).toBe(5);
  });

  it('ongoing challenges never end', () => {
    const p = getProgress(challenge({ durationDays: null, completeDays: [0, 1, 2] }), day(400));
    expect(p.status).toBe('active');
    expect(p.dayNumber).toBe(401);
    expect(p.endDate).toBeNull();
  });
});

describe('counter tasks', () => {
  const water = { id: 'w', title: 'Water', target: 3.8, unit: 'L', step: 0.25 };
  const ch = (amount: number | undefined, ticked: string[] = ['a']): Challenge => ({
    ...challenge(),
    tasks: [{ id: 'a', title: 'A' }, water],
    checks: { [START]: ticked },
    amounts: amount === undefined ? {} : { [START]: { w: amount } },
  });

  it('is done once the amount reaches the target', () => {
    expect(isDayComplete(ch(3.8), START)).toBe(true);
    expect(isDayComplete(ch(5), START)).toBe(true);
    expect(isDayComplete(ch(3.75), START)).toBe(false);
    expect(doneCount(ch(3.75), START)).toBe(1);
  });

  it('ignores a stray tick on a counter task', () => {
    expect(isDayComplete(ch(undefined, ['a', 'w']), START)).toBe(false);
  });

  it('counts a part-filled counter as progress for the day', () => {
    expect(hasProgress(ch(1, []), START)).toBe(true);
    expect(hasProgress(ch(undefined, []), START)).toBe(false);
  });

  it('works for challenges saved before counters existed', () => {
    const old = challenge({ completeDays: [0] });
    delete old.amounts;
    expect(isDayComplete(old, START)).toBe(true);
  });
});
