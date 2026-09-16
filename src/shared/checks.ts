import { hasIdentifiableUser } from './redact';
import { isUnrecognized, reasonSource } from './reason';
import { notEligibleSummary, replayCopy } from './replay';
import type {
  CheckResult,
  CheckStatus,
  InstanceSnapshot,
  NetworkCall,
  StatsigSnapshot,
} from './types';

const DOCS = {
  install:
    'https://docs.statsig.com/client/javascript-sdk',
  environments:
    'https://docs.statsig.com/guides/using-environments',
  debugging: 'https://docs.statsig.com/sdks/debugging',
  sessionReplay: 'https://docs.statsig.com/session-replay/overview',
  autocapture: 'https://docs.statsig.com/webanalytics/overview',
  bootstrap: 'https://docs.statsig.com/client/javascript-sdk#statsig-options',
};

function check(
  id: string,
  title: string,
  status: CheckStatus,
  summary: string,
  extra: Partial<CheckResult> = {},
): CheckResult {
  return { id, title, status, summary, ...extra };
}

function activeInstance(snapshot: StatsigSnapshot): InstanceSnapshot | null {
  if (snapshot.instances.length === 0) return null;
  return (
    snapshot.instances.find((i) => i.sdkKey === snapshot.activeSdkKey) ??
    snapshot.instances[0] ??
    null
  );
}

function initializeCalls(network: NetworkCall[]): NetworkCall[] {
  return network.filter((n) => n.kind === 'initialize');
}

function rgstrCalls(network: NetworkCall[]): NetworkCall[] {
  return network.filter((n) => n.kind === 'rgstr');
}

export function runChecks(snapshot: StatsigSnapshot): CheckResult[] {
  const instance = activeInstance(snapshot);
  const results: CheckResult[] = [];

  results.push(sdkPresent(snapshot));
  results.push(sdkInitialized(snapshot, instance));
  results.push(valuesLoaded(snapshot, instance));
  results.push(hasUserId(snapshot, instance));
  results.push(stableId(snapshot, instance));
  results.push(environment(snapshot, instance));
  results.push(networkInitialize(snapshot, instance));
  results.push(networkLogging(snapshot, instance));
  results.push(evalReason(snapshot, instance));
  results.push(bootstrapWarnings(snapshot, instance));
  results.push(multipleInits(snapshot, instance));
  results.push(unrecognizedAll(snapshot, instance));
  results.push(replayCheck(snapshot, instance));
  results.push(autocapture(snapshot, instance));

  return results;
}

function sdkPresent(snapshot: StatsigSnapshot): CheckResult {
  if (snapshot.sdkDetected && snapshot.instances.length > 0) {
    return check(
      'sdk-present',
      'Statsig is installed',
      'pass',
      snapshot.instances.length > 1
        ? `${snapshot.instances.length} Statsig clients were found on this page.`
        : 'Statsig is installed on this page.',
    );
  }
  if (
    snapshot.detectionNote === 'iframe-only' ||
    snapshot.detectionNote === 'top-frame-empty'
  ) {
    return check(
      'sdk-present',
      'Statsig is installed',
      'fail',
      'No Statsig SDK was found in the top frame. v1 only inspects the top frame, not iframes.',
      { detail: snapshot.detectionNote },
    );
  }
  return check(
    'sdk-present',
    'Statsig is installed',
    'fail',
    "Statsig isn't installed on this page, or it loads after this check ran.",
    { docsUrl: DOCS.install },
  );
}

