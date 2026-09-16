import { describe, expect, it, vi } from 'vitest';
import {
  CONSOLE_GET_PATHS,
  consoleGet,
  nameMapFromConfigNames,
  usersTabUrl,
} from './consoleApi';
import { djb2 } from './hash';

describe('consoleApi', () => {
  it('only documents GET paths', () => {
    expect(CONSOLE_GET_PATHS.every((p) => p.startsWith('/console/v1/'))).toBe(
      true,
    );
  });

  it('issues GET with the Statsig header and never a mutating method', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe('GET');
      expect((init?.headers as Record<string, string>)['STATSIG-API-KEY']).toBe(
        'secret-test',
      );
      expect(String(url)).toContain('/gates');
      return new Response(JSON.stringify({ data: [{ name: 'a_gate' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const body = await consoleGet<{ data: { name: string }[] }>(
      '/gates',
      'secret-test',
      fetchImpl as unknown as typeof fetch,
    );
    expect(body.data[0]?.name).toBe('a_gate');
  });

  it('builds a hash map from Console names using the same djb2 as the SDK', () => {
    const map = nameMapFromConfigNames(['a_gate']);
    expect(map[djb2('a_gate')]).toBe('a_gate');
  });

  it('builds a Users-tab deep link', () => {
    expect(usersTabUrl({ userID: 'fixture-user-1' })).toContain(
      'userID=fixture-user-1',
    );
  });
});
