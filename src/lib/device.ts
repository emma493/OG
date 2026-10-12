/** Device + country display helpers for Analytics (no map to maintain). */

export type OgDeviceType = 'Mobile' | 'Tablet' | 'Desktop';

/** Same heuristic as the edge function — gives retroactive splits for legacy events. */
export function deviceTypeFromUA(ua: string): OgDeviceType {
  const u = String(ua || '');
  if (/ipad|tablet/i.test(u)) return 'Tablet';
  if (/mobile|android|iphone|ipod|phone/i.test(u)) return 'Mobile';
  return 'Desktop';
}

export function normalizeDeviceType(v: unknown, ua = ''): OgDeviceType {
  if (v === 'Mobile' || v === 'Tablet' || v === 'Desktop') return v;
  return deviceTypeFromUA(ua);
}

/** Generic flag emoji derived from any ISO-2 code (no country map needed). */
export function countryFlag(code: string): string {
  const upper = (code || '').toUpperCase();
  if (upper.length !== 2) return '🌐';
  try {
    return String.fromCodePoint(...upper.split('').map((c) => 127397 + c.charCodeAt(0)));
  } catch {
    return '🌐';
  }
}