function sdkInitialized(
  snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  if (!instance) {
    return check(
      'sdk-initialized',
      'Statsig is initialized',
      'fail',
      'No Statsig client is available to initialize.',
    );
  }
  if (instance.loadingStatus === 'Ready') {
    return check(
      'sdk-initialized',
      'Statsig is initialized',
      'pass',
      'The SDK finished initializing.',
    );
  }
  const waitedMs = snapshot.takenAt - snapshot.probeStartedAt;
  if (instance.loadingStatus === 'Loading' && waitedMs < 5000) {
    return check(
      'sdk-initialized',
      'Statsig is initialized',
      'unknown',
      'The SDK is still initializing.',
    );
  }
  return check(
    'sdk-initialized',
    'Statsig is initialized',
    'fail',
    'The SDK loaded but never finished initializing.',
    {
      detail: `loadingStatus=${instance.loadingStatus}`,
      docsUrl: DOCS.debugging,
    },
  );
}

function valuesLoaded(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  if (!instance) {
    return check(
      'values-loaded',
      'Flag values loaded',
      'fail',
      'No flag values were received for this user.',
    );
  }
  if (instance.hasValues) {
    return check(
      'values-loaded',
      'Flag values loaded',
      'pass',
      instance.bootstrapped
        ? `Values were bootstrapped (${instance.gateCount} gates, ${instance.configCount} configs, ${instance.layerCount} layers).`
        : `Flag values loaded (${instance.gateCount} gates, ${instance.configCount} configs, ${instance.layerCount} layers).`,
    );
  }
  return check(
    'values-loaded',
    'Flag values loaded',
    'fail',
    'No flag values were received for this user.',
    { docsUrl: DOCS.debugging },
  );
}

function hasUserId(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  if (!instance) {
    return check(
      'has-user-id',
      'A user ID is set',
      'fail',
      "No user ID is being sent, so this traffic can't be tied to a person.",
    );
  }
  if (hasIdentifiableUser(instance.user)) {
    return check(
      'has-user-id',
      'A user ID is set',
      'pass',
      instance.user.userID
        ? `userID is ${instance.user.userID}.`
        : 'A custom ID is set, so this traffic can be tied to a person.',
    );
  }
  return check(
    'has-user-id',
    'A user ID is set',
    'fail',
    "No user ID is being sent, so this traffic can't be tied to a person.",
    {
      detail:
        'Pass userID or customIDs to StatsigClient. Logged-out traffic can still use stableID.',
    },
  );
}

function stableId(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  if (!instance) {
    return check(
      'stable-id',
      'A stable ID is set',
      'fail',
      "No stable device ID, so logged-out experiments won't bucket consistently.",
    );
  }
  if (instance.stableID) {
    return check(
      'stable-id',
      'A stable ID is set',
      'pass',
      `stableID is ${instance.stableID}.`,
    );
  }
  return check(
    'stable-id',
    'A stable ID is set',
    'fail',
    "No stable device ID, so logged-out experiments won't bucket consistently.",
  );
}

function environment(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  if (!instance) {
    return check(
      'environment',
      'Environment tier is set',
      'warn',
      'No environment set, so this page counts as production.',
      { docsUrl: DOCS.environments },
    );
  }
  if (instance.environmentTier) {
    return check(
      'environment',
      'Environment tier is set',
      'pass',
      `Environment is ${instance.environmentTier}.`,
    );
  }
  return check(
    'environment',
    'Environment tier is set',
    'warn',
    'No environment set, so this page counts as production.',
    { docsUrl: DOCS.environments },
  );
}

function networkInitialize(
  snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  const calls = initializeCalls(snapshot.network);
  const blocked = calls.find((c) => c.status == null);
  const ok = calls.find((c) => c.ok);
  const attempted = calls.find((c) => c.status != null);

  if (blocked) {
    return check(
      'network-initialize',
      'Initialize reached Statsig',
      'fail',
      "Statsig's initialize request never resolved — often an ad blocker. Treat this as likely, not certain.",
      {
        detail: blocked.error ?? blocked.url,
        docsUrl: DOCS.debugging,
      },
    );
  }

  if (instance?.bootstrapped || (instance?.hasValues && calls.length === 0)) {
    return check(
      'network-initialize',
      'Initialize reached Statsig',
      'pass',
      'Values were bootstrapped (no initialize request). That is expected for SSR.',
      { docsUrl: DOCS.bootstrap },
    );
  }

  if (ok) {
    return check(
      'network-initialize',
      'Initialize reached Statsig',
      'pass',
      'Initialize reached Statsig successfully.',
    );
  }

  if (attempted) {
    return check(
      'network-initialize',
      'Initialize reached Statsig',
      instance?.hasValues ? 'warn' : 'fail',
      `Initialize was attempted but the server responded ${attempted.status}.`,
      { detail: attempted.url },
    );
  }

  return check(
    'network-initialize',
    'Initialize reached Statsig',
    'fail',
    "Statsig's servers were never reached — often an ad blocker.",
    { docsUrl: DOCS.debugging },
  );
}

