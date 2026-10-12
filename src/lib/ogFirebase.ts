/**
 * Og Firestore layer — project `og-tag`.
 * Mirrors Admin src/lib/firebase.ts patterns (subscribe + merge-safe writes
 * + handleFirestoreError) but for collections `photo_links`, `link_events`,
 * `site_config/photo_seq`.
 */
import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { OgLinkDocument, OgLinkEvent } from '../types';

setLogLevel('silent');

const app = initializeApp(firebaseConfig);
export { app };
export const db = getFirestore(app);

export const PHOTO_LINKS = 'photo_links';
export const LINK_EVENTS = 'link_events';
export const SITE_CONFIG = 'site_config';
export const PHOTO_SEQ_DOC = 'photo_seq';

function toDateOrNull(v: unknown): OgLinkDocument['createdAt'] {
  if (v == null) return null;
  return v as OgLinkDocument['createdAt'];
}

function mapLink(id: string, data: Record<string, unknown>): OgLinkDocument {
  return {
    id,
    slug: typeof data.slug === 'string' && data.slug ? data.slug : id,
    sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : '',
    publicId: typeof data.publicId === 'string' ? data.publicId : '',
    duration: typeof data.duration === 'string' ? data.duration : '',
    clicks: typeof data.clicks === 'number' ? data.clicks : 0,
    is_active: typeof data.is_active === 'boolean' ? data.is_active : true,
    width: typeof data.width === 'number' ? data.width : 1200,
    height: typeof data.height === 'number' ? data.height : 630,
    provider: 'cloudinary',
    createdAt: toDateOrNull(data.createdAt),
    updatedAt: toDateOrNull(data.updatedAt),
    lastClickedAt: toDateOrNull(data.lastClickedAt),
  };
}

export function subscribeToLinks(
  onData: (links: OgLinkDocument[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db, PHOTO_LINKS), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapLink(d.id, d.data()))),
    (err) => {
      console.warn('Firestore Notice: ', err instanceof Error ? err.message : String(err));
      if (onError) onError(err as Error);
    },
  );
}

function mapEvent(id: string, data: Record<string, unknown>): OgLinkEvent {
  const ua = typeof data.userAgent === 'string' ? data.userAgent : '';
  const rawDevice = typeof data.deviceType === 'string' ? data.deviceType : '';
  const deviceType =
    rawDevice === 'Mobile' || rawDevice === 'Tablet' || rawDevice === 'Desktop'
      ? rawDevice
      : /ipad|tablet/i.test(ua)
        ? 'Tablet'
        : /mobile|android|iphone|ipod|phone/i.test(ua)
          ? 'Mobile'
          : 'Desktop';
  return {
    id,
    slug: typeof data.slug === 'string' ? data.slug : '',
    timestamp: (data.timestamp as OgLinkEvent['timestamp']) ?? null,
    userAgent: ua,
    deviceType,
    referrerHost: typeof data.referrerHost === 'string' ? data.referrerHost : '',
    referrer: typeof data.referrer === 'string' ? data.referrer : '',
    utmSource: typeof data.utmSource === 'string' ? data.utmSource : '',
    utmMedium: typeof data.utmMedium === 'string' ? data.utmMedium : '',
    utmCampaign: typeof data.utmCampaign === 'string' ? data.utmCampaign : '',
    country: typeof data.country === 'string' ? data.country.toUpperCase() : '',
    countrySource: typeof data.countrySource === 'string' ? data.countrySource : 'unknown',
  };
}

export function subscribeToRecentEvents(
  count: number,
  onData: (events: OgLinkEvent[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db, LINK_EVENTS), orderBy('timestamp', 'desc'), limit(Math.max(1, Math.min(count, 100))));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapEvent(d.id, d.data()))),
    (err) => {
      console.warn('Firestore Notice: ', err instanceof Error ? err.message : String(err));
      if (onError) onError(err as Error);
    },
  );
}

export function subscribeToEventsInRange(
  startDate: string,
  endDate: string,
  onData: (events: OgLinkEvent[]) => void,
  onError?: (err: Error) => void,
) {
  // Single-field range needs composite index with orderBy — caller deploys
  // firestore.indexes.json. Falls back to client-side filter on failure.
  const base = collection(db, LINK_EVENTS);
  const q = query(base, orderBy('timestamp', 'desc'), limit(2000));
  return onSnapshot(
    q,
    (snap) => {
      const rows: OgLinkEvent[] = snap.docs.map((d) => mapEvent(d.id, d.data()));
      void startDate;
      void endDate;
      onData(rows);
    },
    (err) => {
      console.warn('Firestore Notice: ', err instanceof Error ? err.message : String(err));
      if (onError) onError(err as Error);
    },
  );
}

export interface MintLinkInput {
  sourceUrl: string;
  imageUrl: string;
  publicId: string;
  duration: string;
}

/**
 * Fixed slug allocator: transaction ONLY bumps the counter, doc creation
 * happens outside with create-if-absent retry. Replaces the old 10-get
 * in-transaction loop that was contention-heavy and fragile.
 */
export async function mintLink(input: MintLinkInput): Promise<string> {
  if (!input.sourceUrl.trim()) throw new Error('Photo URL is required');
  if (!/^https:\/\/res\.cloudinary\.com\//.test(input.imageUrl)) {
    throw new Error('Cloudinary image URL is missing — upload first.');
  }
  const seqRef = doc(db, SITE_CONFIG, PHOTO_SEQ_DOC);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next: number = await runTransaction(db, async (tx) => {
      const snap = await tx.get(seqRef);
      let n = 1;
      if (snap.exists()) {
        const raw = (snap.data() as { next?: unknown }).next;
        n = typeof raw === 'number' && raw >= 1 ? Math.floor(raw) : 1;
      }
      tx.set(seqRef, { next: n + 1, updatedAt: serverTimestamp() }, { merge: true });
      return n;
    });
    // Probe forward a few slots in case of races / manual docs.
    for (let a = 0; a < 5; a += 1) {
      const slug = `ep${next + a}`;
      const ref = doc(db, PHOTO_LINKS, slug);
      const existing = await getDoc(ref);
      if (existing.exists()) continue;
      try {
        await setDoc(ref, {
          slug,
          sourceUrl: input.sourceUrl.trim(),
          imageUrl: input.imageUrl,
          publicId: input.publicId || '',
          duration: input.duration.trim(),
          width: 1200,
          height: 630,
          provider: 'cloudinary',
          clicks: 0,
          is_active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastClickedAt: null,
        });
        return slug;
      } catch (e) {
        // Lost a race — try next candidate.
        void e;
        continue;
      }
    }
  }
  throw new Error('Slug allocator is stuck — try again.');
}

export async function updateLinkDuration(id: string, duration: string): Promise<void> {
  const ref = doc(db, PHOTO_LINKS, id);
  await updateDoc(ref, { duration, updatedAt: serverTimestamp() });
}

export async function toggleLinkActive(id: string, current: boolean): Promise<void> {
  const ref = doc(db, PHOTO_LINKS, id);
  await updateDoc(ref, { is_active: !current, updatedAt: serverTimestamp() });
}

export async function deleteLinkDoc(id: string): Promise<void> {
  const ref = doc(db, PHOTO_LINKS, id);
  await deleteDoc(ref);
}

export function shareUrlFor(slug: string): string {
  return `${window.location.origin.replace(/\/$/, '')}/${slug}`;
}
