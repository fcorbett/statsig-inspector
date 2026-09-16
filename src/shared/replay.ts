import type { ReplayState } from './types';

const REPLAY_COPY: Record<
  ReplayState['status'],
  { title: string; summary: string; detail?: string }
> = {
  recording: {
    title: 'Session Replay is recording',
    summary: 'This session is being recorded.',
  },
  plugin_missing: {
    title: 'Session Replay is not installed',
    summary:
      "Session Replay isn't installed on this page. An engineer needs to add the @statsig/session-replay package.",
    detail: 'Call runStatsigSessionReplay(client) after constructing StatsigClient.',
  },
  blocked: {
    title: 'Session Replay is blocked',
    summary: 'Recording is blocked for this project.',
    detail: 'Check Project Settings → Analytics & Session Replay.',
  },
  targeting_gate_failed: {
    title: 'Session Replay targeting failed',
    summary:
      "This user doesn't pass the Session Replay targeting gate, so they will never be recorded.",
    detail: 'Project Settings → Analytics & Session Replay targeting gate.',
  },
  not_eligible: {
    title: 'Session Replay not sampled',
    summary: 'This user is eligible but was not sampled into the recording rate.',
    detail:
      'forceStartRecording bypasses the sample rate but still respects the targeting gate. It creates a real recording.',
  },
  stopped: {
    title: 'Session Replay stopped',
    summary:
      'Recording was started and then stopped, or autoStartRecording is off.',
  },
  no_values: {
    title: 'Session Replay status unknown',
    summary: "The SDK hasn't loaded values yet, so replay status is unknown.",
  },
  unknown: {
    title: 'Session Replay status unknown',
    summary:
      'The session-replay plugin is present but this SDK build does not expose isRecording().',
  },
};

export function replayCopy(status: ReplayState['status']) {
  return REPLAY_COPY[status];
}

export function notEligibleSummary(rate: number | null): string {
  const pct =
    rate == null ? 'your configured' : String(Math.round(rate * 100));
  if (rate != null && rate > 1) {
    return `This user is eligible but wasn't sampled. Your sample rate is ${rate}%.`;
  }
  return `This user is eligible but wasn't sampled. Your sample rate is ${pct}%.`;
}

/**
 * Mirrors SessionReplay._attemptToStartRecording field order.
 */
export function readReplay(values: unknown, sr: unknown): ReplayState {
  const pluginPresent = sr != null;
  const srObj = sr as { isRecording?: () => boolean } | null;
  const isRecording =
    typeof srObj?.isRecording === 'function'
      ? Boolean(srObj.isRecording())
      : null;

  const v = (values ?? null) as Record<string, unknown> | null;
  const base = {
    pluginPresent,
    isRecording,
    canRecordSession:
      typeof v?.can_record_session === 'boolean' ? v.can_record_session : null,
    passesTargeting:
      typeof v?.passes_session_recording_targeting === 'boolean'
        ? v.passes_session_recording_targeting
        : null,
    recordingBlocked:
      typeof v?.recording_blocked === 'boolean' ? v.recording_blocked : null,
    samplingRate:
      typeof v?.session_recording_rate === 'number'
        ? v.session_recording_rate
        : null,
  };

  if (!pluginPresent) return { ...base, status: 'plugin_missing' };
  if (v == null) return { ...base, status: 'no_values' };
  if (v.recording_blocked === true) return { ...base, status: 'blocked' };
  if (v.passes_session_recording_targeting === false) {
    return { ...base, status: 'targeting_gate_failed' };
  }
  if (v.can_record_session !== true) return { ...base, status: 'not_eligible' };
  if (isRecording === true) return { ...base, status: 'recording' };
  if (isRecording === false) return { ...base, status: 'stopped' };
  return { ...base, status: 'unknown' };
}
