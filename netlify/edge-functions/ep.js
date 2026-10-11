// Og link interstitial — Netlify Edge Function (route: /ep*).
//
// Bots (X/Twitter, Facebook, Telegram, WhatsApp, …) get OG HTML whose
// og:image / twitter:image point at that link's own baked thumbnail on
// Cloudinary (Firestore `og-tag` project, collection `photo_links`).
// Each publish is a brand-new Cloudinary asset, so crawler caches bust
// themselves — no version param needed.
//
// Humans get a plain white page showing "Opening..." that redirects to
// shortxx.live/?from=epN after ~1 second. Clicks are counted in the
// background so the redirect stays instant. No login anywhere.

const BOT_RE =
  /twitterbot|facebookexternalhit|facebookcatalog|facebot|linkedinbot|slackbot|telegrambot|whatsapp|discordbot|applebot|googlebot|bingbot|bytespider|embedly|quora link preview|showyoubot|outbrain|pinterest|tumblr/i;

const EP_PATH_RE = /^\/ep\d{1,6}\/?$/i;
const EP_SLUG_RE = /^ep\d{1,6}$/;

const EP_TITLE = "Hot Video \uD83D\uDC8B";
const EP_DESC = "Click to watch now";
const MAIN_SITE = "https://shortxx.live";

const PROJECT_ID = "og-tag";
// Public browser key (same as the publisher bundle). Rules-gated, not secret.
const FIRESTORE_KEY = "AIzaSyBC8ICNvg2ZwYkaWgPhi1-2WuZ7Iim0_eQ";
const FALLBACK_IMG = MAIN_SITE + "/og-preview.png";

function photoDocUrl(slug) {
  return (
    "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)" +
    "/documents/photo_links/" + encodeURIComponent(slug) +
    "?key=" + FIRESTORE_KEY + "&mask.fieldPaths=imageUrl"
  );
}

function commitUrl() {
  return (
    "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)" +
    "/documents:commit?key=" + FIRESTORE_KEY
  );
}

async function photoImageUrl(slug) {
  try {
    const res = await fetch(photoDocUrl(slug), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return FALLBACK_IMG;
    const doc = await res.json();
    const u = (doc && doc.fields && doc.fields.imageUrl && doc.fields.imageUrl.stringValue) || "";
    return /^https:\/\/res\.cloudinary\.com\//.test(u.trim()) ? u.trim() : FALLBACK_IMG;
  } catch {
    return FALLBACK_IMG;
  }
}

// Fire-and-forget clicks bump. Verifies the doc exists first so stray
// /ep999999 hits never create ghost docs via updateTransforms.
async function bumpEpClicks(slug) {
  try {
    const check = await fetch(photoDocUrl(slug), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!check.ok) return;
    const docName =
      "projects/" + PROJECT_ID + "/databases/(default)/documents/photo_links/" + slug;
    await fetch(commitUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [
          {
            updateTransforms: {
              document: docName,
              fieldTransforms: [
                { fieldPath: "clicks", increment: { integerValue: "1" } },
                { fieldPath: "lastClickedAt", setToServerValue: "REQUEST_TIME" },
                { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
              ],
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Analytics must never break the redirect.
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function canonicalFor(req, slug) {
  try {
    const u = new URL(req.url);
    return u.origin + "/" + slug;
  } catch {
    return "https://" + PROJECT_ID + ".netlify.app/" + slug;
  }
}

function buildBotHtml(canonical, imgUrl) {
  const title = escapeHtml(EP_TITLE);
  const desc = escapeHtml(EP_DESC);
  const img = escapeHtml(imgUrl);
  const url = escapeHtml(canonical);
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>" + title + "</title>" +
    '<meta name="description" content="' + desc + '">' +
    '<link rel="canonical" href="' + url + '">' +
    '<meta property="og:title" content="' + title + '">' +
    '<meta property="og:description" content="' + desc + '">' +
    '<meta property="og:url" content="' + url + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:image" content="' + img + '">' +
    '<meta property="og:image:secure_url" content="' + img + '">' +
    '<meta property="og:image:width" content="1200">' +
    '<meta property="og:image:height" content="630">' +
    '<meta property="og:site_name" content="Shortxx">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + title + '">' +
    '<meta name="twitter:description" content="' + desc + '">' +
    '<meta name="twitter:image" content="' + img + '">' +
    "</head><body></body></html>"
  );
}

function redirectTarget(req, slug) {
  const target = new URL("/", MAIN_SITE);
  try {
    const incoming = new URL(req.url);
    for (const [k, v] of incoming.searchParams) {
      if (k.toLowerCase() === "from") continue;
      target.searchParams.append(k, v);
    }
  } catch {
    // ignore malformed query — ?from= still set below
  }
  target.searchParams.set("from", slug);
  return target.toString();
}

function buildHumanHtml(dest) {
  const d = escapeHtml(dest);
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="robots" content="noindex, nofollow">' +
    '<meta http-equiv="refresh" content="1;url=' + d + '">' +
    "<title>Opening...</title>" +
    "<style>html,body{margin:0;padding:0;background:#fff;height:100%}" +
    "body{display:flex;align-items:center;justify-content:center;" +
    "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    "p{color:#999;font-size:14px;margin:0}</style>" +
    "</head><body><p>Opening...</p>" +
    '<p style="display:none"><a href="' + d + '">Continue</a></p>' +
    "<script>setTimeout(function(){location.replace(" + JSON.stringify(dest) + ")},1000)</script>" +
    "</body></html>"
  );
}

export default async function handler(req, context) {
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return context.next();
  }
  if (req.method !== "GET" || !EP_PATH_RE.test(url.pathname)) {
    return context.next();
  }
  const slug = url.pathname.replace(/\//g, "").toLowerCase();
  if (!EP_SLUG_RE.test(slug)) return context.next();

  const ua = (req.headers && req.headers.get("user-agent")) || "";

  // Bots: per-link OG HTML with that link's own Cloudinary image.
  if (BOT_RE.test(ua)) {
    const imgUrl = await photoImageUrl(slug);
    return new Response(buildBotHtml(canonicalFor(req, slug), imgUrl), {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
        Vary: "User-Agent",
      },
    });
  }

  // Humans: white "Opening..." page, ~1s, then off to the main site.
  // Count the click in the background — never block the page.
  try {
    const bump = bumpEpClicks(slug);
    if (context && typeof context.waitUntil === "function") context.waitUntil(bump);
    else bump.catch(() => {});
  } catch {
    // never break the page on analytics
  }
  const dest = redirectTarget(req, slug);
  return new Response(buildHumanHtml(dest), {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "no-store",
      Vary: "User-Agent",
    },
  });
}

export const config = { path: "/ep*" };
