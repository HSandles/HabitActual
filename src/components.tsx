import { useEffect, type ReactNode } from 'react';
import type { ISODate } from './dates';
import type { Challenge } from './model';
import { useStore } from './store';

export function TaskList({ challenge, date }: { challenge: Challenge; date: ISODate }) {
  const { toggleTask } = useStore();
  const done = challenge.checks[date] ?? [];
  return (
    <ul className="tasks">
      {challenge.tasks.map((t) => {
        const checked = done.includes(t.id);
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

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
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
