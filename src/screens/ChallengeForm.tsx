import { useState, type FormEvent } from 'react';
import { newId, TEMPLATES, type Challenge, type Task, type Template } from '../model';
import { navigate } from '../router';
import { Header } from '../components';
import { useStore } from '../store';

export function ChallengeForm({ id }: { id?: string }) {
  const { state, today, saveChallenge } = useStore();
  const existing = id ? state.challenges.find((c) => c.id === id) : undefined;

  const [template, setTemplate] = useState<string>(existing ? '' : TEMPLATES[0].key);
  const [name, setName] = useState(existing?.name ?? TEMPLATES[0].name);
  const [tasks, setTasks] = useState<Task[]>(existing?.tasks ?? toTasks(TEMPLATES[0]));
  const [ongoing, setOngoing] = useState(existing ? existing.durationDays === null : false);
  const [duration, setDuration] = useState(String(existing?.durationDays ?? TEMPLATES[0].durationDays ?? 30));
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [strict, setStrict] = useState(existing?.strict ?? false);
  const [error, setError] = useState('');

  if (id && !existing) {
    return (
      <>
        <Header title="Not found" back />
        <main><p className="muted">This challenge no longer exists.</p></main>
      </>
    );
  }

  const pickTemplate = (t: Template) => {
    setTemplate(t.key);
    setName(t.key === 'custom' ? '' : t.name);
    setTasks(t.tasks.length ? toTasks(t) : [{ id: newId(), title: '' }]);
    setOngoing(t.durationDays === null);
    setDuration(String(t.durationDays ?? 30));
  };

  const setTaskTitle = (taskId: string, title: string) =>
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, title } : t)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cleanTasks = tasks.map((t) => ({ ...t, title: t.title.trim() })).filter((t) => t.title);
    const days = Number(duration);
    if (!name.trim()) return setError('Give your challenge a name.');
    if (!cleanTasks.length) return setError('Add at least one daily task.');
    if (!ongoing && (!Number.isInteger(days) || days < 1 || days > 3650)) return setError('Length must be between 1 and 3650 days.');
    if (!startDate) return setError('Pick a start date.');

    const challenge: Challenge = {
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      checks: existing?.checks ?? {},
      name: name.trim(),
      tasks: cleanTasks,
      durationDays: ongoing ? null : days,
      startDate,
      strict,
    };
    saveChallenge(challenge);
    if (existing) history.back();
    else navigate('/', { replace: true });
  };

  return (
    <>
      <Header title={existing ? 'Edit challenge' : 'New challenge'} back />
      <main>
        <form onSubmit={submit} className="form">
          {!existing && (
            <div className="templates" role="radiogroup" aria-label="Template">
              {TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.key}
                  role="radio"
                  aria-checked={template === t.key}
                  className={`template ${template === t.key ? 'selected' : ''}`}
                  onClick={() => pickTemplate(t)}
                >
                  <strong>{t.name}</strong>
                  <span className="muted small">{t.description}</span>
                </button>
              ))}
            </div>
          )}

          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning routine" maxLength={60} />
          </label>

          <fieldset className="field">
            <legend>Daily tasks</legend>
            {tasks.map((t, i) => (
              <div key={t.id} className="task-edit">
                <input
                  value={t.title}
                  onChange={(e) => setTaskTitle(t.id, e.target.value)}
                  placeholder={`Task ${i + 1}`}
                  aria-label={`Task ${i + 1}`}
                  maxLength={80}
                />
                <button type="button" className="icon-btn" aria-label={`Remove task ${i + 1}`}
                  onClick={() => setTasks((ts) => ts.filter((x) => x.id !== t.id))}>✕</button>
              </div>
            ))}
            <button type="button" className="btn small" onClick={() => setTasks((ts) => [...ts, { id: newId(), title: '' }])}>
              + Add task
            </button>
          </fieldset>

          <div className="row">
            <label className="field grow">
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="field grow">
              <span>Length (days)</span>
              <input type="number" inputMode="numeric" min={1} max={3650} value={ongoing ? '' : duration}
                disabled={ongoing} placeholder="∞" onChange={(e) => setDuration(e.target.value)} />
            </label>
          </div>

          <label className="toggle">
            <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
            <span>
              <strong>Ongoing</strong>
              <span className="muted small">No end date. Just keep the habit going.</span>
            </span>
          </label>

          <label className="toggle">
            <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
            <span>
              <strong>Strict mode</strong>
              <span className="muted small">
                Missing any task on any day sends you back to day 1, as in the official 75 Hard rules.
                Off: a missed day only breaks your streak.
              </span>
            </span>
          </label>

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn block primary">{existing ? 'Save changes' : 'Start challenge'}</button>
        </form>
      </main>
    </>
  );
}

const toTasks = (t: Template): Task[] => t.tasks.map((title) => ({ id: newId(), title }));
