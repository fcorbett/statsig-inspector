import { describe, expect, it } from 'vitest';
import { overallStatus, runChecks } from './checks';
import type {
  EvaluationRecord,
  InstanceSnapshot,
  ReplayState,
  StatsigSnapshot,
} from './types';

function replay(over: Partial<ReplayState> = {}): ReplayState {
  return {
    status: 'recording',
    pluginPresent: true,
    isRecording: true,
    canRecordSession: true,
    passesTargeting: true,
    recordingBlocked: false,
    samplingRate: 100,
    ...over,
  };
}

function instance(over: Partial<InstanceSnapshot> = {}): InstanceSnapshot {
  return {
    sdkKey: 'client-inspector-offline',
    sdkKeyMasked: 'client-inspe...line',
    flavor: 'js-client',
    sdkVersion: '3.0.0',
    loadingStatus: 'Ready',
    user: { userID: 'fixture-user-1', email: 't***@example.com' },
    stableID: 'stable-1',
    sessionID: 'session-1',
    environmentTier: 'development',
    hasValues: true,
    gateCount: 1,
    configCount: 0,
    layerCount: 0,
    namesAreHashed: true,
    bootstrapped: true,
    autocapturePresent: true,
    disabledAutocaptureEvents: [],
    replay: replay(),
    lastEvaluationDetails: { reason: 'Bootstrap:Recognized' },
    evaluations: [
      {
        kind: 'gate',
        name: 'a_gate',
        value: true,
        ruleID: 'fixture_rule',
        details: { reason: 'Bootstrap:Recognized' },
      },
    ],
    customEndpoints: {},
    ...over,
  };
}

function snapshot(over: Partial<StatsigSnapshot> = {}): StatsigSnapshot {
  const inst = over.instances?.[0] ?? instance();
  return {
    takenAt: 10_000,
    pageUrl: 'http://localhost:8787/',
    sdkDetected: true,
    instances: [inst],
    activeSdkKey: inst.sdkKey,
    network: [],
    events: [],
    probeStartedAt: 0,
    ...over,
  };
}

function byId(results: ReturnType<typeof runChecks>, id: string) {
  const found = results.find((r) => r.id === id);
  expect(found).toBeTruthy();
  return found!;
}

describe('runChecks', () => {
  it('passes a healthy bootstrapped install without an initialize call', () => {
    const results = runChecks(snapshot());
    expect(byId(results, 'sdk-present').status).toBe('pass');
    expect(byId(results, 'sdk-initialized').status).toBe('pass');
    expect(byId(results, 'values-loaded').status).toBe('pass');
    expect(byId(results, 'has-user-id').status).toBe('pass');
    expect(byId(results, 'network-initialize').status).toBe('pass');
    expect(byId(results, 'network-initialize').summary).toMatch(/bootstrap/i);
    expect(byId(results, 'replay-status').status).toBe('pass');
    expect(overallStatus(results)).not.toBe('fail');
  });

  it('fails missing user ID', () => {
    const results = runChecks(
      snapshot({
        instances: [instance({ user: {} })],
      }),
    );
    expect(byId(results, 'has-user-id').status).toBe('fail');
  });

  it('does not fail the scorecard for a single Unrecognized gate', () => {
    const evaluations: EvaluationRecord[] = [
      {
        kind: 'gate',
        name: 'a_gate',
        value: true,
        details: { reason: 'Network:Recognized' },
      },
      {
        kind: 'gate',
        name: 'default_false_gate',
        value: false,
        details: { reason: 'Network:Unrecognized' },
      },
    ];
    const results = runChecks(
      snapshot({
        instances: [
          instance({
            bootstrapped: false,
            lastEvaluationDetails: { reason: 'Network:Recognized' },
            evaluations,
          }),
        ],
      }),
    );
    expect(byId(results, 'unrecognized-all').status).toBe('pass');
  });

  it('fails when every evaluation is Unrecognized', () => {
    const results = runChecks(
      snapshot({
        instances: [
          instance({
            evaluations: [
              {
                kind: 'gate',
                name: 'a',
                value: false,
                details: { reason: 'Network:Unrecognized' },
              },
              {
                kind: 'gate',
                name: 'b',
                value: false,
                details: { reason: 'Cache:Unrecognized' },
              },
            ],
          }),
        ],
      }),
    );
    expect(byId(results, 'unrecognized-all').status).toBe('fail');
  });

  it('treats initialize status null as likely ad-block, not bootstrap', () => {
    const results = runChecks(
      snapshot({
        instances: [instance({ bootstrapped: false, hasValues: false })],
        network: [
          {
            id: '1',
            kind: 'initialize',
            url: 'https://featureassets.org/v1/initialize',
            method: 'POST',
            status: null,
            ok: false,
            startedAt: 1,
            durationMs: null,
            error: 'TypeError: Failed to fetch',
          },
        ],
      }),
    );
    expect(byId(results, 'network-initialize').status).toBe('fail');
    expect(byId(results, 'network-initialize').summary).toMatch(/ad blocker/i);
  });

  it('does not fail network-logging when rgstr was attempted and rejected', () => {
    const results = runChecks(
      snapshot({
        events: [
          {
            id: 'e1',
            at: 100,
            kind: 'autocapture',
            name: 'auto_capture::click',
          },
        ],
        network: [
          {
            id: 'n1',
            kind: 'rgstr',
            url: 'https://prodregistryv2.org/v1/rgstr',
            method: 'POST',
            status: 401,
            ok: false,
            startedAt: 200,
            durationMs: 30,
          },
        ],
      }),
    );
    expect(byId(results, 'network-logging').status).toBe('pass');
  });

  it('reports plugin_missing vs not_eligible distinctly', () => {
    const missing = runChecks(
      snapshot({
        instances: [
          instance({
            replay: replay({
              status: 'plugin_missing',
              pluginPresent: false,
              isRecording: null,
            }),
          }),
        ],
      }),
    );
    expect(byId(missing, 'replay-status').status).toBe('fail');
    expect(byId(missing, 'replay-status').summary).toMatch(/isn't installed/i);

    const sampled = runChecks(
      snapshot({
        instances: [
          instance({
            replay: replay({
              status: 'not_eligible',
              isRecording: false,
              canRecordSession: false,
              samplingRate: 10,
            }),
          }),
        ],
      }),
    );
    expect(byId(sampled, 'replay-status').status).toBe('warn');
    expect(byId(sampled, 'replay-status').summary).toMatch(/10%/);
  });

  it('splits Source:Reason independently', () => {
    const results = runChecks(
      snapshot({
        instances: [
          instance({
            lastEvaluationDetails: { reason: 'Loading:Unrecognized' },
            evaluations: [
              {
                kind: 'gate',
                name: 'x',
                value: false,
                details: { reason: 'Loading:Unrecognized' },
              },
            ],
          }),
        ],
      }),
    );
    expect(byId(results, 'eval-reason').status).toBe('fail');
    expect(byId(results, 'eval-reason').summary).toMatch(/before the SDK was ready/);
  });
});
