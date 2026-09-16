import { runChecks } from '../shared/checks';
import type { StatsigSnapshot } from '../shared/types';

export interface HudHandle {
  render: (snapshot: StatsigSnapshot) => void;
  hide: () => void;
  show: () => void;
}

export function createHud(opts: { onToggle: () => void }): HudHandle {
  const host = document.createElement('div');
  host.id = 'statsig-inspector-hud';
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.right = '16px';
  host.style.bottom = '16px';
  const shadow = host.attachShadow({ mode: 'closed' });
  const wrap = document.createElement('div');
  wrap.setAttribute('part', 'hud');
  shadow.appendChild(style());
  shadow.appendChild(wrap);
  document.documentElement.appendChild(host);

  const onToggle = opts.onToggle;

  function render(snapshot: StatsigSnapshot) {
    const checks = runChecks(snapshot);
    const fails = checks.filter((c) => c.status === 'fail').length;
    const warns = checks.filter((c) => c.status === 'warn').length;
    const inst =
      snapshot.instances.find((i) => i.sdkKey === snapshot.activeSdkKey) ??
      snapshot.instances[0];
    const lastEvent = snapshot.events[snapshot.events.length - 1];
    const looking =
      !snapshot.sdkDetected && snapshot.takenAt - snapshot.probeStartedAt < 2000;

    const sdkChip = looking
      ? chip('looking', 'Looking for Statsig…')
      : snapshot.sdkDetected
        ? chip('ok', 'SDK found')
        : chip('bad', 'SDK not found');
    const idChip = inst?.user.userID
      ? chip('ok', inst.user.userID)
      : chip('warn', 'no userID');
    const recChip = inst
      ? inst.replay.status === 'recording'
        ? chip('ok', 'recording')
        : chip('warn', inst.replay.status.replaceAll('_', ' '))
      : chip('warn', 'replay ?');
    const eventChip = lastEvent
      ? chip('ok', lastEvent.name)
      : chip('muted', 'no events yet');

    wrap.innerHTML = `
      <div class="bar">
        <div class="brand">Statsig Inspector</div>
        <div class="chips">
          ${sdkChip}
          ${idChip}
          ${recChip}
          ${eventChip}
        </div>
        <div class="meta">${fails} fail · ${warns} warn</div>
        <button type="button" class="hide" aria-label="Hide HUD">×</button>
      </div>
    `;
    wrap.querySelector('.hide')?.addEventListener('click', onToggle);
  }

  return {
    render,
    hide() {
      host.style.display = 'none';
    },
    show() {
      host.style.display = 'block';
    },
  };
}

function chip(kind: string, text: string): string {
  return `<span class="chip ${kind}">${escapeHtml(text)}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function style(): HTMLStyleElement {
  const el = document.createElement('style');
  el.textContent = `
    :host { all: initial; }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: min(92vw, 720px);
      padding: 8px 10px;
      border-radius: 999px;
      background: #0f172a;
      color: #f8fafc;
      font: 12px/1.3 ui-sans-serif, system-ui, -apple-system, sans-serif;
      box-shadow: 0 8px 30px rgba(15, 23, 42, 0.35);
    }
    .brand { font-weight: 700; white-space: nowrap; letter-spacing: 0.01em; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      border-radius: 999px;
      padding: 2px 8px;
      background: #1e293b;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chip.ok { background: #14532d; }
    .chip.bad { background: #7f1d1d; }
    .chip.warn { background: #78350f; }
    .chip.looking { background: #1e3a8a; }
    .chip.muted { background: #334155; color: #cbd5e1; }
    .meta { color: #94a3b8; white-space: nowrap; }
    .hide {
      all: unset;
      cursor: pointer;
      width: 20px;
      height: 20px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #cbd5e1;
    }
    .hide:hover { background: #1e293b; }
  `;
  return el;
}
