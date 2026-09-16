export type SdkFlavor = 'js-client' | 'legacy-statsig-js' | 'unknown';
export type LoadingStatus = 'Uninitialized' | 'Loading' | 'Ready';

/** Mirrors @statsig/client-core EvaluationDetails. */
export interface EvaluationDetailsLike {
  reason: string; // "Network:Recognized", "Cache:Unrecognized", "Loading:Unrecognized", ...
  lcut?: number;
  receivedAt?: number;
  warnings?: Array<
    | 'PartialUserMatch'
    | 'StableIDMismatch'
    | 'MultipleInitializations'
    | 'NoCachedValues'
  >;
}

/** Already redacted in the probe. Never contains privateAttributes. */
export interface StatsigUserLike {
  userID?: string;
  customIDs?: Record<string, string>;
  email?: string;
  country?: string;
  locale?: string;
  appVersion?: string;
  custom?: Record<string, unknown>;
}

export type RecordingStatus =
  | 'recording'
  | 'stopped'
  | 'plugin_missing'
  | 'blocked'
  | 'targeting_gate_failed'
  | 'not_eligible'
  | 'no_values'
  | 'unknown';

export interface ReplayState {
  status: RecordingStatus;
  pluginPresent: boolean;
  isRecording: boolean | null; // null when the SDK build predates isRecording()
  canRecordSession: boolean | null;
  passesTargeting: boolean | null;
  recordingBlocked: boolean | null;
  samplingRate: number | null; // values.session_recording_rate
}

export interface NetworkCall {
  id: string;
  kind: 'initialize' | 'rgstr' | 'dcs' | 'other';
  url: string;
  method: string;
  status: number | null; // null means the request never resolved (blocked / offline)
  ok: boolean;
  startedAt: number;
  durationMs: number | null;
  error?: string;
}

export interface InspectorEvent {
  id: string;
  at: number;
  kind: 'custom' | 'autocapture' | 'exposure' | 'flush' | 'sdk_error';
  name: string;
  value?: string | number;
  metadata?: Record<string, unknown>;
  /** For autocapture clicks: the CSS selector the SDK recorded, used by the hover inspector. */
  selector?: string;
}

export interface EvaluationRecord {
  kind: 'gate' | 'config' | 'layer';
  name: string;
  value: unknown;
  ruleID?: string;
  details: EvaluationDetailsLike | null;
}

export interface InstanceSnapshot {
  sdkKey: string;
  sdkKeyMasked: string; // "client-abc123...xyz"
  flavor: SdkFlavor;
  sdkVersion: string | null;
  loadingStatus: LoadingStatus;
  user: StatsigUserLike;
  stableID: string | null;
  sessionID: string | null;
  environmentTier: string | null;
  /** Derived from getContextHandle().values — NOT the raw payload. */
  hasValues: boolean;
  gateCount: number;
  configCount: number;
  layerCount: number;
  /** True when names in the payload are hashed (the normal case). */
  namesAreHashed: boolean;
  bootstrapped: boolean;
  autocapturePresent: boolean;
  disabledAutocaptureEvents: string[];
  replay: ReplayState;
  lastEvaluationDetails: EvaluationDetailsLike | null;
  evaluations: EvaluationRecord[];
  customEndpoints: { api?: string; initializeUrl?: string; logEventUrl?: string };
}

export interface StatsigSnapshot {
  takenAt: number;
  pageUrl: string;
  sdkDetected: boolean;
  /** Set when a global exists but no usable client instance was found. */
  detectionNote?: string;
  instances: InstanceSnapshot[];
  activeSdkKey: string | null;
  network: NetworkCall[];
  events: InspectorEvent[];
  probeStartedAt: number;
}

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';

export interface CheckResult {
  id: string; // stable id, e.g. 'sdk-initialized'
  title: string; // "Statsig is initialized"
  status: CheckStatus;
  summary: string; // one plain-English sentence for a non-engineer
  detail?: string; // what to tell engineering
  docsUrl?: string;
}
