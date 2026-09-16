export const STATSIG_HOSTS =
  /(^|\.)(featureassets\.org|prodregistryv2\.org|statsigapi\.net|statsigcdn\.com|statsig\.com)$/i;

export function hostOf(url: string): string {
  try {
    return new URL(url, location.href).hostname;
  } catch {
    return '';
  }
}

export function classifyNetworkUrl(
  url: string,
): 'initialize' | 'rgstr' | 'dcs' | 'other' {
  if (url.includes('/initialize')) return 'initialize';
  if (url.includes('/rgstr') || url.includes('/log_event')) return 'rgstr';
  if (url.includes('/download_config_specs')) return 'dcs';
  return 'other';
}

export function isStatsigUrl(url: string, extraHosts: string[] = []): boolean {
  const host = hostOf(url);
  if (STATSIG_HOSTS.test(host)) return true;
  return extraHosts.some((h) => {
    if (!h) return false;
    try {
      const extraHost = h.startsWith('http') ? new URL(h).hostname : h;
      return host === extraHost || url.includes(h);
    } catch {
      return url.includes(h);
    }
  });
}

export function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}
