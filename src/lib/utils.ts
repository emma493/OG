/**
 * Date + formatting helpers — ported from Admin src/lib/utils.ts.
 * Firestore Timestamp | Date | number | string tolerant.
 */

export function getFormattedDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateStrFromTimestamp(timestamp: unknown): string {
  if (!timestamp) return getFormattedDate(0);
  let date: Date;
  const t = timestamp as { toDate?: () => Date; toMillis?: () => number };
  if (t?.toDate && typeof t.toDate === 'function') {
    date = t.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    if (timestamp.length === 10 && timestamp.includes('-')) return timestamp;
    date = new Date(timestamp);
  } else {
    return getFormattedDate(0);
  }
  if (isNaN(date.getTime())) return getFormattedDate(0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
  if (!dateStr) return true;
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}

export function getPresetDates(preset: string): { startDate: string; endDate: string } {
  const today = getFormattedDate(0);
  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };
    case 'yesterday':
      return { startDate: getFormattedDate(1), endDate: getFormattedDate(1) };
    case '7days':
      return { startDate: getFormattedDate(6), endDate: today };
    case '30days':
      return { startDate: getFormattedDate(29), endDate: today };
    case 'thisMonth': {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return { startDate: monthStart, endDate: today };
    }
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
}

export function normalizeDateRange(start: string, end: string): { startDate: string; endDate: string } {
  const s = (start || '').trim();
  const e = (end || '').trim();
  if (s && e && s > e) return { startDate: e, endDate: s };
  return { startDate: s, endDate: e };
}

export function formatTimeAgo(timestamp: unknown): string {
  if (!timestamp) return 'Never';
  let date: Date;
  const t = timestamp as { toDate?: () => Date };
  if (t?.toDate && typeof t.toDate === 'function') {
    date = t.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return 'Just now';
  }
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function friendlyReason(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (code === 'permission-denied' || /permission|PERMISSION_DENIED/i.test(msg)) {
    return 'Write blocked by Firestore rules — deploy firestore.rules to the og-tag project, then retry.';
  }
  if (code === 'unauthenticated' || /auth|api-key|API_KEY/i.test(msg)) {
    return 'Not authorized — bad Firebase web config.';
  }
  if (code === 'unavailable' || /network|offline|Failed to fetch|Failed to get/i.test(msg)) {
    return 'Network error — check connection/adblocker and retry.';
  }
  if (code === 'failed-precondition' || /index/i.test(msg)) {
    return 'Firestore needs an index for this query — deploy firestore.indexes.json.';
  }
  return msg.slice(0, 200) || 'Failed. Try again.';
}
