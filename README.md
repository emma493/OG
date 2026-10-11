# Og Link Maker

Standalone no-login tool. Paste a photo URL → baked video-style thumbnail
(1200×630, play button + duration pill) → Cloudinary → short link `/ep1`,
`/ep2`, … Each link keeps its own preview forever.

- ** humans**: `GET /epN` → white "Opening..." page → redirect after ~1s to
  `https://shortxx.live/?from=epN` (click counted in the background).
- **Bots** (X / WhatsApp / Telegram …): same URL returns OG HTML with that
  link's own Cloudinary image + `Hot Video 💋 / Click to watch now`.

## Stack

- Plain static site, no build step. Netlify publishes the repo root.
- Firebase project **`og-tag`** (separate database), Firestore only.
- Cloudinary stays shared with shortxx
  (`nonzehj3` / unsigned preset `shortxx_preview`).

## One-time setup

1. **Firestore rules** (required — without this, publish + history fail with
   `permission-denied`):
   ```sh
   firebase use og-tag
   firebase deploy --only firestore:rules
   ```
   Rules source: `firestore.rules` in this repo.
2. **Cloudinary preset**: unsigned preset `shortxx_preview`
   (folder `shortxx/previews`, jpg/png). Already exists — nothing to do
   unless uploads fail.
3. **Netlify**: New site → Import from GitHub → `OG`.
   - Build command: _(empty)_
   - Publish directory: `.` (repo root)
   - Edge Functions are auto-detected from `netlify/edge-functions/`.
4. Share links use `location.origin` at runtime — localhost, the Netlify URL
   and any custom domain all work with zero code changes.

## Files

| File | What |
| ---- | ---- |
| `index.html` | Publisher UI (bake → publish → history) |
| `style.css` | Dark theme |
| `config.js` | Firebase (`og-tag`) + Cloudinary + main-site target |
| `app.js` | Canvas baker, Cloudinary upload, Firestore (compat CDN) |
| `netlify/edge-functions/ep.js` | `/ep*`: bot OG HTML vs human white 1s redirect + click bump |
| `firestore.rules` | Open read/create/update, deny delete |

## Verify after deploy

- Publish once → green `/epN` box → history card with thumbnail + Copy.
- `curl -A Twitterbot https://<site>/epN | grep og:image` → that link's
  Cloudinary URL (different per link).
- Human visit → white "Opening..." ~1s → `https://shortxx.live/?from=epN`.
- Old `shortxx.live/epN` links (shortxx-app project) are unaffected.
