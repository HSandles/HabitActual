import { useState, type PointerEvent } from 'react';
import { diffDays, formatDate, type ISODate } from './dates';
import {
  formatAmount, formatChange, getAmount, getMeasurements, isTaskDone, sharedDecimals, summariseMeasurements,
  type Challenge, type Measurement, type Task,
} from './model';
import { Sheet, Stat } from './components';
import { useStore } from './store';

const shortDate = (d: ISODate) => formatDate(d, { day: 'numeric', month: 'short' });

/** Checklist row for a measure task (e.g. a weigh-in): tap to log today's value. */
export function MeasureTask({ challenge, date, task }: { challenge: Challenge; date: ISODate; task: Task }) {
  const [open, setOpen] = useState(false);
  const value = getAmount(challenge, date, task.id);
  const done = isTaskDone(challenge, date, task);

  return (
    <>
      <button className={done ? 'task measure-task done' : 'task measure-task'} onClick={() => setOpen(true)}>
        <span className="box" aria-hidden />
        <span className="task-title">{task.title}</span>
        <span className={value ? 'measure-value' : 'measure-value empty'}>{value ? formatAmount(value, task.unit) : 'Log'}</span>
      </button>
      {open && <MeasureSheet challenge={challenge} date={date} task={task} onClose={() => setOpen(false)} />}
    </>
  );
}

function MeasureSheet({ challenge, date, task, onClose }: { challenge: Challenge; date: ISODate; task: Task; onClose: () => void }) {
  const { setAmount, setChecked } = useStore();
  const current = getAmount(challenge, date, task.id);
  const previous = getMeasurements(challenge, task.id).filter((m) => diffDays(m.date, date) > 0).pop();
  const [value, setValue] = useState(current ? String(current) : '');
  const parsed = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  const save = () => {
    setAmount(challenge.id, date, task.id, parsed);
    onClose();
  };
  const clear = () => {
    setAmount(challenge.id, date, task.id, 0);
    setChecked(challenge.id, date, task.id, false);
    onClose();
  };

  return (
    <Sheet title={`${task.title} · ${shortDate(date)}`} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (valid) save(); }}>
        <label className="field">
          <span>Value{task.unit ? ` (${task.unit})` : ''}</span>
          <input
            autoFocus
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={previous ? String(previous.value) : '0'}
          />
        </label>
        {previous && (
          <p className="muted small">Previous: {formatAmount(previous.value, task.unit)} on {formatDate(previous.date)}</p>
        )}
        <button type="submit" className="btn block primary" disabled={!valid}>Save</button>
        {current > 0 && <button type="button" className="btn block danger" onClick={clear}>Clear this entry</button>}
      </form>
    </Sheet>
  );
}

/** Challenge-page card for one measure task: start, latest, change, trend and every entry. */
export function MeasureCard({ challenge, task }: { challenge: Challenge; task: Task }) {
  const points = getMeasurements(challenge, task.id);
  const summary = summariseMeasurements(points);
  const dp = sharedDecimals(points.map((p) => p.value));
  const amount = (n: number) => formatAmount(n, task.unit, dp);
  const change = (n: number) => formatChange(Math.round(n * 1000) / 1000, task.unit, dp);

  return (
    <section className="card">
      <h3 className="section-title">{task.title}</h3>
      {!summary ? (
        <p className="muted small">Nothing logged yet. Log your first value from the Today screen.</p>
      ) : (
        <>
          <div className="stats three">
            <Stat label={`start · ${shortDate(summary.first.date)}`} value={amount(summary.first.value)} />
            <Stat label={`latest · ${shortDate(summary.latest.date)}`} value={amount(summary.latest.value)} />
            <Stat
              label={points.length > 1 ? `change · ${formatChange(Math.round(summary.changePct * 10) / 10)}%` : 'change'}
              value={points.length > 1 ? change(summary.change) : '–'}
            />
          </div>
          {points.length > 1 ? (
            <>
              <TrendChart points={points} format={amount} label={task.title} />
              <p className="muted small">
                Lowest {amount(summary.lowest)} · highest {amount(summary.highest)} · {points.length} entries
              </p>
            </>
          ) : (
            <p className="muted small">Log another day to see your trend.</p>
          )}
          <details className="entries">
            <summary>All entries</summary>
            <table>
              <thead>
                <tr><th>Date</th><th>Value</th><th>Since start</th></tr>
              </thead>
              <tbody>
                {[...points].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{formatDate(p.date)}</td>
                    <td>{amount(p.value)}</td>
                    <td>{change(p.value - summary.first.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

// Chart geometry, in viewBox units. The SVG scales to the card width.
const W = 320;
const H = 150;
const M = { top: 10, right: 12, bottom: 22, left: 38 };

/** About four round-numbered gridlines covering the data. */
function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const rough = (max - min) / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t < max + step; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return ticks;
}

/** Single-series line of value over time. Touch or hover to read off any day. */
function TrendChart({ points, format, label }: { points: Measurement[]; format: (n: number) => string; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value)));
  const y0 = ticks[0];
  const y1 = ticks[ticks.length - 1];
  const span = Math.max(1, diffDays(points[0].date, points[points.length - 1].date));
  const x = (p: Measurement) => M.left + (diffDays(points[0].date, p.date) / span) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * (H - M.top - M.bottom);

  const latest = points.length - 1;
  const shown = points[active ?? latest];

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p) - px) < Math.abs(x(points[nearest]) - px)) nearest = i;
    });
    setActive(nearest);
  };

  return (
    <figure className="trend">
      <figcaption className="trend-readout">
        <strong>{format(shown.value)}</strong>
        <span className="muted small">{formatDate(shown.date)}{active === null ? ' · latest' : ''}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label} over time, from ${format(points[0].value)} to ${format(points[latest].value)}. Every value is listed under All entries.`}
        onPointerDown={pick}
        onPointerMove={pick}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="trend-grid" x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} />
            <text className="trend-axis" x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle">{formatAmount(t)}</text>
          </g>
        ))}
        <text className="trend-axis" x={M.left} y={H - 6}>{shortDate(points[0].date)}</text>
        <text className="trend-axis" x={W - M.right} y={H - 6} textAnchor="end">{shortDate(points[latest].date)}</text>
        {active !== null && <line className="trend-cross" x1={x(shown)} x2={x(shown)} y1={M.top} y2={H - M.bottom} />}
        <polyline className="trend-line" points={points.map((p) => `${x(p)},${y(p.value)}`).join(' ')} />
        <circle className="trend-dot" cx={x(shown)} cy={y(shown.value)} r={4.5} />
      </svg>
    </figure>
  );
}
