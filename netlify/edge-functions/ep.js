// Og link interstitial — Netlify Edge Function (route: /ep*).
//
// Bots (X/Twitter, Facebook, Telegram, WhatsApp, …) get OG HTML whose
// og:image / twitter:image point at that link's own baked thumbnail on
// Cloudinary (Firestore `og-tag` project, collection `photo_links`).
// Each publish is a brand-new Cloudinary asset, so crawler caches bust
// themselves — no version param needed.
//
// Humans get a plain white page showing "Opening..." that redirects to
// gerbonmovies.site/?from=epN after ~1 second. Clicks are counted in the
// background so the redirect stays instant. No login anywhere.

// Crawler-specific tokens ONLY. Generic app names (tiktok, snapchat, pinterest,
// skype, tumblr...) also appear in the in-app browser UA of real humans, which
// made them look like bots: no redirect, no click counted -> views stuck at 0.
const BOT_RE =
  /twitterbot|facebookexternalhit|facebookcatalog|facebot|linkedinbot|slackbot|slack-imgproxy|telegrambot|whatsapp|discordbot|applebot|googlebot|google-inspectiontool|bingbot|bytespider|tiktokspider|embedly|quora link preview|showyoubot|outbrain|pinterestbot|pinterest\/0|tumblr\/|skypeuripreview|snap url preview|iframely|developers\.google/i;

const EP_PATH_RE = /^\/ep\d{1,6}\/?$/i;
const EP_SLUG_RE = /^ep\d{1,6}$/;

const EP_TITLE = "Hot Video \uD83D\uDC8B";
const EP_DESC = "Click to watch now";
const MAIN_SITE = "https://gerbonmovies.site";

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
  } catch (e) {
    console.error("[ep] photoImageUrl failed:", e);
    return FALLBACK_IMG;
  }
}

