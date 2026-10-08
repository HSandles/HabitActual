import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { exportBackup, parseBackup } from '../storage';
import { Header } from '../components';
import { useStore } from '../store';

export function Settings() {
  const { state, update } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const msg = `Replace your ${state.challenges.length} challenge(s) on this device with the ${backup.challenges.length} in this backup?`;
      if (!confirm(msg)) return;
      update(() => backup);
      setMessage(`Restored ${backup.challenges.length} challenge(s).`);
    } catch (err) {
      setMessage(err instanceof SyntaxError ? "This file isn't a HabitActual backup." : (err as Error).message);
    }
  };

  return (
    <>
      <Header title="Settings" />
      <main>
        <section className="card">
          <h3 className="section-title">Your data</h3>
          <p className="muted small">
            Everything is stored only on this device. Nothing is sent anywhere. Export a backup now and then,
            especially before changing phones or clearing your browser data.
          </p>
          <button className="btn block" onClick={() => exportBackup(state)}>Export backup</button>
          <button className="btn block" onClick={() => fileInput.current?.click()}>Restore from backup…</button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
          {message && <p className="small" role="status">{message}</p>}
          {persisted === false && (
            <p className="muted small">
              Tip: add the app to your home screen. The browser is then much less likely to clear its data.
            </p>
          )}
        </section>

        <section className="card">
          <h3 className="section-title">Install on your phone</h3>
          <p className="small"><strong>iPhone (Safari):</strong> tap Share ⎋, then “Add to Home Screen”.</p>
          <p className="small"><strong>Android (Chrome):</strong> tap ⋮, then “Add to Home screen” or “Install app”.</p>
          <p className="muted small">Once installed it opens full screen and works offline.</p>
        </section>

        <p className="muted small center">HabitActual · v{__APP_VERSION__}</p>
      </main>
    </>
  );
}
