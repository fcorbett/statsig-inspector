import type { StatsigUserLike } from './types';

export function maskSdkKey(key: string): string {
  if (key.length <= 16) {
    return `${key.slice(0, 4)}…${key.slice(-2)}`;
  }
  return `${key.slice(0, 12)}...${key.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export interface RedactOptions {
  showFullValues?: boolean;
}

export function redactUser(
  user: unknown,
  options: RedactOptions = {},
): StatsigUserLike {
  if (!user || typeof user !== 'object') return {};
  const raw = user as Record<string, unknown>;
  const out: StatsigUserLike = {};

  if (typeof raw.userID === 'string') out.userID = raw.userID;
  if (raw.customIDs && typeof raw.customIDs === 'object') {
    out.customIDs = { ...(raw.customIDs as Record<string, string>) };
  }
  if (typeof raw.email === 'string') {
    out.email = options.showFullValues ? raw.email : maskEmail(raw.email);
  }
  if (typeof raw.country === 'string') out.country = raw.country;
  if (typeof raw.locale === 'string') out.locale = raw.locale;
  if (typeof raw.appVersion === 'string') out.appVersion = raw.appVersion;
  if (raw.custom && typeof raw.custom === 'object') {
    out.custom = { ...(raw.custom as Record<string, unknown>) };
  }
  // privateAttributes are intentionally dropped.
  return out;
}

export function hasIdentifiableUser(user: StatsigUserLike): boolean {
  if (user.userID && user.userID.length > 0) return true;
  const custom = user.customIDs ? Object.values(user.customIDs) : [];
  return custom.some((v) => typeof v === 'string' && v.length > 0);
}
