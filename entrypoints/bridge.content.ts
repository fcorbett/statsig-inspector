import { envelope, isInspectorEnvelope, TOGGLE_HUD_COMMAND } from '../src/shared/protocol';
import type { StatsigSnapshot } from '../src/shared/types';
import { createHud, type HudHandle } from '../src/ui/hud';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    startBridge();
  },
});

function startBridge() {
  let hud: HudHandle | null = null;
  let latest: StatsigSnapshot | null = null;
  let hudVisible = true;

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    if (!isInspectorEnvelope(event.data)) return;
    const { type, payload } = event.data;
    if (type === 'HEARTBEAT' || type === 'SNAPSHOT' || type === 'EVENTS') {
      void browser.runtime.sendMessage({ type, payload }).catch(() => undefined);
    }
    if (type === 'SNAPSHOT') {
      latest = payload as StatsigSnapshot;
      ensureHud();
      hud?.render(latest);
    }
  });

  browser.runtime.onMessage.addListener((message: { type?: string; payload?: unknown }) => {
    if (!message?.type) return;
    if (message.type === 'TOGGLE_HUD') {
      hudVisible = !hudVisible;
      if (!hudVisible) hud?.hide();
      else {
        ensureHud();
        if (latest) hud?.render(latest);
        hud?.show();
      }
      return;
    }
    window.postMessage(envelope(message.type, message.payload), '*');
  });

  browser.runtime.sendMessage({ type: 'HEARTBEAT', payload: { from: 'bridge' } }).catch(
    () => undefined,
  );

  function ensureHud() {
    if (hud || !hudVisible) return;
    hud = createHud({
      onToggle: () => {
        hudVisible = false;
        hud?.hide();
      },
    });
  }
}

void TOGGLE_HUD_COMMAND;
