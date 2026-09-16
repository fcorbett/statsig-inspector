import type { SdkFlavor } from '../shared/types';

export interface StatsigGlobalLike {
  instances?: Record<string, unknown>;
  firstInstance?: unknown;
  acInstances?: Record<string, unknown>;
  srInstances?: Record<string, unknown>;
  firstSRInstance?: unknown;
  instance?: (sdkKey?: string) => unknown;
  forceStartRecording?: (sdkKey?: string) => void;
}

export interface FoundClient {
  sdkKey: string;
  client: unknown;
  flavor: SdkFlavor;
}

export function getStatsigGlobal(): StatsigGlobalLike | undefined {
  return (window as unknown as { __STATSIG__?: StatsigGlobalLike }).__STATSIG__;
}

export function findClients(): FoundClient[] {
  const w = window as unknown as {
    __STATSIG__?: StatsigGlobalLike;
    __STATSIG_JS_SDK__?: { instance?: unknown };
    __STATSIG_SDK__?: { instance?: unknown };
  };
  const out: FoundClient[] = [];

  const g = w.__STATSIG__;
  if (g?.instances) {
    for (const [sdkKey, client] of Object.entries(g.instances)) {
      out.push({ sdkKey, client, flavor: 'js-client' });
    }
  }

  const legacy = w.__STATSIG_JS_SDK__?.instance ?? w.__STATSIG_SDK__?.instance;
  if (legacy && out.length === 0) {
    const rec = legacy as { getSDKKey?: () => string; sdkKey?: string };
    const sdkKey =
      (typeof rec.getSDKKey === 'function' ? rec.getSDKKey() : rec.sdkKey) ??
      'unknown';
    out.push({ sdkKey, client: legacy, flavor: 'legacy-statsig-js' });
  }

  return out;
}
