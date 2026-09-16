import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('session-idle safety', () => {
  it('never calls getContext() from the probe poller', () => {
    const probe = readFileSync('entrypoints/probe.content.ts', 'utf8');
    expect(probe).not.toMatch(/getContext\s*\(/);
    expect(probe).toMatch(/collectAndPost\(true\)/);
    expect(probe).toMatch(/REFRESH_SNAPSHOT/);
  });

  it('only allows getContext() on an explicit user-triggered refresh', () => {
    const source = readFileSync('src/probe/readClient.ts', 'utf8');
    const fallback = source.slice(source.indexOf('if (!h && opts.allowGetContext'));
    expect(fallback).toMatch(/c\.getContext\(\)/);
    expect(source).toMatch(/NEVER call client\.getContext\(\) on a timer/);
    expect(source).toMatch(/getSession\(false\)/);
  });
});
