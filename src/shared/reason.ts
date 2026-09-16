export function splitReason(reason: string): {
  source: string;
  result: string;
} {
  const idx = reason.indexOf(':');
  if (idx === -1) return { source: reason, result: '' };
  return { source: reason.slice(0, idx), result: reason.slice(idx + 1) };
}

export function reasonSource(reason: string): string {
  return splitReason(reason).source;
}

export function reasonResult(reason: string): string {
  return splitReason(reason).result;
}

export function isUnrecognized(reason: string): boolean {
  return reasonResult(reason) === 'Unrecognized';
}

export function isBootstrap(reason: string): boolean {
  return reasonSource(reason).startsWith('Bootstrap');
}
