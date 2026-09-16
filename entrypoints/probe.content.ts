import { classifyNetworkUrl, isStatsigUrl, toUrlString } from '../src/probe/network';
import { findClients, getStatsigGlobal, type FoundClient } from '../src/probe/discover';
import {
  extraHostsFromInstances,
  readInstance,
} from '../src/probe/readClient';
import { envelope } from '../src/shared/protocol';
import type { RedactOptions } from '../src/shared/redact';
import type { InspectorEvent, NetworkCall, StatsigSnapshot } from '../src/shared/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    startProbe();
  },
});

function startProbe() {
  const probeStartedAt = Date.now();
  const network: NetworkCall[] = [];
  const events: InspectorEvent[] = [];
  const extraHosts: string[] = [];
  const subscribed = new WeakSet<object>();
  let activeSdkKey: string | null = null;
  let showFullValues = false;
  let snapshotTimer: number | null = null;
  let pollTimer: number | null = null;
  let pollStartedAt = Date.now();

  installNetworkHooks();
  window.addEventListener('message', onPageMessage);

  post('HEARTBEAT', { hello: 'statsig-inspector', at: Date.now() });
  scheduleSnapshot();
  startPolling();

  function redact(): RedactOptions {
    return { showFullValues };
  }

  function post(type: string, payload?: unknown) {
    try {
      window.postMessage(envelope(type, payload), '*');
    } catch {
      /* host page must never see inspector errors */
    }
  }

  function startPolling() {
    const tick = () => {
      try {
        collectAndPost(false);
      } catch {
        /* ignore */
      }
      const elapsed = Date.now() - pollStartedAt;
      const delay = elapsed < 10_000 ? 250 : 2000;
      pollTimer = window.setTimeout(tick, delay);
    };
    tick();
  }

  function scheduleSnapshot() {
    if (snapshotTimer != null) return;
    snapshotTimer = window.setTimeout(() => {
      snapshotTimer = null;
      collectAndPost(false);
    }, 50);
  }

  function collectAndPost(allowGetContext: boolean) {
    const found = findClients();
    for (const item of found) subscribe(item);

    const instances = found.map((item) =>
      readInstance(item.flavor, item.client, item.sdkKey, redact(), {
        allowGetContext,
      }),
    );
    for (const host of extraHostsFromInstances(instances)) {
      if (!extraHosts.includes(host)) extraHosts.push(host);
    }

    if (!activeSdkKey && instances[0]) activeSdkKey = instances[0].sdkKey;
    if (activeSdkKey && !instances.some((i) => i.sdkKey === activeSdkKey)) {
      activeSdkKey = instances[0]?.sdkKey ?? null;
    }

    const g = getStatsigGlobal();
    let detectionNote: string | undefined;
    if (found.length === 0 && g && (g.instances || g.firstInstance)) {
      detectionNote = 'global-without-instance';
    } else if (found.length === 0 && window !== window.top) {
      detectionNote = 'iframe-only';
    } else if (found.length === 0) {
      detectionNote = 'top-frame-empty';
    }

    const snapshot: StatsigSnapshot = {
      takenAt: Date.now(),
      pageUrl: location.href,
      sdkDetected: found.length > 0,
      detectionNote,
      instances,
      activeSdkKey,
      network: network.slice(-100),
      events: events.slice(-200),
      probeStartedAt,
    };
    post('SNAPSHOT', snapshot);
  }

  function subscribe(item: FoundClient) {
    const client = item.client as {
      on?: (event: string, cb: (evt: unknown) => void) => void;
    };
    if (!client || typeof client.on !== 'function') return;
    if (subscribed.has(client as object)) return;
    subscribed.add(client as object);
    client.on('*', (evt: unknown) => {
      try {
        onClientEvent(evt);
      } catch {
        /* the SDK logs a console error naming our listener if we throw */
      }
    });
  }

  function onClientEvent(evt: unknown) {
    const rec = evt as { name?: string; event?: unknown; events?: unknown[]; tag?: string };
    switch (rec.name) {
      case 'log_event_called':
        events.push(toInspectorEvent(rec.event));
        post('EVENTS', { events: events.slice(-200) });
        scheduleSnapshot();
        break;
      case 'logs_flushed':
        events.push({
          id: uid(),
          at: Date.now(),
          kind: 'flush',
          name: `flushed ${rec.events?.length ?? 0}`,
        });
        post('EVENTS', { events: events.slice(-200) });
        scheduleSnapshot();
        break;
      case 'values_updated':
        scheduleSnapshot();
        break;
      case 'initialization_failure':
      case 'error':
        events.push({
          id: uid(),
          at: Date.now(),
          kind: 'sdk_error',
          name: String(rec.tag ?? rec.name ?? 'error'),
        });
        post('EVENTS', { events: events.slice(-200) });
        break;
      default:
        break;
    }
  }

  function toInspectorEvent(raw: unknown): InspectorEvent {
    const ev = (raw ?? {}) as {
      eventName?: string;
      name?: string;
      value?: string | number;
      metadata?: Record<string, unknown>;
    };
    const name = String(ev.eventName ?? ev.name ?? 'event');
    const kind: InspectorEvent['kind'] = name.startsWith('auto_capture::')
      ? 'autocapture'
      : name.startsWith('statsig::')
        ? 'exposure'
        : 'custom';
    const selector =
      typeof ev.metadata?.selector === 'string' ? ev.metadata.selector : undefined;
    return {
      id: uid(),
      at: Date.now(),
      kind,
      name,
      value: ev.value,
      metadata: ev.metadata,
      selector,
    };
  }

  function onPageMessage(event: MessageEvent) {
    if (event.source !== window) return;
    const data = event.data as { channel?: string; type?: string; payload?: unknown };
    if (data?.channel !== 'statsig-inspector') return;
    const payload = (data.payload ?? {}) as Record<string, unknown>;
    switch (data.type) {
      case 'REQUEST_SNAPSHOT':
        collectAndPost(false);
        break;
      case 'REFRESH_SNAPSHOT':
        collectAndPost(true);
        break;
      case 'SET_ACTIVE_SDK_KEY':
        if (typeof payload.sdkKey === 'string') activeSdkKey = payload.sdkKey;
        collectAndPost(false);
        break;
      case 'SET_SHOW_FULL_VALUES':
        showFullValues = Boolean(payload.showFullValues);
        collectAndPost(false);
        break;
      case 'FORCE_START_RECORDING': {
        const g = getStatsigGlobal();
        const key =
          (typeof payload.sdkKey === 'string' && payload.sdkKey) ||
          activeSdkKey ||
          undefined;
        try {
          g?.forceStartRecording?.(key);
        } catch {
          /* ignore */
        }
        collectAndPost(false);
        break;
      }
      case 'SET_HOVER_INSPECT':
        setHoverInspect(Boolean(payload.enabled));
        break;
      case 'HIGHLIGHT_SELECTOR':
        if (typeof payload.selector === 'string') {
          highlightSelector(payload.selector);
        }
        break;
      default:
        break;
    }
  }

  function installNetworkHooks() {
    patchFetch();
    patchXhr();
    patchBeacon();
  }

  function recordCall(partial: Omit<NetworkCall, 'id'>): NetworkCall {
    const call: NetworkCall = { id: uid(), ...partial };
    network.push(call);
    if (network.length > 100) network.splice(0, network.length - 100);
    scheduleSnapshot();
    return call;
  }

  function relevant(url: string): boolean {
    return isStatsigUrl(url, extraHosts);
  }

  function patchFetch() {
    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = toUrlString(input);
      if (!relevant(url)) return orig(input, init);
      const startedAt = Date.now();
      const method =
        init?.method ??
        (typeof Request !== 'undefined' && input instanceof Request
          ? input.method
          : 'GET');
      try {
        const res = await orig(input, init);
        recordCall({
          kind: classifyNetworkUrl(url),
          url,
          method,
          status: res.status,
          ok: res.ok,
          startedAt,
          durationMs: Date.now() - startedAt,
        });
        return res;
      } catch (error) {
        recordCall({
          kind: classifyNetworkUrl(url),
          url,
          method,
          status: null,
          ok: false,
          startedAt,
          durationMs: Date.now() - startedAt,
          error: String(error),
        });
        throw error;
      }
    };
  }

  function patchXhr() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      (this as XMLHttpRequest & { __si?: { method: string; url: string } }).__si = {
        method,
        url: String(url),
      };
      return origOpen.call(this, method, url, async ?? true, username, password);
    };
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const meta = (this as XMLHttpRequest & { __si?: { method: string; url: string } }).__si;
      if (meta && relevant(meta.url)) {
        const startedAt = Date.now();
        this.addEventListener('loadend', () => {
          const status = this.status || null;
          recordCall({
            kind: classifyNetworkUrl(meta.url),
            url: meta.url,
            method: meta.method,
            status,
            ok: status != null && status >= 200 && status < 300,
            startedAt,
            durationMs: Date.now() - startedAt,
            error: status == null ? 'request ended without a status' : undefined,
          });
        });
      }
      return origSend.call(this, body);
    };
  }

  function patchBeacon() {
    if (!navigator.sendBeacon) return;
    const orig = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const href = String(url);
      if (relevant(href)) {
        recordCall({
          kind: classifyNetworkUrl(href),
          url: href,
          method: 'POST',
          status: 200,
          ok: true,
          startedAt: Date.now(),
          durationMs: 0,
        });
      }
      return orig(url, data);
    };
  }

  let hoverEnabled = false;
  let hoverHighlight: HTMLElement | null = null;
  let hoverTip: HTMLElement | null = null;

  function setHoverInspect(enabled: boolean) {
    hoverEnabled = enabled;
    if (!enabled) {
      hoverHighlight?.remove();
      hoverTip?.remove();
      hoverHighlight = null;
      hoverTip = null;
      document.removeEventListener('mousemove', onHoverMove, true);
      return;
    }
    document.addEventListener('mousemove', onHoverMove, true);
  }

  function onHoverMove(ev: MouseEvent) {
    if (!hoverEnabled) return;
    const el = ev.target as Element | null;
    if (!el || !(el instanceof Element)) return;
    highlightElement(el, describeCapture(el));
  }

  function highlightSelector(selector: string) {
    try {
      const el = document.querySelector(selector);
      if (el instanceof Element) highlightElement(el, selector, 2500);
    } catch {
      /* invalid selector */
    }
  }

  function highlightElement(el: Element, label: string, persistMs?: number) {
    const rect = el.getBoundingClientRect();
    if (!hoverHighlight) {
      hoverHighlight = document.createElement('div');
      hoverHighlight.style.cssText =
        'position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #7c3aed;background:rgba(124,58,237,.12);border-radius:4px;';
      document.documentElement.appendChild(hoverHighlight);
    }
    if (!hoverTip) {
      hoverTip = document.createElement('div');
      hoverTip.style.cssText =
        'position:fixed;z-index:2147483646;pointer-events:none;background:#0f172a;color:#f8fafc;font:12px/1.4 ui-sans-serif,system-ui;padding:4px 8px;border-radius:6px;max-width:360px;';
      document.documentElement.appendChild(hoverTip);
    }
    hoverHighlight.style.top = `${rect.top}px`;
    hoverHighlight.style.left = `${rect.left}px`;
    hoverHighlight.style.width = `${rect.width}px`;
    hoverHighlight.style.height = `${rect.height}px`;
    hoverTip.textContent = label;
    hoverTip.style.top = `${Math.max(8, rect.top - 28)}px`;
    hoverTip.style.left = `${Math.max(8, rect.left)}px`;
    if (persistMs) {
      window.setTimeout(() => {
        if (!hoverEnabled) {
          hoverHighlight?.remove();
          hoverTip?.remove();
          hoverHighlight = null;
          hoverTip = null;
        }
      }, persistMs);
    }
  }

  function describeCapture(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
        : '';
    const text = (el.textContent ?? '').trim().slice(0, 80);
    return `${tag}${id}${cls}${text ? ` “${text}”` : ''} — autocapture would log a click here`;
  }

  function uid(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  void pollTimer;
}
