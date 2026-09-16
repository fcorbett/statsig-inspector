/**
 * Statsig client-core `_DJB2`: 32-bit djb2, returned as an unsigned decimal string.
 * https://github.com/statsig-io/js-client-monorepo/blob/main/packages/client-core/src/Hashing.ts
 */
export function djb2(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const character = value.charCodeAt(i);
    hash = ((hash << 5) - hash + character) | 0;
  }
  return String(hash >>> 0);
}

export function buildNameMap(names: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of names) {
    map[djb2(name)] = name;
    map[name] = name;
  }
  return map;
}

export function decodeName(
  hashedOrPlain: string,
  nameMap: Record<string, string>,
): string | null {
  return nameMap[hashedOrPlain] ?? null;
}
