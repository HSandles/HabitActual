import { formatDate } from '../dates';
import { doneCount, getProgress, type Challenge, type Progress } from '../model';
import { Header, ProgressBar, TaskList } from '../components';
import { useStore } from '../store';

export function Today() {
  const { state, today } = useStore();
  const items = state.challenges
    .map((c) => ({ c, p: getProgress(c, today) }))
    .filter(({ p }) => p.status === 'active' || p.status === 'upcoming' || p.finishedOn === today)
    .sort((a, b) => order(a.p) - order(b.p));

  return (
    <>
      <Header title="Today" action={<span className="muted">{formatDate(today)}</span>} />
      <main>
        {items.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Nothing to track yet</p>
            <p className="muted">Start 75 Hard, or set up a challenge of your own.</p>
            <a className="btn primary" href="#/new">Start a challenge</a>
          </div>
        ) : (
          items.map(({ c, p }) => <TodayCard key={c.id} challenge={c} progress={p} />)
        )}
      </main>
    </>
  );
}

const order = (p: Progress) => (p.status === 'upcoming' ? 2 : p.todayDone ? 1 : 0);

function TodayCard({ challenge: c, progress: p }: { challenge: Challenge; progress: Progress }) {
  const { today } = useStore();

  if (p.status === 'upcoming') {
    return (
      <a className="card card-link" href={`#/c/${c.id}`}>
        <div className="card-head">
          <h2>{c.name}</h2>
        </div>
        <p className="muted">
          Starts {p.startsInDays === 1 ? 'tomorrow' : `in ${p.startsInDays} days`} · {formatDate(c.startDate)}
        </p>
      </a>
    );
  }

  if (p.status !== 'active') {
    const won = p.status === 'completed';
    return (
      <a className={`card card-link ${won ? 'celebrate' : ''}`} href={`#/c/${c.id}`}>
        <h2>{won ? `🎉 ${c.name} complete!` : `${c.name} has ended`}</h2>
        <p className="muted">
          {won ? `All ${c.durationDays} days done.` : `${p.completedDays} of ${c.durationDays} days completed.`}
        </p>
      </a>
    );
  }

  const done = doneCount(c, today);
  const restarted = c.strict && p.restarts > 0 && p.dayNumber === 1;
  return (
    <section className={`card ${p.todayDone ? 'card-done' : ''}`}>
      <a className="card-head" href={`#/c/${c.id}`}>
        <div>
          <h2>{c.name}</h2>
          <p className="muted small">
            Day {p.dayNumber}{c.durationDays ? ` of ${c.durationDays}` : ''} · {done}/{c.tasks.length} done today
          </p>
        </div>
        <span className="streak" title="Current streak">🔥 {p.currentStreak}</span>
      </a>
      {c.durationDays && <ProgressBar value={p.dayNumber - (p.todayDone ? 0 : 1)} max={c.durationDays} label="Challenge progress" />}
      {restarted && (
        <p className="notice">
          You missed a day, so you're back to day 1. If you forgot to tick something off,{' '}
          <a href={`#/c/${c.id}`}>fix it in the history</a>.
        </p>
      )}
      <TaskList challenge={c} date={today} />
      {p.todayDone && <p className="done-msg">All done for today 💪</p>}
    </section>
  );
}
