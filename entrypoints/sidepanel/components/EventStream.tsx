import type { InspectorEvent } from '../../../src/shared/types';
import './cards.css';

export function EventStream({
  events,
  onHighlight,
}: {
  events: InspectorEvent[];
  onHighlight: (selector: string) => void;
}) {
  const recent = [...events].reverse().slice(0, 50);
  return (
    <section className="card">
      <h2>Live events</h2>
      {recent.length === 0 ? (
        <p className="note">Click around the page. Autocapture and custom events appear here.</p>
      ) : (
        <ul className="event-list">
          {recent.map((event) => (
            <li key={event.id}>
              <span className="event-kind">{event.kind}</span>
              <span className="mono">{event.name}</span>
              {event.selector ? (
                <button
                  type="button"
                  onClick={() => onHighlight(event.selector!)}
                >
                  Highlight
                </button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