function networkLogging(
  snapshot: StatsigSnapshot,
  _instance: InstanceSnapshot | null,
): CheckResult {
  const interesting = snapshot.events.filter(
    (e) => e.kind === 'custom' || e.kind === 'autocapture' || e.kind === 'flush',
  );
  const calls = rgstrCalls(snapshot.network);
  const attempted = calls.find((c) => c.status != null);
  const blocked = calls.find((c) => c.status == null);

  if (interesting.length === 0 && calls.length === 0) {
    return check(
      'network-logging',
      'Events are being sent',
      'unknown',
      'No events have been logged yet.',
    );
  }

  if (blocked && !attempted) {
    return check(
      'network-logging',
      'Events are being sent',
      'fail',
      'An event flush never resolved — often an ad blocker.',
      { detail: blocked.url },
    );
  }

  if (attempted) {
    return check(
      'network-logging',
      'Events are being sent',
      'pass',
      attempted.ok
        ? 'Events were sent to Statsig.'
        : `Logging was attempted (HTTP ${attempted.status}). A rejected flush still means the SDK tried to send — not an ad blocker.`,
    );
  }

  if (interesting.length > 0 && calls.length === 0) {
    const oldest = Math.min(...interesting.map((e) => e.at));
    if (snapshot.takenAt - oldest > 30_000) {
      return check(
        'network-logging',
        'Events are being sent',
        'warn',
        'Events are being queued but not sent.',
      );
    }
    return check(
      'network-logging',
      'Events are being sent',
      'unknown',
      'Events are queued and a flush has not been observed yet.',
    );
  }

  return check(
    'network-logging',
    'Events are being sent',
    'unknown',
    'Event logging status is not yet known.',
  );
}

function evalReason(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  const details =
    instance?.lastEvaluationDetails ??
    instance?.evaluations.find((e) => e.details)?.details ??
    null;
  if (!details) {
    return check(
      'eval-reason',
      'Flags were evaluated after init',
      'unknown',
      'No flag evaluations have been observed yet.',
    );
  }
  const source = reasonSource(details.reason);
  if (source === 'NoValues' || source === 'Uninitialized' || source === 'Loading') {
    return check(
      'eval-reason',
      'Flags were evaluated after init',
      'fail',
      'Flags were checked before the SDK was ready.',
      { detail: details.reason, docsUrl: DOCS.debugging },
    );
  }
  return check(
    'eval-reason',
    'Flags were evaluated after init',
    'pass',
    `Latest evaluation reason is ${details.reason}.`,
  );
}

function bootstrapWarnings(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  const warnings = collectWarnings(instance);
  const mismatch = warnings.filter(
    (w) => w === 'StableIDMismatch' || w === 'PartialUserMatch',
  );
  if (mismatch.length > 0) {
    return check(
      'bootstrap-warnings',
      'Bootstrap matches this user',
      'fail',
      'The server and browser disagree about who this user is.',
      { detail: mismatch.join(', '), docsUrl: DOCS.bootstrap },
    );
  }
  return check(
    'bootstrap-warnings',
    'Bootstrap matches this user',
    'pass',
    instance?.bootstrapped
      ? 'Bootstrap values match this client user.'
      : 'No bootstrap user mismatch.',
  );
}

