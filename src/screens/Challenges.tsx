import { formatDate } from '../dates';
import { getProgress, type Status } from '../model';
import { Header, ProgressBar } from '../components';
import { useStore } from '../store';

const GROUPS: { status: Status; title: string }[] = [
  { status: 'active', title: 'Active' },
  { status: 'upcoming', title: 'Upcoming' },
  { status: 'completed', title: 'Completed' },
  { status: 'ended', title: 'Ended' },
];

export function Challenges() {
  const { state, today } = useStore();
  const all = state.challenges.map((c) => ({ c, p: getProgress(c, today) }));

  return (
    <>
      <Header title="Challenges" action={<a className="btn small primary" href="#/new">+ New</a>} />
      <main>
        {all.length === 0 && (
          <div className="empty">
            <p className="empty-title">No challenges yet</p>
            <a className="btn primary" href="#/new">Start a challenge</a>
          </div>
        )}
        {GROUPS.map(({ status, title }) => {
          const items = all.filter(({ p }) => p.status === status);
          if (!items.length) return null;
          return (
            <section key={status}>
              <h3 className="group-title">{title}</h3>
              {items.map(({ c, p }) => (
                <a key={c.id} className="card card-link" href={`#/c/${c.id}`}>
                  <div className="card-head">
                    <h2>{c.name}</h2>
                    {status === 'active' && <span className="streak">🔥 {p.currentStreak}</span>}
                  </div>
                  <p className="muted small">
                    {status === 'upcoming'
                      ? `Starts ${formatDate(c.startDate)}`
                      : status === 'active'
                        ? `Day ${p.dayNumber}${c.durationDays ? ` of ${c.durationDays}` : ''} · ${c.tasks.length} daily tasks${c.strict ? ' · Strict' : ''}`
                        : `${p.completedDays} of ${c.durationDays} days · finished ${formatDate(p.finishedOn!)}`}
                  </p>
                  {status === 'active' && c.durationDays && (
                    <ProgressBar value={p.completedDays} max={c.durationDays} label="Days completed" />
                  )}
                </a>
              ))}
            </section>
          );
        })}
      </main>
    </>
  );
}
