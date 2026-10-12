import type { Timestamp } from 'firebase/firestore';

/** One baked OG short link: /epN -> Cloudinary 1200x630 preview. */
export interface OgLinkDocument {
  id: string; // == slug, e.g. "ep12"
  slug: string;
  sourceUrl: string;
  imageUrl: string;
  publicId: string;
  duration: string; // m:ss
  clicks: number;
  is_active: boolean;
  width: number;
  height: number;
  provider: 'cloudinary';
  createdAt: Timestamp | Date | number | null;
  updatedAt: Timestamp | Date | number | null;
  lastClickedAt: Timestamp | Date | number | null;
}

/** Per-click event written by the edge function (humans only). */
export interface OgLinkEvent {
  id: string;
  slug: string;
  timestamp: Timestamp | Date | number | null;
  userAgent: string;
  deviceType: string; // Mobile | Tablet | Desktop (edge-parsed, '' on legacy docs)
  referrerHost: string;
  referrer: string; // full referrer URL, truncated ('' when direct/legacy)
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  country: string; // ISO-2 from edge geo ('' = unknown / legacy)
  countrySource: string; // edge | unknown
}

export type DateRangePreset = 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all' | 'custom';