function multipleInits(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  const warnings = collectWarnings(instance);
  if (warnings.includes('MultipleInitializations')) {
    return check(
      'multiple-inits',
      'Initialized once',
      'warn',
      'Statsig was initialized more than once on this page.',
    );
  }
  return check(
    'multiple-inits',
    'Initialized once',
    'pass',
    'No multiple-initialization warning.',
  );
}

function unrecognizedAll(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  const evals = instance?.evaluations ?? [];
  const withReason = evals.filter((e) => e.details?.reason);
  if (withReason.length === 0) {
    return check(
      'unrecognized-all',
      'Evaluations match this project',
      'unknown',
      'Not enough evaluations to judge whether this SDK key matches the project.',
    );
  }
  const unrecognized = withReason.filter((e) =>
    isUnrecognized(e.details!.reason),
  );
  if (unrecognized.length === withReason.length) {
    return check(
      'unrecognized-all',
      'Evaluations match this project',
      'fail',
      'This SDK key may belong to a different project or target app.',
      {
        detail:
          'Every observed evaluation was Unrecognized. A single Unrecognized default-false gate is expected and is not a failure.',
      },
    );
  }
  return check(
    'unrecognized-all',
    'Evaluations match this project',
    'pass',
    unrecognized.length > 0
      ? `${unrecognized.length} of ${withReason.length} evaluations are Unrecognized. That is normal for default-false gates omitted from the payload.`
      : 'Observed evaluations are recognized.',
  );
}

function replayCheck(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  if (!instance) {
    return check(
      'replay-status',
      'Session Replay',
      'fail',
      replayCopy('plugin_missing').summary,
      { docsUrl: DOCS.sessionReplay },
    );
  }
  const copy = replayCopy(instance.replay.status);
  const status: CheckStatus =
    instance.replay.status === 'recording'
      ? 'pass'
      : instance.replay.status === 'unknown' ||
          instance.replay.status === 'no_values'
        ? 'unknown'
        : instance.replay.status === 'not_eligible' ||
            instance.replay.status === 'stopped'
          ? 'warn'
          : 'fail';
  const summary =
    instance.replay.status === 'not_eligible'
      ? notEligibleSummary(instance.replay.samplingRate)
      : copy.summary;
  return check('replay-status', copy.title, status, summary, {
    detail: copy.detail,
    docsUrl: DOCS.sessionReplay,
  });
}

function autocapture(
  _snapshot: StatsigSnapshot,
  instance: InstanceSnapshot | null,
): CheckResult {
  if (!instance) {
    return check(
      'autocapture',
      'Autocapture is installed',
      'warn',
      "Clicks and page views aren't being captured automatically.",
      { docsUrl: DOCS.autocapture },
    );
  }
  if (instance.autocapturePresent) {
    const disabled = instance.disabledAutocaptureEvents;
    return check(
      'autocapture',
      'Autocapture is installed',
      'pass',
      disabled.length > 0
        ? `Autocapture is on. Disabled events: ${disabled.join(', ')}.`
        : 'Clicks and page views are being captured automatically.',
    );
  }
  return check(
    'autocapture',
    'Autocapture is installed',
    'warn',
    "Clicks and page views aren't being captured automatically.",
    { docsUrl: DOCS.autocapture },
  );
}

function collectWarnings(
  instance: InstanceSnapshot | null,
): NonNullable<InstanceSnapshot['lastEvaluationDetails']> extends never
  ? string[]
  : string[] {
  if (!instance) return [];
  const out = new Set<string>();
  if (instance.lastEvaluationDetails?.warnings) {
    for (const w of instance.lastEvaluationDetails.warnings) out.add(w);
  }
  for (const ev of instance.evaluations) {
    for (const w of ev.details?.warnings ?? []) out.add(w);
  }
  return [...out];
}

export function overallStatus(results: CheckResult[]): CheckStatus {
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'warn')) return 'warn';
  if (results.every((r) => r.status === 'unknown')) return 'unknown';
  return 'pass';
}
