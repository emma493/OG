import { useMemo, useState } from 'react';
import { Dices, Link2, Loader2, UploadCloud } from 'lucide-react';
import { bakePreview, randomDuration } from '../lib/bake';
import { uploadBakedImage } from '../lib/cloudinary';
import { DURATION_RE, extractLinksFromString } from '../lib/links';
import { mintLink, shareUrlFor } from '../lib/ogFirebase';
import { friendlyReason } from '../lib/utils';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };
const inputStyle = { background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' };

interface Published { sourceUrl: string; slug: string; url: string; duration: string; }
interface Failed { url: string; reason: string; }

export default function AddLinksPage() {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [published, setPublished] = useState<Published[]>([]);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [finished, setFinished] = useState(false);
  const [toast, setToast] = useState('');

  const links = useMemo(() => extractLinksFromString(raw), [raw]);
  const canSubmit = !busy && links.length > 0;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setDone(0);
    setTotal(links.length);
    setPublished([]);
    setFailed([]);
    setFinished(false);
    setToast('');

    const ok: Published[] = [];
    const errs: Failed[] = [];
    let completed = 0;

    // Concurrency 3: bake (canvas) + upload + mint per link.
    let cursor = 0;
    const workers = Array(Math.min(3, links.length))
      .fill(0)
      .map(async () => {
        while (cursor < links.length) {
          const sourceUrl = links[cursor++];
          try {
            const duration = randomDuration();
            if (!DURATION_RE.test(duration)) throw new Error('Bad duration');
            const baked = await bakePreview(sourceUrl, duration).catch(() => {
              throw new Error('Could not load that photo (host blocked cross-origin access). Try another URL.');
            });
            const up = await uploadBakedImage(baked);
            const slug = await mintLink({ sourceUrl, imageUrl: up.secureUrl, publicId: up.publicId, duration });
            ok.push({ sourceUrl, slug, url: shareUrlFor(slug), duration });
          } catch (e) {
            errs.push({ url: sourceUrl, reason: friendlyReason(e) });
          }
          completed += 1;
          setDone(completed);
        }
      });
    await Promise.all(workers);

    ok.sort((a, b) => a.slug.localeCompare(b.slug));
    setPublished(ok);
    setFailed(errs);
    setFinished(true);
    setBusy(false);
    if (errs.length === 0) setRaw('');
    setToast(ok.length ? `${ok.length} link${ok.length === 1 ? '' : 's'} published` : 'Nothing published');
  };

  return (
    <div>
      <h1 className="text-white text-[22px] font-extrabold tracking-tight">Add Links</h1>
      <p className="text-[#8A8B91] text-[13px] mt-1">Paste photo URLs — each gets baked (play button + random duration pill), uploaded to Cloudinary, minted as /epN.</p>

      <div className="mt-5 grid gap-4">
        <section className="rounded-[14px] p-5" style={surface}>
          <h2 className="text-white text-[14px] font-bold mb-3">1 · Photo URLs <span className="text-[#8A8B91] font-semibold">(bulk, comma or line separated)</span></h2>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={'https://cdn.site.com/a.jpg\nhttps://cdn.site.com/b.jpg, …'}
            className="w-full px-3.5 py-3 rounded-[10px] text-white text-[13px] outline-none placeholder:text-[#8A8B91] font-mono"
            style={inputStyle}
          />
          <div className="mt-3 flex items-center gap-2 text-[13px] text-[#8A8B91]">
            <Link2 size={14} />
            {links.length} link{links.length === 1 ? '' : 's'} detected
            <button
              type="button"
              onClick={() => setRaw((v) => `${v}${v && !v.endsWith('\n') ? '\n' : ''}https://picsum.photos/seed/${Math.floor(Math.random() * 9999)}/1200/800`)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white"
              style={inputStyle}
              title="Insert a test photo URL"
            >
              <Dices size={13} /> Test URL
            </button>
          </div>

          {(busy || finished) && total > 0 && (
            <div className="mt-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#16171D' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((done / total) * 100)}%`, background: '#FF2B55' }} />
              </div>
              <div className="mt-1.5 text-[12px] text-[#8A8B91] tabular-nums">{done}/{total} processed{finished && (failed.length === 0 ? ' — all live' : ` — ${failed.length} failed`)}</div>
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="mt-4 flex items-center gap-2 text-white text-[14px] font-bold px-5 py-2.5 rounded-[10px] disabled:opacity-40"
            style={{ background: '#FF2B55' }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={16} />}
            {busy ? `Publishing ${done}/${total}…` : `Publish ${links.length} link${links.length === 1 ? '' : 's'}`}
          </button>
          {toast && <p className="mt-2 text-[12px] font-semibold text-emerald-400">{toast}</p>}
        </section>

        {published.length > 0 && (
          <section className="rounded-[14px] p-5 grid gap-2" style={surface}>
            <h2 className="text-white text-[14px] font-bold">Published</h2>
            {published.map((p) => (
              <div key={p.slug} className="flex items-center gap-2 text-[13px] min-w-0 rounded-[10px] px-3 py-2" style={inputStyle}>
                <span className="text-white font-mono font-bold truncate flex-1 min-w-0" title={p.url}>{p.url}</span>
                <span className="text-[#8A8B91] font-mono text-[12px] shrink-0">{p.duration}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(p.url).then(() => setToast(`Copied ${p.slug}`))}
                  className="px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white shrink-0"
                  style={{ background: '#0F1014', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Copy
                </button>
              </div>
            ))}
          </section>
        )}

        {finished && failed.length > 0 && (
          <section className="rounded-[14px] p-5 grid gap-1.5" style={surface}>
            <h2 className="text-white text-[14px] font-bold">Failed ({failed.length})</h2>
            {failed.slice(0, 8).map((f) => (
              <p key={f.url} className="text-[12px] text-[#FF2B55] truncate" title={f.url}>{f.reason} — <span className="font-mono opacity-80">{f.url}</span></p>
            ))}
            {failed.length > 8 && <p className="text-[12px] text-[#8A8B91]">+{failed.length - 8} more</p>}
          </section>
        )}
      </div>
    </div>
  );
}
