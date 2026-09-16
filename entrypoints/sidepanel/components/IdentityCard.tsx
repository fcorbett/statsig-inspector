import type { InstanceSnapshot } from '../../../src/shared/types';
import { usersTabUrl } from '../../../src/shared/consoleApi';
import './cards.css';

export function IdentityCard({ instance }: { instance: InstanceSnapshot | null }) {
  if (!instance) {
    return (
      <section className="card">
        <h2>Identity</h2>
        <p className="note">No Statsig client detected yet.</p>
      </section>
    );
  }
  const href = usersTabUrl({
    userID: instance.user.userID,
    stableID: instance.stableID,
  });
  return (
    <section className="card">
      <h2>Identity</h2>
      <dl className="kv">
        <dt>userID</dt>
        <dd className="mono">{instance.user.userID ?? '—'}</dd>
        <dt>stableID</dt>
        <dd className="mono">{instance.stableID ?? '—'}</dd>
        <dt>sessionID</dt>
        <dd className="mono">{instance.sessionID ?? '—'}</dd>
        <dt>email</dt>
        <dd>{instance.user.email ?? '—'}</dd>
        <dt>environment</dt>
        <dd>{instance.environmentTier ?? 'production (unset)'}</dd>
        <dt>SDK key</dt>
        <dd className="mono">{instance.sdkKeyMasked}</dd>
        <dt>flavor</dt>
        <dd>{instance.flavor}</dd>
      </dl>
      <p className="note">
        Client recordings key on <span className="mono">stableID</span>. A server
        exposure keyed only on userID will not match a recording.
      </p>
      <p>
        <a href={href} target="_blank" rel="noreferrer">
          Open Users tab in Statsig Console
        </a>
      </p>
    </section>
  );
}
