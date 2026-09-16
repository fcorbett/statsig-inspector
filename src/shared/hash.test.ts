import { describe, expect, it } from 'vitest';
import { buildNameMap, decodeName, djb2 } from './hash';

describe('djb2', () => {
  it('matches Statsig client-core _DJB2 for a_gate', () => {
    expect(djb2('a_gate')).toBe('2867927529');
  });

  it('is stable and unsigned', () => {
    expect(djb2('statsig')).toMatch(/^\d+$/);
    expect(djb2('statsig')).toBe(djb2('statsig'));
  });

  it('decodes hashed names from a local map without a Console account', () => {
    const map = buildNameMap(['a_gate', 'checkout_experiment']);
    expect(decodeName(djb2('a_gate'), map)).toBe('a_gate');
    expect(decodeName('a_gate', map)).toBe('a_gate');
    expect(decodeName('missing', map)).toBeNull();
  });
});
