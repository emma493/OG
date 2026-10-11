/* Og link-maker — bake + publish + history (vanilla JS, no build step).
 *
 * Same pipeline as the old Admin Photo tab, pointed at the separate
 * `og-tag` Firebase project. Cloudinary stays shared with shortxx.
 * Share links use location.origin, so localhost / Netlify URL / custom
 * domain all work with zero config changes.
 */
(function () {
  "use strict";

  var CFG = window.OG_CONFIG || {};
  var FIREBASE_CFG = CFG.firebase || {};
  var CLOUD_NAME = (CFG.cloudinary && CFG.cloudinary.cloudName) || "nonzehj3";
  var UPLOAD_PRESET = (CFG.cloudinary && CFG.cloudinary.uploadPreset) || "shortxx_preview";
  var SITE_CONFIG = "site_config";
  var PHOTO_SEQ_DOC = "photo_seq";
  var PHOTO_LINKS = "photo_links";
  var DURATION_RE = /^\d{1,3}:\d{2}$/;
  var PREVIEW_W = 1200;
  var PREVIEW_H = 630;

  var db = null;
  var FieldValue = null;

  // ---------- state ----------
  var baked = null;
  var bakedDuration = null;
  var baking = false;
  var publishing = false;
  var publishedSlug = null;
  var lastCopied = null;

  // ---------- dom ----------
  function $(id) { return document.getElementById(id); }

  var photoUrlEl, durationEl, diceBtn, bakeBtn, bakeErrorEl,
    previewEmpty, previewWrap, previewImg, publishBtn, publishErrorEl,
    publishedBox, publishedUrlEl, publishedCopyBtn,
    linksCount, linksErrorBox, linksErrorText, linksRetryBtn,
    justPublished, justPublishedText, justPublishedCopyBtn,
    linksEmpty, linksGrid, durationHint;

  // ---------- errors ----------
  function friendlyError(e) {
    var code = (e && e.code) || "";
    var msg = e instanceof Error ? e.message : String(e == null ? "" : e);
    if (code === "permission-denied" || /permission|PERMISSION_DENIED/i.test(msg)) {
      return "Write blocked by Firestore rules — deploy firestore.rules to the og-tag project, then retry.";
    }
    if (code === "unavailable" || /network|offline|Failed to fetch|Failed to get/i.test(msg)) {
      return "Network error — check connection/adblocker and retry.";
    }
    if (code === "failed-precondition" || /index/i.test(msg)) {
      return "Firestore needs an index for this query — deploy firestore.indexes.json.";
    }
    if (code === "unauthenticated" || /auth|api-key|API_KEY/i.test(msg)) {
      return "Not authorized — Firebase web config is wrong.";
    }
    return (msg || "Failed. Try again.").slice(0, 220);
  }

  function show(el, on) { el.style.display = on ? "" : "none"; }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shareUrlFor(slug) {
    return location.origin.replace(/\/$/, "") + "/" + slug;
  }

  // ---------- bake (canvas 1200x630 + play button + pill) ----------
  function randomDuration() {
    var r = Math.random();
    var mins = r < 0.45
      ? 1 + Math.floor(Math.random() * 3)
      : r < 0.8
        ? 4 + Math.floor(Math.random() * 3)
        : 7 + Math.floor(Math.random() * 3);
    var secs = Math.floor(Math.random() * 60);
    return mins + ":" + String(secs).padStart(2, "0");
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("load-failed")); };
      img.src = url;
    });
  }

  function viaProxy(sourceUrl) {
    var stripped = sourceUrl.trim().replace(/^https?:\/\//i, "");
    return "https://wsrv.nl/?url=" + encodeURIComponent(stripped) +
      "&w=" + PREVIEW_W + "&h=" + PREVIEW_H + "&fit=cover&output=jpg";
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bakePreview(sourceUrl, duration) {
    var url = sourceUrl.trim();
    if (!url) return Promise.reject(new Error("Paste a photo URL first."));
    return loadImage(url).catch(function () { return loadImage(viaProxy(url)); })
      .then(function (img) {
        var canvas = document.createElement("canvas");
        canvas.width = PREVIEW_W;
        canvas.height = PREVIEW_H;
        var ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available in this browser.");

        var scale = Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight);
        var dw = img.naturalWidth * scale;
        var dh = img.naturalHeight * scale;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        ctx.drawImage(img, (PREVIEW_W - dw) / 2, (PREVIEW_H - dh) / 2, dw, dh);

        ctx.fillStyle = "rgba(0,0,0,0.14)";
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

        var grad = ctx.createLinearGradient(0, PREVIEW_H - 190, 0, PREVIEW_H);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, PREVIEW_H - 190, PREVIEW_W, 190);

        var cx = PREVIEW_W / 2;
        var cy = PREVIEW_H / 2;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 92, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, 92, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.stroke();

        var triH = 76;
        var triW = 64;
        ctx.beginPath();
        ctx.moveTo(cx - triW * 0.38, cy - triH / 2);
        ctx.lineTo(cx - triW * 0.38, cy + triH / 2);
        ctx.lineTo(cx + triW * 0.62, cy);
        ctx.closePath();
        ctx.fillStyle = "#fff";
        ctx.fill();

        var label = (duration || "").trim() || "2:56";
        ctx.font = "700 44px Roboto, Arial, Helvetica, sans-serif";
        var textW = ctx.measureText(label).width;
        var padX = 26;
        var pillW = textW + padX * 2;
        var pillH = 68;
        var pillX = 36;
        var pillY = PREVIEW_H - pillH - 36;
        ctx.fillStyle = "rgba(0,0,0,0.82)";
        roundRect(ctx, pillX, pillY, pillW, pillH, 14);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textBaseline = "middle";
        ctx.fillText(label, pillX + padX, pillY + pillH / 2 + 2);

        var out = canvas.toDataURL("image/jpeg", 0.82);
        if (out.length > 950000) out = canvas.toDataURL("image/jpeg", 0.7);
        return out;
      });
  }

  // ---------- cloudinary ----------
  function dataUrlToBlob(dataUrl) {
    var m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
    if (!m) throw new Error("Baked image data is missing.");
    var bin = atob(m[2]);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] });
  }

  function uploadBakedImage(dataUrl) {
    var blob = dataUrlToBlob(dataUrl);
    var form = new FormData();
    form.append("file", blob, "preview.jpg");
    form.append("upload_preset", UPLOAD_PRESET);
    return fetch("https://api.cloudinary.com/v1_1/" + CLOUD_NAME + "/image/upload", {
      method: "POST",
      body: form,
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (body) {
        if (!res.ok || !body || !body.secure_url) {
          var detail = (body && body.error && body.error.message) || ("HTTP " + res.status);
          throw new Error("Cloudinary upload failed (" + detail + "). Check the preset is Unsigned.");
        }
        return { secureUrl: body.secure_url, publicId: body.public_id || "" };
      });
    }).catch(function (e) {
      if (e instanceof TypeError) throw new Error("Upload failed — check your connection and try again.");
      throw e;
    });
  }

  // ---------- firestore (og-tag project, compat SDK) ----------
  function createPhotoLink(input) {
    if (!input.sourceUrl.trim()) return Promise.reject(new Error("Photo URL is required"));
    if (!/^https:\/\/res\.cloudinary\.com\//.test(input.imageUrl)) {
      return Promise.reject(new Error("Cloudinary image URL is missing — upload first."));
    }
    var seqRef = db.collection(SITE_CONFIG).doc(PHOTO_SEQ_DOC);
    return db.runTransaction(function (tx) {
      return tx.get(seqRef).then(function (seqSnap) {
        var next = 1;
        if (seqSnap.exists) {
          var raw = seqSnap.data() && seqSnap.data().next;
          next = typeof raw === "number" && raw >= 1 ? Math.floor(raw) : 1;
        }
        var chain = Promise.resolve(null);
        for (var attempt = 0; attempt < 10; attempt += 1) {
          (function (a) {
            chain = chain.then(function (found) {
              if (found) return found;
              var candidate = "ep" + (next + a);
              return tx.get(db.collection(PHOTO_LINKS).doc(candidate)).then(function (ex) {
                if (!ex.exists) {
                  tx.set(seqRef,
                    { next: next + a + 1, updatedAt: FieldValue.serverTimestamp() },
                    { merge: true });
                  tx.set(db.collection(PHOTO_LINKS).doc(candidate), {
                    slug: candidate,
                    sourceUrl: input.sourceUrl.trim(),
                    imageUrl: input.imageUrl,
                    publicId: input.publicId || "",
                    duration: input.duration.trim(),
                    width: 1200,
                    height: 630,
                    provider: "cloudinary",
                    clicks: 0,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                    lastClickedAt: null,
                  });
                  return candidate;
                }
                return null;
              });
            });
          })(attempt);
        }
        return chain.then(function (slug) {
          if (!slug) throw new Error("Slug allocator is stuck — try again.");
          return slug;
        });
      });
    }).catch(function (e) {
      throw new Error(friendlyError(e));
    });
  }

  function subscribeLinks() {
    show(linksErrorBox, false);
    db.collection(PHOTO_LINKS)
      .orderBy("createdAt", "desc")
      .limit(100)
      .onSnapshot(function (snap) {
        var rows = [];
        snap.forEach(function (d) {
          var data = d.data() || {};
          rows.push({
            slug: typeof data.slug === "string" && data.slug ? data.slug : d.id,
            sourceUrl: data.sourceUrl || "",
            imageUrl: data.imageUrl || "",
            duration: data.duration || "",
            clicks: typeof data.clicks === "number" ? data.clicks : 0,
          });
        });
        renderLinks(rows);
        show(linksErrorBox, false);
      }, function (err) {
        linksErrorText.textContent = "History failed to load: " + friendlyError(err);
        show(linksErrorBox, true);
        renderLinks([]);
      });
  }

  // ---------- render ----------
  function renderLinks(rows) {
    linksCount.textContent = rows.length ? "(" + rows.length + ")" : "";
    if (!rows.length) {
      show(linksEmpty, true);
      linksGrid.innerHTML = "";
    } else {
      show(linksEmpty, false);
      linksGrid.innerHTML = rows.map(function (l) {
        var url = shareUrlFor(l.slug);
        return (
          '<article class="linkcard" data-slug="' + esc(l.slug) + '">' +
          (l.imageUrl
            ? '<img src="' + esc(l.imageUrl) + '" alt="Preview for ' + esc(url) + '" loading="lazy" />'
            : '<div style="aspect-ratio:1200/630;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px">Preview missing</div>') +
          '<div class="body"><code title="' + esc(url) + '">' + esc(url) + '</code>' +
          '<div class="meta" title="' + esc(l.sourceUrl) + '">src: ' + esc(l.sourceUrl || "—") + " · pill: " + esc(l.duration || "—") + "</div>" +
          '<div class="row" style="margin-top:8px;align-items:center">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-copy="' + esc(l.slug) + '">Copy link</button>' +
          '<span class="clicks">' + l.clicks + " click" + (l.clicks === 1 ? "" : "s") + "</span>" +
          "</div></div></article>"
        );
      }).join("");
    }
    var inGrid = publishedSlug && rows.some(function (l) { return l.slug === publishedSlug; });
    show(justPublished, !!(publishedSlug && !inGrid));
  }

  function copyText(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      try { ta.select(); document.execCommand("copy"); done(true); }
      catch (e) { done(false); }
      document.body.removeChild(ta);
    }
  }

  // ---------- actions ----------
  function doBake(pill) {
    if (baking || publishing || !photoUrlEl.value.trim()) return;
    baking = true;
    bakeErrorEl.textContent = "";
    show(bakeErrorEl, false);
    show(publishedBox, false);
    bakeBtn.disabled = true;
    bakeBtn.textContent = "Baking thumbnail…";
    bakePreview(photoUrlEl.value, pill).then(function (dataUrl) {
      baked = dataUrl;
      bakedDuration = pill.trim();
      previewImg.src = dataUrl;
      show(previewEmpty, false);
      show(previewWrap, true);
      bakeBtn.innerHTML = "&#128247; Re-bake thumbnail";
    }).catch(function (e) {
      baked = null;
      bakedDuration = null;
      bakeErrorEl.textContent = (e && e.message && e.message !== "load-failed")
        ? e.message
        : "Could not load that photo (host blocked cross-origin access). Try another URL.";
      show(bakeErrorEl, true);
    }).finally(function () {
      baking = false;
      bakeBtn.disabled = false;
      if (!baked) bakeBtn.textContent = "Generate thumbnail (random pill)";
    });
  }

  function refreshDurationHint() {
    var v = durationEl.value.trim();
    if (!DURATION_RE.test(v)) {
      durationHint.textContent = "Use m:ss format, e.g. 2:56";
      durationHint.className = "hint err";
      show(durationHint, true);
      durationEl.classList.add("bad");
    } else if (baked && bakedDuration && v !== bakedDuration) {
      durationHint.textContent = "Edited — hit Re-bake to apply it.";
      durationHint.className = "hint warn";
      show(durationHint, true);
      durationEl.classList.remove("bad");
    } else {
      show(durationHint, false);
      durationEl.classList.remove("bad");
    }
  }

  function onPublish() {
    if (publishing || !baked || !DURATION_RE.test(durationEl.value.trim())) return;
    publishing = true;
    publishErrorEl.textContent = "";
    show(publishErrorEl, false);
    show(publishedBox, false);
    publishBtn.disabled = true;
    publishBtn.textContent = "Uploading to Cloudinary…";
    uploadBakedImage(baked).then(function (up) {
      publishBtn.textContent = "Minting short link…";
      return createPhotoLink({
        sourceUrl: photoUrlEl.value,
        imageUrl: up.secureUrl,
        publicId: up.publicId,
        duration: bakedDuration || durationEl.value,
      });
    }).then(function (slug) {
      publishedSlug = slug;
      var url = shareUrlFor(slug);
      publishedUrlEl.textContent = url;
      justPublishedText.textContent = "Just published: " + url + " — showing here while history syncs…";
      show(publishedBox, true);
      renderLinksRefresh();
    }).catch(function (e) {
      publishErrorEl.textContent = friendlyError(e);
      show(publishErrorEl, true);
    }).finally(function () {
      publishing = false;
      publishBtn.disabled = false;
      publishBtn.innerHTML = "&#8681; Publish as new short link";
    });
  }

  function renderLinksRefresh() {
    // Re-render the just-published banner against the latest snapshot state.
    // The live listener will replace it once the doc arrives; this keeps the
    // link visible even if the listener lags or fails.
    show(justPublished, !!publishedSlug);
  }

  // ---------- init ----------
  function init() {
    photoUrlEl = $("photoUrl");
    durationEl = $("duration");
    diceBtn = $("diceBtn");
    bakeBtn = $("bakeBtn");
    bakeErrorEl = $("bakeError");
    previewEmpty = $("previewEmpty");
    previewWrap = $("previewWrap");
    previewImg = $("previewImg");
    publishBtn = $("publishBtn");
    publishErrorEl = $("publishError");
    publishedBox = $("publishedBox");
    publishedUrlEl = $("publishedUrl");
    publishedCopyBtn = $("publishedCopy");
    linksCount = $("linksCount");
    linksErrorBox = $("linksError");
    linksErrorText = $("linksErrorText");
    linksRetryBtn = $("linksRetry");
    justPublished = $("justPublished");
    justPublishedText = $("justPublishedText");
    justPublishedCopyBtn = $("justPublishedCopy");
    linksEmpty = $("linksEmpty");
    linksGrid = $("linksGrid");
    durationHint = $("durationHint");

    try {
      firebase.initializeApp(FIREBASE_CFG);
      db = firebase.firestore();
      FieldValue = firebase.firestore.FieldValue;
    } catch (e) {
      linksErrorText.textContent = "Firebase failed to start: " + friendlyError(e);
      show(linksErrorBox, true);
      return;
    }

    diceBtn.addEventListener("click", function () {
      durationEl.value = randomDuration();
      refreshDurationHint();
    });
    durationEl.addEventListener("input", refreshDurationHint);
    photoUrlEl.addEventListener("input", function () {
      show(publishedBox, false);
    });
    bakeBtn.addEventListener("click", function () {
      if (baked) {
        if (!DURATION_RE.test(durationEl.value.trim())) return;
        doBake(durationEl.value);
      } else {
        var pill = randomDuration();
        durationEl.value = pill;
        refreshDurationHint();
        doBake(pill);
      }
    });
    publishBtn.addEventListener("click", onPublish);
    publishedCopyBtn.addEventListener("click", function () {
      var t = publishedUrlEl.textContent;
      copyText(t, function (ok) {
        publishedCopyBtn.textContent = ok ? "Copied" : "Copy failed";
        setTimeout(function () { publishedCopyBtn.textContent = "Copy link"; }, 1600);
      });
    });
    justPublishedCopyBtn.addEventListener("click", function () {
      if (!publishedSlug) return;
      var t = shareUrlFor(publishedSlug);
      copyText(t, function (ok) {
        justPublishedCopyBtn.textContent = ok ? "Copied" : "Copy failed";
        setTimeout(function () { justPublishedCopyBtn.textContent = "Copy link"; }, 1600);
      });
    });
    linksRetryBtn.addEventListener("click", function () { subscribeLinks(); });
    linksGrid.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-copy]") : null;
      if (!btn) return;
      var slug = btn.getAttribute("data-copy");
      copyText(shareUrlFor(slug), function (ok) {
        btn.textContent = ok ? "Copied" : "Copy failed";
        setTimeout(function () { btn.textContent = "Copy link"; }, 1600);
        lastCopied = slug;
      });
    });

    refreshDurationHint();
    subscribeLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
