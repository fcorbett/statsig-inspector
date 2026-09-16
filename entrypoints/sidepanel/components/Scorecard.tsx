import type { CheckResult } from '../../../src/shared/types';
import { overallStatus } from '../../../src/shared/checks';
import './cards.css';

export function Scorecard({ checks }: { checks: CheckResult[] }) {
  const overall = overallStatus(checks);
  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  return (
    <section className="scorecard">
      <div className="score-head">
        <h2>Verify</h2>
        <div className="score-counts">
          {overall.toUpperCase()} · {fails} fail · {warns} warn
        </div>
      </div>
      {checks.map((check) => (
        <article key={check.id} className={`check ${check.status}`}>
          <span className="dot" />
          <div>
            <h3>{check.title}</h3>
            <p>{check.summary}</p>
            {check.detail ? <p className="detail">{check.detail}</p> : null}
            {check.docsUrl ? (
              <a href={check.docsUrl} target="_blank" rel="noreferrer">
                Docs
              </a>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
