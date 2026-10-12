import { memo } from 'react';
import { Copy, ExternalLink, Eye, Image as ImageIcon } from 'lucide-react';
import { shareUrlFor } from '../lib/ogFirebase';
import { formatTimeAgo } from '../lib/utils';
import type { OgLinkDocument } from '../types';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };

function copyText(text: string, done: (ok: boolean) => void) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
  } else {
    done(false);
  }
}

const LinkCard = memo(function LinkCard({
  link,
  onCopied,
}: {
  link: OgLinkDocument;
  onCopied?: (msg: string) => void;
}) {
  const url = shareUrlFor(link.slug);
  return (
    <div className="rounded-[14px] overflow-hidden grid content-start" style={surface}>
      {link.imageUrl ? (
        <img src={link.imageUrl} alt={`Preview for ${url}`} loading="lazy" className="w-full block aspect-[1200/630] object-cover" />
      ) : (
        <div className="aspect-[1200/630] flex items-center justify-center text-[#8A8B91] text-[12px]" style={{ background: '#16171D' }}>
          Preview missing
        </div>
      )}
      <div className="p-3.5 grid gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-white text-[13px] font-bold font-mono truncate flex-1 min-w-0" title={url}>
            {url}
          </code>
          {!link.is_active && (
            <span className="text-[10px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-full bg-white/[0.08] text-[#8A8B91]">
              Hidden
            </span>
          )}
        </div>
        <div className="text-[#8A8B91] text-[11px] font-mono truncate" title={link.sourceUrl}>
          src: {link.sourceUrl || '—'} · pill: {link.duration || '—'}
        </div>
        <div className="flex items-center gap-3 text-[#8A8B91] text-[12px]">
          <span className="flex items-center gap-1 tabular-nums">
            <Eye size={13} /> {(link.clicks || 0).toLocaleString()} clicks
          </span>
          <span>{formatTimeAgo(link.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <button
            type="button"
            onClick={() => copyText(url, (ok) => onCopied?.(ok ? `Copied ${link.slug}` : 'Copy failed'))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white hover:bg-white/[0.08]"
            style={{ background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Copy size={13} /> Copy link
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#E1E2E6] hover:text-white hover:bg-white/[0.08]"
            style={{ background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ExternalLink size={13} /> Open
          </a>
          {link.imageUrl && (
            <button
              type="button"
              onClick={() => copyText(link.imageUrl, (ok) => onCopied?.(ok ? 'Image URL copied' : 'Copy failed'))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-[#8A8B91] hover:text-white hover:bg-white/[0.06]"
              title="Copy og:image URL"
            >
              <ImageIcon size={13} /> Image
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default LinkCard;