// Clicks bump (runs in waitUntil). One atomic commit with an `exists: true`
// precondition: stray /ep999999 hits 404 instead of creating ghost docs, and
// no extra GET round-trip. The response is CHECKED and logged — before, a
// 400/403 from Firestore (bad key restrictions, rules) was silently ignored.
async function bumpEpClicks(slug) {
  try {
    const docName =
      "projects/" + PROJECT_ID + "/databases/(default)/documents/photo_links/" + slug;
    const res = await fetch(commitUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [
          {
            transform: {
              document: docName,
              fieldTransforms: [
                { fieldPath: "clicks", increment: { integerValue: "1" } },
                { fieldPath: "lastClickedAt", setToServerValue: "REQUEST_TIME" },
                { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" },
              ],
            },
            currentDocument: { exists: true },
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        // ignore
      }
      // 404/FAILED_PRECONDITION = deleted or unknown slug: expected, stay quiet.
      if (res.status !== 404 && !/NOT_FOUND|FAILED_PRECONDITION/.test(detail)) {
        console.error("[ep] bumpEpClicks HTTP " + res.status + " for " + slug + ": " + detail);
      }
    }
  } catch (e) {
    console.error("[ep] bumpEpClicks failed:", e);
    // Analytics must never break the redirect.
  }
}

// Fire-and-forget click event for the Analytics tab (humans only).
// One lightweight doc per click: slug + server timestamp + UA + device +
// referrer (host + full URL) + UTM passthrough + edge geo country.
function deviceTypeFromUA(ua) {
  const u = String(ua || "");
  if (/ipad|tablet/i.test(u)) return "Tablet";
  if (/mobile|android|iphone|ipod|phone/i.test(u)) return "Mobile";
  return "Desktop";
}

async function logClickEvent(req, slug, context) {
  try {
    let referrerHost = "";
    let referrer = "";
    let ua = "";
    let utmSource = "";
    let utmMedium = "";
    let utmCampaign = "";
    try {
      ua = (req.headers && req.headers.get("user-agent")) || "";
      const ref = (req.headers && req.headers.get("referer")) || (req.headers && req.headers.get("referrer")) || "";
      if (ref && ref !== "Direct") {
        referrer = String(ref).slice(0, 300);
        try {
          referrerHost = new URL(ref).hostname.toLowerCase();
        } catch {
          referrerHost = String(ref).slice(0, 120).toLowerCase();
        }
      }
      try {
        const incoming = new URL(req.url);
        utmSource = String(incoming.searchParams.get("utm_source") || "").slice(0, 80);
        utmMedium = String(incoming.searchParams.get("utm_medium") || "").slice(0, 80);
        utmCampaign = String(incoming.searchParams.get("utm_campaign") || "").slice(0, 80);
      } catch {
        // ignore malformed query
      }
    } catch {
      // ignore header parse errors
    }
    let country = "";
    let countrySource = "unknown";
    try {
      const code = context && context.geo && context.geo.country && context.geo.country.code;
      if (code && String(code).length === 2) {
        country = String(code).toUpperCase();
        countrySource = "edge";
      }
    } catch {
      // geo unavailable (local dev / some PoPs) — stays unknown
    }
    const deviceType = deviceTypeFromUA(ua);
    const evRes = await fetch(commitUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name:
                "projects/" + PROJECT_ID + "/databases/(default)/documents/link_events/" +
                slug + "_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
              fields: {
                slug: { stringValue: slug },
                timestamp: { timestampValue: new Date().toISOString() },
                userAgent: { stringValue: String(ua).slice(0, 300) },
                deviceType: { stringValue: deviceType },
                referrerHost: { stringValue: String(referrerHost).slice(0, 120) },
                referrer: { stringValue: String(referrer).slice(0, 300) },
                utmSource: { stringValue: utmSource },
                utmMedium: { stringValue: utmMedium },
                utmCampaign: { stringValue: utmCampaign },
                country: { stringValue: country },
                countrySource: { stringValue: countrySource },
              },
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!evRes.ok) {
      let detail = "";
      try {
        detail = (await evRes.text()).slice(0, 300);
      } catch {
        // ignore
      }
      console.error("[ep] logClickEvent HTTP " + evRes.status + ": " + detail);
    }
  } catch (e) {
    console.error("[ep] logClickEvent failed:", e);
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
  const isHead = req.method === "HEAD";
  if ((req.method !== "GET" && !isHead) || !EP_PATH_RE.test(url.pathname)) {
    return context.next();
  }
  const slug = url.pathname.replace(/\//g, "").toLowerCase();
  if (!EP_SLUG_RE.test(slug)) return context.next();

  const ua = (req.headers && req.headers.get("user-agent")) || "";

  // Bots: per-link OG HTML with that link's own Cloudinary image.
  // Per-slug images are immutable -> long edge cache is safe.
  if (BOT_RE.test(ua)) {
    const imgUrl = await photoImageUrl(slug);
    return new Response(isHead ? null : buildBotHtml(canonicalFor(req, slug), imgUrl), {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        // NEVER let the shared CDN cache this: Netlify's CDN does not vary on
        // User-Agent, so a cached bot page (blank body, no redirect, no click
        // count) would be served to every human for the cache lifetime.
        "Cache-Control": "no-store",
        "Netlify-CDN-Cache-Control": "no-store",
        Vary: "User-Agent",
      },
    });
  }

  // HEAD from non-bots: never counts as a click.
  if (isHead) {
    return new Response(null, {
      status: 200,
      headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" },
    });
  }

  // Humans: white "Opening..." page, ~1s, then off to the main site.
  // Count the click + log one event in the background — never block the page.
  try {
    const bump = Promise.allSettled([bumpEpClicks(slug), logClickEvent(req, slug, context)]);
    if (context && typeof context.waitUntil === "function") context.waitUntil(bump);
    else bump.catch(() => {});
  } catch (e) {
    console.error("[ep] analytics wrapper failed:", e);
    // never break the page on analytics
  }
  const dest = redirectTarget(req, slug);
  return new Response(buildHumanHtml(dest), {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "no-store",
      "Netlify-CDN-Cache-Control": "no-store",
      Vary: "User-Agent",
    },
  });
}

export const config = { path: "/ep*" };
