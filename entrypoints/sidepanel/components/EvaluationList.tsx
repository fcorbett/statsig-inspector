import type { EvaluationRecord } from '../../../src/shared/types';
import { decodeName } from '../../../src/shared/hash';
import './cards.css';

export function EvaluationList({
  evaluations,
  nameMap,
}: {
  evaluations: EvaluationRecord[];
  nameMap: Record<string, string>;
}) {
  if (evaluations.length === 0) {
    return (
      <section className="card">
        <h2>Evaluations</h2>
        <p className="note">
          Hashed names look sparse until you connect a Console key. Identity,
          events, and replay still work without one.
        </p>
      </section>
    );
  }
  return (
    <section className="card">
      <h2>Evaluations</h2>
      {Object.keys(nameMap).length === 0 ? (
        <p className="note">Connect a Console key to see names.</p>
      ) : null}
      <div className="eval-list">
        {evaluations.map((ev) => {
          const decoded = decodeName(ev.name, nameMap);
          return (
            <div key={`${ev.kind}:${ev.name}`} className="eval-row">
              <span className="eval-kind">{ev.kind}</span>
              <div>
                <div className="mono">{decoded ?? ev.name}</div>
                {decoded && decoded !== ev.name ? (
                  <div className="note mono">{ev.name}</div>
                ) : null}
                <div className="note">{ev.details?.reason ?? 'no reason'}</div>
              </div>
              <span>{String(ev.value)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
