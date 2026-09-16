import { describe, expect, it } from 'vitest';
import { readReplay } from './replay';

describe('readReplay', () => {
  const sr = { isRecording: () => true };

  it('plugin_missing when sr is absent', () => {
    expect(readReplay({ can_record_session: true }, null).status).toBe(
      'plugin_missing',
    );
  });

  it('no_values when values are missing', () => {
    expect(readReplay(null, sr).status).toBe('no_values');
  });

  it('blocked before targeting and sampling', () => {
    expect(
      readReplay(
        {
          recording_blocked: true,
          passes_session_recording_targeting: false,
          can_record_session: false,
        },
        sr,
      ).status,
    ).toBe('blocked');
  });

  it('targeting_gate_failed next', () => {
    expect(
      readReplay(
        {
          recording_blocked: false,
          passes_session_recording_targeting: false,
          can_record_session: false,
        },
        sr,
      ).status,
    ).toBe('targeting_gate_failed');
  });

  it('not_eligible when can_record_session is not true', () => {
    expect(
      readReplay(
        {
          recording_blocked: false,
          passes_session_recording_targeting: true,
          can_record_session: false,
          session_recording_rate: 10,
        },
        sr,
      ).status,
    ).toBe('not_eligible');
  });

  it('recording when isRecording() is true', () => {
    expect(
      readReplay(
        {
          recording_blocked: false,
          passes_session_recording_targeting: true,
          can_record_session: true,
        },
        sr,
      ).status,
    ).toBe('recording');
  });
});
