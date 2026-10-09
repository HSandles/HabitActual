import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { diffDays, formatDate, type ISODate } from './dates';
import { formatAmount, getAmount, isCounter, isPhoto, isTaskDone, type Challenge, type Task } from './model';
import { deletePhoto, parsePhotoKey, photoKey, savePhoto, usePhotoKeys, usePhotoUrl } from './photos';
import { requestPersistence } from './storage';
import { useStore } from './store';

export function TaskList({ challenge, date }: { challenge: Challenge; date: ISODate }) {
  const { toggleTask } = useStore();
  return (
    <ul className="tasks">
      {challenge.tasks.map((t) => {
        if (isCounter(t)) return <li key={t.id}><CounterTask challenge={challenge} date={date} task={t} /></li>;
        if (isPhoto(t)) return <li key={t.id}><PhotoTask challenge={challenge} date={date} task={t} /></li>;
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

function PhotoTask({ challenge, date, task }: { challenge: Challenge; date: ISODate; task: Task }) {
  const [open, setOpen] = useState(false);
  const key = photoKey(challenge.id, date, task.id);
  const thumb = usePhotoUrl(key, 'thumb');
  const done = isTaskDone(challenge, date, task);

  return (
    <>
      <button className={done ? 'task photo-task done' : 'task photo-task'} onClick={() => setOpen(true)}>
        <span className="box" aria-hidden />
        <span className="task-title">{task.title}</span>
        {thumb ? <img className="thumb" src={thumb} alt="" /> : <span className="photo-cta" aria-hidden>📷</span>}
      </button>
      {open && <PhotoSheet challenge={challenge} date={date} task={task} onClose={() => setOpen(false)} />}
    </>
  );
}

function PhotoSheet({ challenge, date, task, onClose }: { challenge: Challenge; date: ISODate; task: Task; onClose: () => void }) {
  const { setChecked } = useStore();
  const key = photoKey(challenge.id, date, task.id);
  const url = usePhotoUrl(key, 'full');
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await savePhoto(key, file);
      setChecked(challenge.id, date, task.id, true);
      requestPersistence();
    } catch {
      setError("That photo couldn't be saved. Try a different one.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    await deletePhoto(key);
    setChecked(challenge.id, date, task.id, false);
  };

  return (
    <Sheet title={`${task.title} · ${formatDate(date, { day: 'numeric', month: 'short' })}`} onClose={onClose}>
      {url && <img className="photo-full" src={url} alt={`Progress photo, ${formatDate(date)}`} />}
      {busy && <p className="muted small center">Saving…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn block primary" disabled={busy} onClick={() => camera.current?.click()}>
        📷 {url ? 'Retake photo' : 'Take photo'}
      </button>
      <button className="btn block" disabled={busy} onClick={() => library.current?.click()}>Choose from library</button>
      {url && <button className="btn block danger" disabled={busy} onClick={remove}>Delete photo</button>}
      <p className="muted small">Photos stay on this phone only and are never uploaded.</p>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={library} type="file" accept="image/*" hidden onChange={onFile} />
    </Sheet>
  );
}

/** Gallery of a challenge's progress photos, with the first and latest side by side. */
export function PhotoGallery({ challenge }: { challenge: Challenge }) {
  const keys = usePhotoKeys(challenge.id);
  const [viewing, setViewing] = useState<number | null>(null);
  if (!keys.length) return null;

  const dateOf = (k: string) => parsePhotoKey(k).date;
  const dayLabel = (k: string) => `Day ${diffDays(challenge.startDate, dateOf(k)) + 1}`;
  const ends = [keys[0], keys[keys.length - 1]];

  return (
    <section className="card">
      <h3 className="section-title">Progress photos</h3>
      {keys.length > 1 && (
        <div className="compare">
          {ends.map((k) => (
            <button key={k} className="compare-item" onClick={() => setViewing(keys.indexOf(k))}>
              <Thumb photoKey={k} size="full" />
              <span className="small">{dayLabel(k)} · {formatDate(dateOf(k), { day: 'numeric', month: 'short' })}</span>
            </button>
          ))}
        </div>
      )}
      <div className="photo-grid">
        {keys.map((k, i) => (
          <button key={k} className="photo-grid-item" onClick={() => setViewing(i)} aria-label={`${dayLabel(k)} photo`}>
            <Thumb photoKey={k} size="thumb" />
            <span className="photo-day">{diffDays(challenge.startDate, dateOf(k)) + 1}</span>
          </button>
        ))}
      </div>
      {viewing !== null && keys[viewing] && (
        <Sheet title={`${dayLabel(keys[viewing])} · ${formatDate(dateOf(keys[viewing]))}`} onClose={() => setViewing(null)}>
          <Thumb photoKey={keys[viewing]} size="full" className="photo-full" />
          <div className="row">
            <button className="btn grow" disabled={viewing === 0} onClick={() => setViewing(viewing - 1)}>‹ Previous</button>
            <button className="btn grow" disabled={viewing === keys.length - 1} onClick={() => setViewing(viewing + 1)}>Next ›</button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

function Thumb({ photoKey: k, size, className = '' }: { photoKey: string; size: 'thumb' | 'full'; className?: string }) {
  const url = usePhotoUrl(k, size);
  return url ? <img className={className} src={url} alt="" /> : <span className={`${className} photo-placeholder`} />;
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
