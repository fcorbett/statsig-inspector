import { describe, expect, it } from 'vitest';
import { isBootstrap, reasonResult, reasonSource } from './reason';

describe('evaluation reasons', () => {
  it('splits Source:Reason independently', () => {
    expect(reasonSource('Network:Recognized')).toBe('Network');
    expect(reasonResult('Network:Recognized')).toBe('Recognized');
    expect(reasonSource('Loading:Unrecognized')).toBe('Loading');
    expect(reasonResult('Loading:Unrecognized')).toBe('Unrecognized');
  });

  it('treats BootstrapStableIDMismatch as bootstrap', () => {
    expect(isBootstrap('Bootstrap:Recognized')).toBe(true);
    expect(isBootstrap('BootstrapStableIDMismatch:Recognized')).toBe(true);
    expect(isBootstrap('Network:Recognized')).toBe(false);
  });
});
