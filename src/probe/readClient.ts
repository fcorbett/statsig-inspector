import { findClients, getStatsigGlobal } from './discover';
import { readReplay } from '../shared/replay';
import { isBootstrap } from '../shared/reason';
import { maskSdkKey, redactUser, type RedactOptions } from '../shared/redact';
import type {
  EvaluationDetailsLike,
  EvaluationRecord,
  InstanceSnapshot,
  LoadingStatus,
} from '../shared/types';

interface ContextHandleLike {
  values?: Record<string, unknown> | null;
  user?: unknown;
  stableID?: string;
  options?: {
    environment?: { tier?: string };
    networkConfig?: { api?: string; initializeUrl?: string; logEventUrl?: string };
  };
  getSession?: (bumpSession?: boolean) => { data?: { sessionID?: string } };
}

interface ModernClient {
  loadingStatus?: LoadingStatus;
  getContextHandle?: () => ContextHandleLike;
  getContext?: () => {
    values?: Record<string, unknown>;
    user?: unknown;
    stableID?: string;
    options?: ContextHandleLike['options'];
    session?: { data?: { sessionID?: string } };
  };
  getFeatureGate?: (
    name: string,
    opts?: { disableExposureLog?: boolean },
  ) => {
    value?: boolean;
    ruleID?: string;
    details?: EvaluationDetailsLike;
    name?: string;
  };
  getDynamicConfig?: (
    name: string,
    opts?: { disableExposureLog?: boolean },
  ) => { value?: unknown; ruleID?: string; details?: EvaluationDetailsLike };
  on?: (event: string, cb: (evt: unknown) => void) => void;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function countKeys(value: unknown): number {
  const rec = asRecord(value);
  return rec ? Object.keys(rec).length : 0;
}

function detailsFromEval(raw: unknown): EvaluationDetailsLike | null {
  const rec = asRecord(raw);
  if (!rec || typeof rec.reason !== 'string') return null;
  return rec as unknown as EvaluationDetailsLike;
}

export function readModern(
  client: unknown,
  sdkKey: string,
  redact: RedactOptions,
  opts: { allowGetContext?: boolean } = {},
): InstanceSnapshot {
  const c = client as ModernClient;
  // getContextHandle() has lazy getters and no side effects.
  const h =
    typeof c.getContextHandle === 'function' ? c.getContextHandle() : null;

  // NEVER call client.getContext() on a timer. If the handle is missing (older 3.x),
  // fall back to getContext() only on an explicit user-triggered refresh.
  let values = h ? h.values : null;
  let user: unknown = h ? h.user : {};
  let stableID = h ? (h.stableID ?? null) : null;
  let options = h ? h.options : {};
  // bumpSession=false is REQUIRED — the default is true.
  let sessionID = h?.getSession ? (h.getSession(false)?.data?.sessionID ?? null) : null;

  if (!h && opts.allowGetContext && typeof c.getContext === 'function') {
    const ctx = c.getContext();
    values = ctx?.values ?? null;
    user = ctx?.user ?? {};
    stableID = ctx?.stableID ?? null;
    options = ctx?.options ?? {};
    sessionID = ctx?.session?.data?.sessionID ?? null;
  }

  const g = getStatsigGlobal();
  const sr = g?.srInstances?.[sdkKey] ?? g?.firstSRInstance ?? null;
  const valuesRec = asRecord(values);
  const metadata = asRecord(valuesRec?.sdkParams) ?? asRecord((c as { statsigMetadata?: unknown }).statsigMetadata);

  const evaluations = readEvaluations(c, valuesRec);
  const lastDetails =
    evaluations.find((e) => e.details)?.details ?? null;
  const bootstrapped =
    evaluations.some((e) => e.details && isBootstrap(e.details.reason)) ||
    (lastDetails != null && isBootstrap(lastDetails.reason));

  const sdkVersion =
    (typeof metadata?.sdkVersion === 'string' && metadata.sdkVersion) ||
    (typeof (c as { sdkVersion?: string }).sdkVersion === 'string' &&
      (c as { sdkVersion?: string }).sdkVersion) ||
    null;

  return {
    sdkKey,
    sdkKeyMasked: maskSdkKey(sdkKey),
    flavor: 'js-client',
    sdkVersion,
    loadingStatus: c.loadingStatus ?? 'Uninitialized',
    user: redactUser(user, redact),
    stableID,
    sessionID,
    environmentTier: options?.environment?.tier ?? null,
    hasValues: values != null,
    gateCount: countKeys(valuesRec?.feature_gates),
    configCount: countKeys(valuesRec?.dynamic_configs),
    layerCount: countKeys(valuesRec?.layer_configs),
    namesAreHashed: (valuesRec?.hash_used ?? 'djb2') !== 'none',
    bootstrapped,
    autocapturePresent: Boolean(g?.acInstances?.[sdkKey]),
    disabledAutocaptureEvents: Object.keys(
      asRecord(asRecord(valuesRec?.auto_capture_settings)?.disabled_events) ?? {},
    ),
    replay: readReplay(values, sr),
    lastEvaluationDetails: lastDetails,
    evaluations,
    customEndpoints: {
      api: options?.networkConfig?.api,
      initializeUrl: options?.networkConfig?.initializeUrl,
      logEventUrl: options?.networkConfig?.logEventUrl,
    },
  };
}

function readEvaluations(
  client: ModernClient,
  values: Record<string, unknown> | null,
): EvaluationRecord[] {
  if (!values) return [];
  const out: EvaluationRecord[] = [];
  const gates = asRecord(values.feature_gates) ?? {};
  for (const [name, raw] of Object.entries(gates)) {
    const rec = asRecord(raw);
    let details: EvaluationDetailsLike | null = detailsFromEval(rec?.details);
    let value = rec?.value;
    let ruleID = typeof rec?.rule_id === 'string' ? rec.rule_id : undefined;
    if (typeof client.getFeatureGate === 'function') {
      try {
        const gate = client.getFeatureGate(name, { disableExposureLog: true });
        value = gate?.value ?? value;
        ruleID = gate?.ruleID ?? ruleID;
        details = gate?.details ?? details;
      } catch {
        /* never throw into the host page */
      }
    }
    out.push({ kind: 'gate', name, value, ruleID, details });
  }
  const configs = asRecord(values.dynamic_configs) ?? {};
  for (const [name, raw] of Object.entries(configs)) {
    const rec = asRecord(raw);
    out.push({
      kind: 'config',
      name,
      value: rec?.value,
      ruleID: typeof rec?.rule_id === 'string' ? rec.rule_id : undefined,
      details: detailsFromEval(rec?.details),
    });
  }
  const layers = asRecord(values.layer_configs) ?? {};
  for (const [name, raw] of Object.entries(layers)) {
    const rec = asRecord(raw);
    out.push({
      kind: 'layer',
      name,
      value: rec?.value,
      ruleID: typeof rec?.rule_id === 'string' ? rec.rule_id : undefined,
      details: detailsFromEval(rec?.details),
    });
  }
  return out;
}

export function readLegacy(
  client: unknown,
  sdkKey: string,
  redact: RedactOptions,
): InstanceSnapshot {
  const rec = client as {
    sdkKey?: string;
    store?: { userValues?: Record<string, unknown> };
    identity?: { user?: unknown; stableID?: string };
    options?: { environment?: { tier?: string } };
  };
  const values = rec.store?.userValues ?? null;
  const valuesRec = asRecord(values);
  const g = getStatsigGlobal();
  return {
    sdkKey,
    sdkKeyMasked: maskSdkKey(sdkKey),
    flavor: 'legacy-statsig-js',
    sdkVersion: null,
    loadingStatus: values ? 'Ready' : 'Uninitialized',
    user: redactUser(rec.identity?.user ?? {}, redact),
    stableID: rec.identity?.stableID ?? null,
    sessionID: null,
    environmentTier: rec.options?.environment?.tier ?? null,
    hasValues: values != null,
    gateCount: countKeys(valuesRec?.feature_gates),
    configCount: countKeys(valuesRec?.dynamic_configs),
    layerCount: countKeys(valuesRec?.layer_configs),
    namesAreHashed: true,
    bootstrapped: false,
    autocapturePresent: Boolean(g?.acInstances?.[sdkKey]),
    disabledAutocaptureEvents: [],
    replay: readReplay(values, g?.srInstances?.[sdkKey] ?? g?.firstSRInstance),
    lastEvaluationDetails: null,
    evaluations: [],
    customEndpoints: {},
  };
}

export function readInstance(
  flavor: 'js-client' | 'legacy-statsig-js' | 'unknown',
  client: unknown,
  sdkKey: string,
  redact: RedactOptions,
  opts: { allowGetContext?: boolean } = {},
): InstanceSnapshot {
  if (flavor === 'legacy-statsig-js') return readLegacy(client, sdkKey, redact);
  return readModern(client, sdkKey, redact, opts);
}

export function extraHostsFromInstances(
  instances: InstanceSnapshot[],
): string[] {
  const hosts: string[] = [];
  for (const inst of instances) {
    if (inst.customEndpoints.api) hosts.push(inst.customEndpoints.api);
    if (inst.customEndpoints.initializeUrl) hosts.push(inst.customEndpoints.initializeUrl);
    if (inst.customEndpoints.logEventUrl) hosts.push(inst.customEndpoints.logEventUrl);
  }
  return hosts;
}

export { findClients };
