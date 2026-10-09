import { useState } from 'react';
import { addDays, diffDays, formatDate, weekdayMon0, type ISODate } from '../dates';
import { getProgress, hasProgress, isDayComplete, taskLabel, type Challenge, type Progress } from '../model';
import { buildIcs, googleCalendarUrl } from '../calendar';
import { download } from '../storage';
import { navigate } from '../router';
import { Header, Sheet, Stat, TaskList } from '../components';
import { useStore } from '../store';

export function ChallengeDetail({ id }: { id: string }) {
  const { state, today, deleteChallenge } = useStore();
  const [editingDay, setEditingDay] = useState<ISODate | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const c = state.challenges.find((x) => x.id === id);

  if (!c) {
    return (
      <>
        <Header title="Not found" back />
        <main><p className="muted">This challenge no longer exists.</p></main>
      </>
    );
  }

  const p = getProgress(c, today);
  const remove = () => {
    if (confirm(`Delete "${c.name}" and all of its history? This can't be undone.`)) {
      deleteChallenge(c.id);
      navigate('/challenges', { replace: true });
    }
  };

  return (
    <>
      <Header title={c.name} back action={<a className="btn small" href={`#/edit/${c.id}`}>Edit</a>} />
      <main>
        <div className="stats">
          <Stat label={c.durationDays ? `of ${c.durationDays}` : 'day'} value={p.status === 'upcoming' ? '–' : `Day ${p.dayNumber}`} />
          <Stat label="streak" value={`🔥 ${p.currentStreak}`} />
          <Stat label="best streak" value={p.bestStreak} />
          <Stat label="days done" value={p.completedDays} />
        </div>

        <p className="muted small rules">
          {describe(c, p)}
          {c.strict && p.restarts > 0 && ` Restarted ${p.restarts} time${p.restarts === 1 ? '' : 's'}.`}
        </p>

        <section className="card">
          <h3 className="section-title">History</h3>
          <p className="muted small">Tap a day to tick off tasks you forgot.</p>
          <HistoryGrid challenge={c} progress={p} today={today} onPick={setEditingDay} />
          <div className="legend small muted">
            <span><i className="cell complete" /> Done</span>
            <span><i className="cell partial" /> Partial</span>
            <span><i className="cell missed" /> Missed</span>
          </div>
        </section>

        <section className="card">
          <h3 className="section-title">Daily tasks</h3>
          <ol className="plain-list">
            {c.tasks.map((t) => <li key={t.id}>{taskLabel(t)}</li>)}
          </ol>
        </section>

        {p.status !== 'completed' && p.status !== 'ended' && (
          <button className="btn block" onClick={() => setShowReminder(true)}>📅 Add a daily reminder to my calendar</button>
        )}
        <button className="btn block danger" onClick={remove}>Delete challenge</button>
      </main>

      {editingDay && (
        <Sheet title={formatDate(editingDay, { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setEditingDay(null)}>
          <TaskList challenge={c} date={editingDay} />
        </Sheet>
      )}
      {showReminder && <ReminderSheet challenge={c} progress={p} onClose={() => setShowReminder(false)} />}
    </>
  );
}

function describe(c: Challenge, p: Progress): string {
  const span = p.endDate
    ? `${formatDate(p.attemptStart, { day: 'numeric', month: 'short' })} – ${formatDate(p.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `Ongoing since ${formatDate(c.startDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${span}. ${c.strict ? 'Strict mode: missing a day restarts at day 1.' : 'Missing a day breaks your streak.'}`;
}

function HistoryGrid({ challenge: c, progress: p, today, onPick }: {
  challenge: Challenge; progress: Progress; today: ISODate; onPick: (d: ISODate) => void;
}) {
  // Show the whole challenge including days still to come, or the last ~6 months of an ongoing one.
  const to = p.endDate ?? today;
  let from = c.startDate;
  if (diffDays(from, to) > 182) from = addDays(to, -182);
  from = addDays(from, -weekdayMon0(from));

  const days: ISODate[] = [];
  for (let d = from; diffDays(d, to) >= 0 || weekdayMon0(d) !== 0; d = addDays(d, 1)) days.push(d);

  return (
    <div className="grid-wrap">
      <div className="history-grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => <span key={i} className="grid-label">{l}</span>)}
        {days.map((d) => {
          const inRange = diffDays(c.startDate, d) >= 0 && diffDays(d, to) >= 0;
          const future = diffDays(today, d) > 0;
          if (!inRange) return <span key={d} className="cell blank" />;
          const state = future ? 'future'
            : isDayComplete(c, d) ? 'complete'
            : hasProgress(c, d) ? 'partial'
            : d === today ? 'pending' : 'missed';
          return (
            <button
              key={d}
              className={`cell ${state} ${d === today ? 'today' : ''}`}
              disabled={future}
              onClick={() => onPick(d)}
              aria-label={`${formatDate(d)}: ${state}`}
            >
              {Number(d.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReminderSheet({ challenge: c, progress: p, onClose }: { challenge: Challenge; progress: Progress; onClose: () => void }) {
  const { today } = useStore();
  const [time, setTime] = useState('20:00');
  const from = diffDays(today, c.startDate) > 0 ? c.startDate : today;
  // The calendar can't know about strict-mode restarts, so give ongoing reminders for strict challenges.
  const until = c.strict ? null : p.endDate;

  const saveIcs = () => download(`habitactual-${c.name.replace(/\W+/g, '-').toLowerCase()}.ics`, buildIcs(c, from, until, time), 'text/calendar');

  return (
    <Sheet title="Daily reminder" onClose={onClose}>
      <p className="muted small">
        Adds a repeating event to your phone's calendar, so you get a nudge even when the app is closed.
        {c.strict && ' Strict challenges can restart, so this reminder has no end date. Delete it from your calendar when you finish.'}
      </p>
      <label className="field">
        <span>Remind me at</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value || '20:00')} />
      </label>
      <button className="btn block primary" onClick={saveIcs}>iPhone / Apple Calendar / Outlook (.ics)</button>
      <a className="btn block" href={googleCalendarUrl(c, from, until, time)} target="_blank" rel="noreferrer">Google Calendar</a>
      <p className="muted small">
        iPhone: tap “Add All” when the calendar file opens. Android: Google Calendar works best.
      </p>
    </Sheet>
  );
}
