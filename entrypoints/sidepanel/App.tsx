import { useEffect, useMemo, useState } from 'react';
import { runChecks } from '../../src/shared/checks';
import { logsExplorerUrl } from '../../src/shared/consoleApi';
import type { StatsigSnapshot } from '../../src/shared/types';
import { Scorecard } from './components/Scorecard';
import { IdentityCard } from './components/IdentityCard';
import { ReplayCard } from './components/ReplayCard';
import { EventStream } from './components/EventStream';
import { EvaluationList } from './components/EvaluationList';
import { ConsoleKeyForm } from './components/ConsoleKeyForm';
import './App.css';
import './components/cards.css';

type Tab = 'verify' | 'inspect';

interface PanelState {
  snapshot: StatsigSnapshot | null;
  nameMap: Record<string, string>;
  hasConsoleKey: boolean;
  heartbeatAt: number;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('verify');
  const [state, setState] = useState<PanelState>({
    snapshot: null,
    nameMap: {},
    hasConsoleKey: false,
    heartbeatAt: 0,
  });
  const [hover, setHover] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [consoleError, setConsoleError] = useState<string | null>(null);
  const [logs, setLogs] = useState<unknown[] | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);
  const [pageOrigin, setPageOrigin] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    const listener = (message: { type?: string } & Partial<PanelState>) => {
      if (message.type === 'SNAPSHOT_UPDATED') {
        setState((prev) => ({
          snapshot: message.snapshot ?? prev.snapshot,
          nameMap: message.nameMap ?? prev.nameMap,
          hasConsoleKey: message.hasConsoleKey ?? prev.hasConsoleKey,
          heartbeatAt: message.heartbeatAt ?? prev.heartbeatAt,
        }));
      }
    };
    browser.runtime.onMessage.addListener(listener);
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const [tabInfo] = await browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (!tabInfo?.url) return;
      try {
        const origin = new URL(tabInfo.url).origin;
        setPageOrigin(origin);
        const status = (await browser.runtime.sendMessage({
          type: 'SITE_PERMISSION_STATUS',
          payload: { origin },
        })) as { granted?: boolean };
        setPermission(Boolean(status?.granted));
      } catch {
        setPermission(null);
      }
    })();
  }, [state.snapshot?.pageUrl]);

  const snapshot = state.snapshot;
  const instance =
    snapshot?.instances.find((i) => i.sdkKey === snapshot.activeSdkKey) ??
    snapshot?.instances[0] ??
    null;
  const checks = useMemo(
    () => (snapshot ? runChecks(snapshot) : []),
    [snapshot],
  );
  const looking =
    snapshot != null &&
    !snapshot.sdkDetected &&
    snapshot.takenAt - snapshot.probeStartedAt < 2000;

  return (
    <div className="shell">
      <header className="top">
        <h1>Statsig Inspector</h1>
        <p className="sub">
          {snapshot?.pageUrl ? hostOf(snapshot.pageUrl) : 'Open a tab, then this panel'}
        </p>
        <nav className="tabs">
          <button
            type="button"
            className={tab === 'verify' ? 'active' : ''}
            onClick={() => setTab('verify')}
          >
            Verify
          </button>
          <button
            type="button"
            className={tab === 'inspect' ? 'active' : ''}
            onClick={() => setTab('inspect')}
          >
            Inspect
          </button>
        </nav>
      </header>
      <main className="body">
        {permission === false && pageOrigin ? (
          <div className="banner warn">
            Grant access to {pageOrigin} so the inspector can read this page.
            <div className="toolbar" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="primary"
                onClick={() => void requestPermission(pageOrigin)}
              >
                Grant access
              </button>
            </div>
          </div>
        ) : null}

        {snapshot?.instances && snapshot.instances.length > 1 ? (
          <label className="toolbar">
            SDK instance
            <select
              value={snapshot.activeSdkKey ?? ''}
              onChange={(e) =>
                void browser.runtime.sendMessage({
                  type: 'SET_ACTIVE_SDK_KEY',
                  payload: { sdkKey: e.target.value },
                })
              }
            >
              {snapshot.instances.map((inst) => (
                <option key={inst.sdkKey} value={inst.sdkKey}>
                  {inst.sdkKeyMasked} ({inst.flavor})
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="toolbar">
          <button
            type="button"
            onClick={() =>
              void browser.runtime.sendMessage({ type: 'TOGGLE_HUD' })
            }
          >
            Toggle HUD
          </button>
          <button
            type="button"
            className={hover ? 'primary' : ''}
            onClick={() => {
              const next = !hover;
              setHover(next);
              void browser.runtime.sendMessage({
                type: 'SET_HOVER_INSPECT',
                payload: { enabled: next },
              });
            }}
          >
            {hover ? 'Hover inspect on' : 'Hover inspect'}
          </button>
          <button
            type="button"
            onClick={() =>
              void browser.runtime.sendMessage({ type: 'REFRESH_SNAPSHOT' })
            }
          >
            Refresh
          </button>
        </div>

        {!snapshot ? (
          <p className="empty">
            Waiting for the page probe. Open this side panel on a site, or load a
            local fixture at localhost:8787.
          </p>
        ) : looking ? (
          <div className="banner">Looking for Statsig…</div>
        ) : tab === 'verify' ? (
          <>
            {!snapshot.sdkDetected ? (
              <div className="banner warn">
                Statsig isn't installed on this page, or it only exists inside an
                iframe. v1 inspects the top frame only.
              </div>
            ) : null}
            <Scorecard checks={checks} />
            <IdentityCard instance={instance} />
            <ReplayCard
              instance={instance}
              onForceStart={() =>
                void browser.runtime.sendMessage({
                  type: 'FORCE_START_RECORDING',
                  payload: { sdkKey: instance?.sdkKey },
                })
              }
            />
            <EventStream
              events={snapshot.events}
              onHighlight={(selector) =>
                void browser.runtime.sendMessage({
                  type: 'HIGHLIGHT_SELECTOR',
                  payload: { selector },
                })
              }
            />
            {instance?.user.userID ? (
              <p className="note">
                Server-side flags and events are invisible unless this page
                bootstraps from your server, or you connect a Console key so we
                can look up this userID.{' '}
                <a
                  href={logsExplorerUrl(instance.user.userID)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Logs Explorer
                </a>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <EvaluationList
              evaluations={instance?.evaluations ?? []}
              nameMap={state.nameMap}
            />
            <NetworkCard network={snapshot.network} />
            <ConsoleKeyForm
              hasKey={state.hasConsoleKey}
              error={consoleError}
              onSave={(key, remember) => void saveKey(key, remember)}
              onClear={() => void clearKey()}
            />
            <label className="toolbar">
              <input
                type="checkbox"
                checked={showFull}
                onChange={(e) => {
                  setShowFull(e.target.checked);
                  void browser.runtime.sendMessage({
                    type: 'SET_SHOW_FULL_VALUES',
                    payload: { showFullValues: e.target.checked },
                  });
                }}
              />
              Show full values (email)
            </label>
            {instance?.user.userID && state.hasConsoleKey ? (
              <div className="card">
                <h2>Did it land?</h2>
                <p className="note">
                  Looks up recent Logs Explorer events for this userID. Needs a
                  Console key; leave this as a manual check if you do not have one
                  yet.
                </p>
                <button
                  type="button"
                  onClick={() => void lookupLogs(instance.user.userID!)}
                >
                  Query Logs Explorer
                </button>
                {logs ? (
                  <pre className="note">{JSON.stringify(logs, null, 2)}</pre>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );

  async function refresh() {
    const res = (await browser.runtime.sendMessage({
      type: 'GET_ACTIVE_SNAPSHOT',
    })) as PanelState | undefined;
    if (res) {
      setState({
        snapshot: res.snapshot ?? null,
        nameMap: res.nameMap ?? {},
        hasConsoleKey: Boolean(res.hasConsoleKey),
        heartbeatAt: res.heartbeatAt ?? 0,
      });
    }
  }

  async function requestPermission(origin: string) {
    const res = (await browser.runtime.sendMessage({
      type: 'REQUEST_SITE_PERMISSION',
      payload: { origin },
    })) as { granted?: boolean };
    setPermission(Boolean(res?.granted));
  }

  async function saveKey(key: string, remember: boolean) {
    const res = (await browser.runtime.sendMessage({
      type: 'SET_CONSOLE_KEY',
      payload: { key, remember },
    })) as { error?: string; nameMap?: Record<string, string>; hasConsoleKey?: boolean };
    setConsoleError(res.error ?? null);
    setState((prev) => ({
      ...prev,
      hasConsoleKey: Boolean(res.hasConsoleKey),
      nameMap: res.nameMap ?? prev.nameMap,
    }));
  }

  async function clearKey() {
    await browser.runtime.sendMessage({ type: 'CLEAR_CONSOLE_KEY' });
    setState((prev) => ({ ...prev, hasConsoleKey: false, nameMap: {} }));
    setConsoleError(null);
  }

  async function lookupLogs(userID: string) {
    const res = (await browser.runtime.sendMessage({
      type: 'LOOKUP_LOGS',
      payload: { userID },
    })) as { events?: unknown[]; error?: string };
    setLogs(res.events ?? [{ error: res.error }]);
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function NetworkCard({
  network,
}: {
  network: StatsigSnapshot['network'];
}) {
  return (
    <section className="card">
      <h2>Network</h2>
      {network.length === 0 ? (
        <p className="note">
          No Statsig network calls observed. Bootstrap/SSR pages often have none;
          that is not an ad blocker.
        </p>
      ) : (
        <div className="net-list">
          {network
            .slice()
            .reverse()
            .map((call) => (
              <div key={call.id} className="net-row">
                <span>{call.kind}</span>
                <span>{call.status ?? 'blocked?'}</span>
                <span className="mono">{call.url}</span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
