import { useState } from 'react';
import './cards.css';

export function ConsoleKeyForm({
  hasKey,
  error,
  onSave,
  onClear,
}: {
  hasKey: boolean;
  error: string | null;
  onSave: (key: string, remember: boolean) => void;
  onClear: () => void;
}) {
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);

  return (
    <section className="card">
      <h2>Statsig Console</h2>
      <p className="warn-box">
        Use a <strong>personal</strong> Console API key. Project keys can mutate
        the whole project. This extension issues GET requests only, but still
        never paste a production project secret you do not trust here.
      </p>
      {hasKey ? (
        <p className="note">A Console key is stored in this browser session.</p>
      ) : (
        <p className="note">
          Optional. Unlocks hashed gate names and Logs Explorer “did it land?”
        </p>
      )}
      <form
        className="form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (key.trim()) onSave(key.trim(), remember);
        }}
      >
        <label htmlFor="console-key">Personal Console API key</label>
        <input
          id="console-key"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="console-…"
        />
        <label className="row">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember on this device (writes chrome.storage.local)
        </label>
        <div className="row">
          <button className="primary" type="submit">
            Save key
          </button>
          <button type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </form>
      {error ? <p className="warn-box">{error}</p> : null}
    </section>
  );
}
