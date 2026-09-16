import { djb2 } from './hash';

const CONSOLE_API_BASE = 'https://statsigapi.net/console/v1';

export const CONSOLE_GET_PATHS = [
  '/console/v1/gates',
  '/console/v1/experiments',
  '/console/v1/dynamic_configs',
  '/console/v1/logs',
] as const;

export interface ConsoleListItem {
  id?: string;
  name?: string;
}

export interface ConsoleListResponse {
  data?: ConsoleListItem[];
  message?: string;
}

export interface ConsoleLogEvent {
  eventName?: string;
  userID?: string;
  timestamp?: string | number;
  [key: string]: unknown;
}

export function usersTabUrl(opts: {
  userID?: string | null;
  stableID?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.userID) params.set('userID', opts.userID);
  if (opts.stableID) params.set('stableID', opts.stableID);
  return `https://console.statsig.com/users?${params.toString()}`;
}

export function logsExplorerUrl(userID: string): string {
  return `https://console.statsig.com/logs?query=${encodeURIComponent(`user_id:${userID}`)}`;
}

export async function consoleGet<T>(
  pathAndQuery: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const url = pathAndQuery.startsWith('http')
    ? pathAndQuery
    : `${CONSOLE_API_BASE}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: {
      'STATSIG-API-KEY': apiKey,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Console API ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchConfigNames(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  const names = new Set<string>();
  const endpoints = ['/gates', '/experiments', '/dynamic_configs'] as const;
  for (const path of endpoints) {
    const body = await consoleGet<ConsoleListResponse>(path, apiKey, fetchImpl);
    for (const item of body.data ?? []) {
      if (item.name) names.add(item.name);
      if (item.id) names.add(item.id);
    }
  }
  return [...names];
}

export function nameMapFromConfigNames(
  names: string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of names) {
    map[djb2(name)] = name;
    map[name] = name;
  }
  return map;
}

export async function lookupUserEvents(
  apiKey: string,
  userID: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConsoleLogEvent[]> {
  const query = encodeURIComponent(`user_id:${userID}`);
  const body = await consoleGet<{ data?: ConsoleLogEvent[] }>(
    `/logs?source=events&query=${query}`,
    apiKey,
    fetchImpl,
  );
  return body.data ?? [];
}
