# Og Link Maker (v2 — Admin-style dashboard)

React 19 + Vite 6 + Tailwind 4 + Firebase (project `og-tag`).
Paste photo URLs → baked video-style thumbnails (1200×630, play button +
random duration pill) → Cloudinary → short links `/ep1`, `/ep2`, …
Each link keeps its own preview forever.

- ** humans**: `GET /epN` → white "Opening..." page → redirect after ~1s to
  `https://gerbonmovies.site/?from=epN` (click counted in the background).
- **Bots** (X / WhatsApp / Telegram …): same URL returns OG HTML with that
  link's own Cloudinary image + `Hot Video 💋 / Click to watch now`.

## Stack

- React SPA (`src/`), `npm run build` → `dist/`. Netlify publishes `dist/`.
- Firebase project **`og-tag`** (separate database): `photo_links`,
  `link_events` (per-click, edge-written), `site_config/photo_seq`.
- Cloudinary stays shared with shortxx
  (`nonzehj3` / unsigned preset `shortxx_preview`).

## Tabs (Admin design, Sidebar + mobile top bar)

| Route | Tab | Admin source |
| ----- | --- | ------------ |
| `/` | Dashboard — Total links, Total clicks, Clicks in range, Avg/link + DateRangeFilter | `DashboardPage` StatCard |
| `/add` | Add Links — bulk paste, bake queue (concurrency 3), progress, published/failed lists | `UploadPage` + `previewBake` + `videoUtils` |
| `/all` | All Links — read-only browse: search, sort (newest/most-clicked/slug), Hot/Cold/Visible/Hidden filters | `VideosPage` browse |
| `/manage` | Manage — edit pill, Hide/Show, true Delete with confirm modal | `VideosPage` manage |
| `/analytics` | Analytics — KPI strip, clicks trend (recharts), Top 10, live activity, Export CSV | `AnalyticsPage` |

## One-time setup

1. **Firestore rules + indexes** (required — without this, publish/history fail
   with `permission-denied`, analytics trend needs the index):
   ```sh
   firebase use og-tag
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   Sources: `firestore.rules`, `firestore.indexes.json` in this repo.
2. **Cloudinary preset**: unsigned preset `shortxx_preview`
   (folder `shortxx/previews`, jpg/png). Already exists — nothing to do
   unless uploads fail.
3. **Netlify**: New site → Import from GitHub → `OG`.
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Edge Functions are auto-detected from `netlify/edge-functions/`.
   - SPA fallback lives in `netlify.toml` (`/* → /index.html`); `/ep*`
     is served by the edge function first.
4. Share links use `location.origin` at runtime — localhost, the Netlify URL
   and any custom domain all work with zero code changes.

## Files

| File | What |
| ---- | ---- |
| `src/App.tsx` + `src/components/Sidebar.tsx` | 5-tab shell (Sidebar desktop, top bar mobile) |
| `src/pages/` | DashboardPage, AddLinksPage, AllLinksPage, ManageLinksPage, AnalyticsPage |
| `src/lib/ogFirebase.ts` | Firestore layer: subscribe, fixed `mintLink` allocator, toggle/delete |
| `src/lib/bake.ts` | Canvas baker (1200×630 + play + pill) |
| `src/lib/cloudinary.ts` | Unsigned Cloudinary upload |
| `src/lib/links.ts` | Bulk URL extractor + duration regex |
| `src/lib/utils.ts` | Date presets, time-ago, friendly Firestore errors |
| `netlify/edge-functions/ep.js` | `/ep*`: bot OG HTML (immutable cache) vs human white 1s redirect + click bump + `link_events` write |
| `firestore.rules` | Full CRUD on `photo_links` (Manage delete allowed), create+read on `link_events` |

## Verify after deploy

- Add Links: paste 3 URLs → Publish → 3 sequential `/epN` + Copy buttons.
- All Links: search/sort/filter finds them; Dashboard totals match.
- `curl -A Twitterbot https://<site>/epN | grep og:image` → that link's
  Cloudinary URL (different per link).
- Human visit → white "Opening..." ~1s → `https://gerbonmovies.site/?from=epN`,
  clicks +1, event row in Analytics → Live activity.
- Manage: Hide/Show toggles badge; Delete removes doc (shares 404 by design).
- Old `gerbonmovies.site/epN` links (shortxx-app project) are unaffected.
