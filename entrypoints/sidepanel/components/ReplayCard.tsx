import type { InstanceSnapshot } from '../../../src/shared/types';
import './cards.css';

export function ReplayCard({
  instance,
  onForceStart,
}: {
  instance: InstanceSnapshot | null;
  onForceStart: () => void;
}) {
  if (!instance) {
    return (
      <section className="card">
        <h2>Session Replay</h2>
        <p className="note">No client to inspect.</p>
      </section>
    );
  }
  const replay = instance.replay;
  return (
    <section className="card">
      <h2>Session Replay</h2>
      <dl className="kv">
        <dt>status</dt>
        <dd>{replay.status.replaceAll('_', ' ')}</dd>
        <dt>plugin</dt>
        <dd>{replay.pluginPresent ? 'installed' : 'missing'}</dd>
        <dt>isRecording()</dt>
        <dd>
          {replay.isRecording == null ? 'not available on this SDK' : String(replay.isRecording)}
        </dd>
        <dt>can_record_session</dt>
        <dd>{fmt(replay.canRecordSession)}</dd>
        <dt>targeting</dt>
        <dd>{fmt(replay.passesTargeting)}</dd>
        <dt>blocked</dt>
        <dd>{fmt(replay.recordingBlocked)}</dd>
        <dt>sample rate</dt>
        <dd>{replay.samplingRate == null ? '—' : String(replay.samplingRate)}</dd>
      </dl>
      {replay.status === 'not_eligible' ? (
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="primary" onClick={onForceStart}>
            Force start recording
          </button>
          <p className="note">
            Debug only. Bypasses sample rate, still respects the targeting gate, and
            creates a real recording.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function fmt(value: boolean | null): string {
  if (value == null) return '—';
  return value ? 'true' : 'false';
}
