import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ISODate } from './dates';
import { formatAmount, getAmount, isCounter, isTaskDone, type Challenge, type Task } from './model';
import { useStore } from './store';

export function TaskList({ challenge, date }: { challenge: Challenge; date: ISODate }) {
  const { toggleTask } = useStore();
  return (
    <ul className="tasks">
      {challenge.tasks.map((t) => {
        if (isCounter(t)) return <li key={t.id}><CounterTask challenge={challenge} date={date} task={t} /></li>;
        const checked = isTaskDone(challenge, date, t);
        return (
          <li key={t.id}>
            <label className={checked ? 'task done' : 'task'}>
              <input type="checkbox" checked={checked} onChange={() => toggleTask(challenge.id, date, t.id)} />
              <span className="box" aria-hidden />
              <span className="task-title">{t.title}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function CounterTask({ challenge, date, task }: { challenge: Challenge; date: ISODate; task: Task & { target: number } }) {
  const { setAmount } = useStore();
  const [editing, setEditing] = useState(false);
  const amount = getAmount(challenge, date, task.id);
  const done = amount >= task.target;
  const step = task.step && task.step > 0 ? task.step : 1;
  const set = (n: number) => setAmount(challenge.id, date, task.id, n);
  const pct = Math.min(100, (amount / task.target) * 100);

  return (
    <div className={done ? 'task counter done' : 'task counter'} style={{ '--fill': `${pct}%` } as CSSProperties}>
      <button
        className="box"
        onClick={() => set(done ? 0 : task.target)}
        aria-label={done ? `Reset ${task.title}` : `Mark ${task.title} as done`}
      />
      <button className="counter-body" onClick={() => setEditing(true)} aria-label={`Enter amount for ${task.title}`}>
        <span className="task-title">{task.title}</span>
        <span className="counter-value">
          {formatAmount(amount)} / {formatAmount(task.target, task.unit)}
        </span>
      </button>
      <button className="step-btn" onClick={() => set(amount - step)} disabled={amount <= 0} aria-label={`Subtract ${formatAmount(step, task.unit)}`}>−</button>
      <button className="step-btn" onClick={() => set(amount + step)} aria-label={`Add ${formatAmount(step, task.unit)}`}>+</button>
      {editing && <AmountSheet task={task} amount={amount} onSave={set} onClose={() => setEditing(false)} />}
    </div>
  );
}

function AmountSheet({ task, amount, onSave, onClose }: {
  task: Task & { target: number }; amount: number; onSave: (n: number) => void; onClose: () => void;
}) {
  const [value, setValue] = useState(amount ? String(amount) : '');
  const parsed = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0;
  const save = (n: number) => {
    onSave(n);
    onClose();
  };

  return (
    <Sheet title={task.title} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (valid) save(parsed); }}>
        <label className="field">
          <span>Amount{task.unit ? ` (${task.unit})` : ''}, target {formatAmount(task.target, task.unit)}</span>
          <input autoFocus inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
        </label>
        <button type="submit" className="btn block primary" disabled={!valid}>Save</button>
        <button type="button" className="btn block" onClick={() => save(task.target)}>Hit target ({formatAmount(task.target, task.unit)})</button>
      </form>
    </Sheet>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  // Portal to <body> so a sheet opened from inside a task row doesn't inherit its styles.
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Header({ title, back, action }: { title: string; back?: boolean; action?: ReactNode }) {
  return (
    <header className="top">
      {back && (
        <button className="icon-btn back" onClick={() => history.back()} aria-label="Back">‹</button>
      )}
      <h1>{title}</h1>
      <div className="top-action">{action}</div>
    </header>
  );
}
