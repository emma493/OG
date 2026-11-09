import { useEffect, useMemo, useState } from 'react';
import { Dices, Loader2, UploadCloud } from 'lucide-react';
import { bakePreview, randomDuration } from '../lib/bake';
import { uploadBakedImage } from '../lib/cloudinary';
import { DURATION_RE } from '../lib/links';
import { mintLink, shareUrlFor, subscribeToLinks } from '../lib/ogFirebase';
import { friendlyReason } from '../lib/utils';
import type { OgLinkDocument } from '../types';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };
const inputStyle = { background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' };

export default function AddLinksPage() {
  const [photoUrl, setPhotoUrl] = useState('');
  const [duration, setDuration] = useState(randomDuration());
  const [baked, setBaked] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  const [bakeError, setBakeError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState('');

  const [links, setLinks] = useState<OgLinkDocument[]>([]);

  // Live history of all links (newest first).
  useEffect(() => {
    const unsub = subscribeToLinks((list) => {
      setLinks(list.slice().reverse());
    });
    return () => unsub();
  }, []);

  const durationHint = useMemo(() => {
    if (!DURATION_RE.test(duration.trim())) return { text: 'Use m:ss format, e.g. 2:56', kind: 'err' as const };
    if (baked && duration.trim() !== '') return { text: 'Edited — hit Re-bake to apply it.', kind: 'warn' as const };
    return { text: '', kind: 'muted' as const };
  }, [duration, baked]);

  const canBake = !!photoUrl.trim() && !baking;
  const canPublish = !!baked && DURATION_RE.test(duration.trim()) && !publishing;

  const doBake = async () => {
    if (!photoUrl.trim()) return;
    setBaking(true);
    setBakeError('');
    const pill = duration.trim() || randomDuration();
    try {
      const dataUrl = await bakePreview(photoUrl, pill);
      setBaked(dataUrl);
    } catch (e) {
      setBaked(null);
      setBakeError((e as Error).message !== 'load-failed'
        ? (e as Error).message
        : 'Could not load that photo (host blocked cross-origin access). Try another URL.');
    } finally {
      setBaking(false);
    }
  };

  const onPublish = async () => {
    if (!baked || publishing) return;
    setPublishing(true);
    setPublishError('');
    try {
      const up = await uploadBakedImage(baked);
      const slug = await mintLink({
        sourceUrl: photoUrl.trim(),
        imageUrl: up.secureUrl,
        publicId: up.publicId,
        duration: duration.trim(),
      });
      setPublishedSlug(slug);
      setPublishedUrl(shareUrlFor(slug));
    } catch (e) {
      setPublishError(friendlyReason(e));
    } finally {
      setPublishing(false);
    }
  };

  const rollDuration = () => {
    setDuration(randomDuration());
    setBaked(null); // clear preview so user re-bakes with new pill
    setBakeError('');
  };

  const onUrlChange = () => {
    setPublishedSlug(null);
    setPublishedUrl('');
    setBaked(null); // new URL needs re-bake
    setBakeError('');
  };

  return (
    <div>
      <h1 className="text-white text-[22px] font-extrabold tracking-tight">Add Link</h1>
      <p className="text-[#8A8B91] text-[13px] mt-1">Paste a photo URL — it gets baked into a video-style thumbnail (play button + duration pill), uploaded to Cloudinary, and published as its own short link (/epN).</p>

      <div className="mt-5 grid gap-4">
        {/* Step 1: URL + duration + bake */}
        <section className="rounded-[14px] p-5" style={surface}>
          <h2 className="text-white text-[14px] font-bold mb-3">1 · Photo URL + duration</h2>
          <label className="text-[#8A8B91] text-[12px] font-bold uppercase tracking-[0.1em] block mb-2">Photo link</label>
          <div style={inputStyle}>
            <input
              id="photoUrl"
              type="url"
              className="w-full px-3.5 py-3 rounded-[10px] text-white text-[13px] outline-none font-mono bg-transparent border-none"
              placeholder="https://cdn.site.com/photo.jpg"
              value={photoUrl}
              onChange={(e) => { setPhotoUrl(e.target.value); onUrlChange(); }}
              autoComplete="off"
            />
          </div>

          <div style={{ marginTop: 16, maxWidth: 320 }}>
            <label className="text-[#8A8B91] text-[12px] font-bold uppercase tracking-[0.1em] block mb-2">Duration pill (auto-random)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <div style={{ ...inputStyle, flex: 1, minWidth: 0 }}>
                <input
                  id="duration"
                  type="text"
                  className="w-full bg-transparent border-none outline-none text-white text-[13px] font-mono px-3.5 py-3"
                  value={duration}
                  onChange={(e) => { setDuration(e.target.value); setBaked(null); }}
                />
              </div>
              <button
                id="diceBtn"
                type="button"
                onClick={rollDuration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white"
                style={{ background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' }}
                title="Roll a new random duration"
              >
                <Dices size={13} />
              </button>
            </div>
            {durationHint.text && (
              <p id="durationHint" className="hint" style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: durationHint.kind === 'err' ? '#FF2B55' : durationHint.kind === 'warn' ? '#FBBF24' : '#8A8B91' }}>
                {durationHint.text}
              </p>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              id="bakeBtn"
              type="button"
              onClick={doBake}
              disabled={!canBake}
              className="flex items-center gap-2 text-white text-[14px] font-bold px-5 py-2.5 rounded-[10px] disabled:opacity-40"
              style={{ background: '#FF2B55' }}
            >
              {baking ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={16} />}
              {baking ? 'Baking thumbnail…' : baked ? 'Re-bake thumbnail' : 'Generate thumbnail'}
            </button>
          </div>
          {bakeError && (
            <p id="bakeError" className="hint" style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#FF2B55' }}>{bakeError}</p>
          )}
        </section>

        {/* Step 2: Preview + publish */}
        <section className="rounded-[14px] p-5" style={surface}>
          <h2 className="text-white text-[14px] font-bold mb-3">2 · Preview + publish as new short link</h2>
          {baked ? (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12 }}>
              <img
                id="previewImg"
                src={baked}
                alt="Baked link preview with play button and duration"
                style={{ width: '100%', display: 'block', aspectRatio: '1200 / 630', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ borderRadius: 10, padding: 40, textAlign: 'center', color: '#8A8B91', fontSize: 13, background: '#16171D' }}>
              No thumbnail yet — paste a URL above and hit Generate.
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <button
              id="publishBtn"
              type="button"
              onClick={onPublish}
              disabled={!canPublish}
              className="flex items-center gap-2 text-white text-[14px] font-bold px-5 py-2.5 rounded-[10px] disabled:opacity-40"
              style={{ background: '#16A34A' }}
            >
              {publishing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={16} />}
              {publishing ? 'Uploading to Cloudinary…' : 'Publish as new short link'}
            </button>
          </div>
          {publishError && (
            <p id="publishError" className="hint" style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#FF2B55' }}>{publishError}</p>
          )}
          {publishedUrl && (
            <div style={{ marginTop: 12, borderRadius: 10, padding: 12, background: 'rgba(22, 163, 74, 0.1)', border: '1px solid rgba(22, 163, 74, 0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 0 }}>
                <code id="publishedUrl" style={{ background: '#16171D', padding: '8px 12px', borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={publishedUrl}>{publishedUrl}</code>
                <button
                  id="publishedCopy"
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(publishedUrl)}
                  className="px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white shrink-0"
                  style={{ background: '#0F1014', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Copy link
                </button>
              </div>
              <p style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#4ADE80' }}>
                Live with its own preview. Re-scrape in X Card Validator / @webpagebot to refresh their cache.
              </p>
            </div>
          )}
        </section>

        {/* Step 3: All links history */}
        <section className="rounded-[14px] p-5" style={surface}>
          <h2 className="text-white text-[14px] font-bold mb-3">3 · All links <span className="text-[#8A8B91] font-semibold">({links.length})</span></h2>
          <p className="text-[#8A8B91] text-[12px] mt-1">Newest first. Each card shows its preview image. Links are permanent.</p>
          {links.length === 0 ? (
            <p className="text-[#8A8B91] text-[13px] mt-3">Nothing published yet — your first link will appear here as /ep1.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
              {links.map((l) => {
                const url = shareUrlFor(l.slug);
                return (
                  <div key={l.id} style={{ borderRadius: 10, overflow: 'hidden', background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {l.imageUrl ? (
                      <img src={l.imageUrl} alt={`Preview for ${url}`} style={{ width: '100%', display: 'block', aspectRatio: '1200 / 630', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ aspectRatio: '1200 / 630', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8B91', fontSize: 12, background: '#16171D' }}>Preview missing</div>
                    )}
                    <div style={{ padding: 12 }}>
                      <code style={{ color: '#fff', fontSize: 12, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }} title={url}>{url}</code>
                      <div style={{ marginTop: 4, color: '#8A8B91', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.sourceUrl}>
                        src: {l.sourceUrl || '—'} · pill: {l.duration || '—'}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(url)}
                          className="px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white"
                          style={{ background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          Copy link
                        </button>
                        <span style={{ color: '#8A8B91', fontSize: 11, fontWeight: 700 }}>{l.clicks || 0} click{l.clicks === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
