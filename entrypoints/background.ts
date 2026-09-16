import {
  fetchConfigNames,
  lookupUserEvents,
  nameMapFromConfigNames,
} from '../src/shared/consoleApi';
import { TOGGLE_HUD_COMMAND } from '../src/shared/protocol';
import type { StatsigSnapshot } from '../src/shared/types';

const SESSION_KEY = 'consoleApiKey';
const LOCAL_KEY = 'consoleApiKey';
const REMEMBER_KEY = 'rememberConsoleKey';

interface TabState {
  snapshot: StatsigSnapshot | null;
  heartbeatAt: number;
}

const tabs = new Map<number, TabState>();
let nameMap: Record<string, string> = {};

export default defineBackground(() => {
  void browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => undefined);

  browser.runtime.onInstalled.addListener(() => {
    void browser.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch(() => undefined);
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== TOGGLE_HUD_COMMAND) return;
    void sendToActiveTab({ type: 'TOGGLE_HUD' });
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    tabs.delete(tabId);
  });

  browser.tabs.onActivated.addListener((info) => {
    void broadcastSnapshot(info.tabId);
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void handleMessage(message, sender)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({ error: String(error) });
      });
    return true;
  });
});

async function handleMessage(
  message: { type?: string; payload?: unknown },
  sender: { tab?: { id?: number; url?: string } },
): Promise<unknown> {
  const type = message?.type;
  if (!type) return null;
  const tabId = sender.tab?.id;

  if (type === 'HEARTBEAT' || type === 'SNAPSHOT' || type === 'EVENTS') {
    if (typeof tabId !== 'number') return null;
    const state = tabs.get(tabId) ?? { snapshot: null, heartbeatAt: 0 };
    state.heartbeatAt = Date.now();
    if (type === 'SNAPSHOT') {
      state.snapshot = message.payload as StatsigSnapshot;
    }
    if (type === 'EVENTS' && state.snapshot) {
      const payload = message.payload as { events?: StatsigSnapshot['events'] };
      if (payload?.events) state.snapshot.events = payload.events;
    }
    tabs.set(tabId, state);
    await broadcastSnapshot(tabId);
    return { ok: true };
  }

  switch (type) {
    case 'GET_ACTIVE_SNAPSHOT': {
      const id = await activeTabId();
      const state = id != null ? tabs.get(id) : undefined;
      return {
        type: 'ACTIVE_SNAPSHOT',
        tabId: id,
        snapshot: state?.snapshot ?? null,
        heartbeatAt: state?.heartbeatAt ?? 0,
        nameMap,
        hasConsoleKey: await hasConsoleKey(),
      };
    }
    case 'SET_CONSOLE_KEY': {
      const payload = message.payload as {
        key?: string;
        remember?: boolean;
      };
      const key = payload.key?.trim() ?? '';
      if (!key) return { error: 'empty key' };
      await browser.storage.session.set({ [SESSION_KEY]: key });
      if (payload.remember) {
        await browser.storage.local.set({
          [LOCAL_KEY]: key,
          [REMEMBER_KEY]: true,
        });
      } else {
        await browser.storage.local.remove([LOCAL_KEY, REMEMBER_KEY]);
      }
      try {
        const names = await fetchConfigNames(key);
        nameMap = nameMapFromConfigNames(names);
      } catch (error) {
        nameMap = {};
        return {
          hasConsoleKey: true,
          nameMap,
          error: String(error),
        };
      }
      return { hasConsoleKey: true, nameMap };
    }
    case 'CLEAR_CONSOLE_KEY': {
      await browser.storage.session.remove(SESSION_KEY);
      await browser.storage.local.remove([LOCAL_KEY, REMEMBER_KEY]);
      nameMap = {};
      return { hasConsoleKey: false, nameMap };
    }
    case 'CONSOLE_KEY_STATUS':
      return { hasConsoleKey: await hasConsoleKey(), nameMap };
    case 'LOOKUP_LOGS': {
      const payload = message.payload as { userID?: string };
      const key = await getConsoleKey();
      if (!key) return { error: 'no console key' };
      if (!payload.userID) return { error: 'no userID' };
      const events = await lookupUserEvents(key, payload.userID);
      return { events };
    }
    case 'REQUEST_SITE_PERMISSION': {
      const origin = (message.payload as { origin?: string })?.origin;
      if (!origin) return { granted: false };
      const granted = await browser.permissions.request({
        origins: [`${origin}/*`],
      });
      return { granted };
    }
    case 'SITE_PERMISSION_STATUS': {
      const origin = (message.payload as { origin?: string })?.origin;
      if (!origin) return { granted: false };
      const granted = await browser.permissions.contains({
        origins: [`${origin}/*`],
      });
      return { granted };
    }
    case 'TOGGLE_HUD':
    case 'SET_HOVER_INSPECT':
    case 'HIGHLIGHT_SELECTOR':
    case 'FORCE_START_RECORDING':
    case 'SET_ACTIVE_SDK_KEY':
    case 'SET_SHOW_FULL_VALUES':
    case 'REFRESH_SNAPSHOT':
    case 'REQUEST_SNAPSHOT':
      await sendToActiveTab({ type, payload: message.payload });
      return { ok: true };
    default:
      return null;
  }
}

async function hasConsoleKey(): Promise<boolean> {
  return (await getConsoleKey()) != null;
}

async function getConsoleKey(): Promise<string | null> {
  const session = await browser.storage.session.get(SESSION_KEY);
  const fromSession = session[SESSION_KEY];
  if (typeof fromSession === 'string' && fromSession) return fromSession;
  const local = await browser.storage.local.get([LOCAL_KEY, REMEMBER_KEY]);
  if (local[REMEMBER_KEY] && typeof local[LOCAL_KEY] === 'string') {
    await browser.storage.session.set({ [SESSION_KEY]: local[LOCAL_KEY] });
    return local[LOCAL_KEY] as string;
  }
  return null;
}

async function activeTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id ?? null;
}

async function sendToActiveTab(message: { type: string; payload?: unknown }) {
  const id = await activeTabId();
  if (id == null) return;
  await browser.tabs.sendMessage(id, message).catch(() => undefined);
}

async function broadcastSnapshot(tabId: number) {
  const state = tabs.get(tabId);
  await browser.runtime
    .sendMessage({
      type: 'SNAPSHOT_UPDATED',
      tabId,
      snapshot: state?.snapshot ?? null,
      heartbeatAt: state?.heartbeatAt ?? 0,
      nameMap,
      hasConsoleKey: await hasConsoleKey(),
    })
    .catch(() => undefined);
}
