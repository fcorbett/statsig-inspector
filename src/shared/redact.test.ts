import { describe, expect, it } from 'vitest';
import { hasIdentifiableUser, maskEmail, maskSdkKey, redactUser } from './redact';

describe('maskSdkKey', () => {
  it('masks long client keys to first 12 and last 4', () => {
    expect(maskSdkKey('client-inspector-offline')).toBe('client-inspe...line');
  });

  it('shortens very short keys without exposing the middle', () => {
    expect(maskSdkKey('client-short')).toBe('clie…rt');
  });
});

describe('maskEmail', () => {
  it('keeps the first character and domain', () => {
    expect(maskEmail('test@example.com')).toBe('t***@example.com');
  });

  it('returns *** when there is no domain', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });
});

describe('redactUser', () => {
  it('always drops privateAttributes', () => {
    const out = redactUser({
      userID: 'u1',
      email: 'ada@example.com',
      privateAttributes: { ssn: '000-00-0000' },
    });
    expect(out).toEqual({
      userID: 'u1',
      email: 'a***@example.com',
    });
    expect(out).not.toHaveProperty('privateAttributes');
  });

  it('keeps the full email when showFullValues is on', () => {
    const out = redactUser(
      { email: 'ada@example.com' },
      { showFullValues: true },
    );
    expect(out.email).toBe('ada@example.com');
  });

  it('returns an empty object for non-objects', () => {
    expect(redactUser(null)).toEqual({});
    expect(redactUser('user')).toEqual({});
  });
});

describe('hasIdentifiableUser', () => {
  it('is true for userID or a non-empty custom ID', () => {
    expect(hasIdentifiableUser({ userID: 'u1' })).toBe(true);
    expect(hasIdentifiableUser({ customIDs: { orgID: 'acme' } })).toBe(true);
    expect(hasIdentifiableUser({})).toBe(false);
  });
});
