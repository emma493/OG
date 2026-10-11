/* Og link-maker — public config (client keys, NOT secrets).
 * Firestore access is gated by firestore.rules, not by key secrecy.
 *
 * FIXED: separate Firebase project (og-tag). Cloudinary stays shared
 * with shortxx (same cloud + unsigned preset).
 *
 * SHARE ORIGIN: share links are built from location.origin at runtime,
 * so localhost, the Netlify URL and any custom domain all just work
 * with zero code changes after connecting Netlify.
 */
window.OG_CONFIG = {
  firebase: {
    apiKey: "AIzaSyBC8ICNvg2ZwYkaWgPhi1-2WuZ7Iim0_eQ",
    authDomain: "og-tag.firebaseapp.com",
    projectId: "og-tag",
    storageBucket: "og-tag.firebasestorage.app",
    messagingSenderId: "398617154671",
    appId: "1:398617154671:web:94b7de138b389d2592e99a",
    measurementId: "G-PFGVQ5YLQJ",
  },
  cloudinary: {
    cloudName: "nonzehj3",
    uploadPreset: "shortxx_preview",
  },
  // Where human visitors land after the 1s white interstitial.
  // The /?from=epN param attributes clicks per link.
  mainSite: "https://shortxx.live",
};
