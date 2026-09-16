import { describe, expect, it } from 'vitest';
import { classifyNetworkUrl, STATSIG_HOSTS } from './network';

describe('network classification', () => {
  it('matches current js-client hosts, not only legacy api.statsig.com', () => {
    expect(STATSIG_HOSTS.test('featureassets.org')).toBe(true);
    expect(STATSIG_HOSTS.test('prodregistryv2.org')).toBe(true);
    expect(STATSIG_HOSTS.test('api.statsigcdn.com')).toBe(true);
    expect(STATSIG_HOSTS.test('api.statsig.com')).toBe(true);
    expect(STATSIG_HOSTS.test('example.com')).toBe(false);
  });

  it('classifies initialize, rgstr, and dcs paths', () => {
    expect(classifyNetworkUrl('https://featureassets.org/v1/initialize')).toBe(
      'initialize',
    );
    expect(classifyNetworkUrl('https://prodregistryv2.org/v1/rgstr')).toBe(
      'rgstr',
    );
    expect(
      classifyNetworkUrl('https://api.statsigcdn.com/v1/download_config_specs'),
    ).toBe('dcs');
  });
});
