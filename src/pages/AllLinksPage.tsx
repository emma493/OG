import { useEffect, useMemo, useState } from 'react';
import { Clapperboard, Loader2, Search } from 'lucide-react';
import Dropdown from '../components/Dropdown';
import LinkCard from '../components/LinkCard';
import { subscribeToLinks } from '../lib/ogFirebase';
import type { OgLinkDocument } from '../types';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };
const inputStyle = { background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' };

type SortMode = 'newest' | 'clicks' | 'slug';
type HeatFilter = 'all' | 'hot' | 'cold' | 'hidden' | 'visible';

export default function AllLinksPage() {
  const [links, setLinks] = useState<OgLinkDocument[]>([]);
  const [connected, setConnected] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('newest');
  const [heat, setHeat] = useState<HeatFilter>('all');
  const [toast, setToast] = useState('');

  useEffect(() => subscribeToLinks((list) => { setLinks(list); setConnected(true); }, () => setConnected(false)), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = links.filter((l) => {
      if (heat === 'hot' && (l.clicks || 0) < 10) return false;
      if (heat === 'cold' && (l.clicks || 0) >= 10) return false;
      if (heat === 'hidden' && l.is_active) return false;
      if (heat === 'visible' && !l.is_active) return false;
      if (q) {
        const hay = `${l.slug} ${l.sourceUrl} ${l.duration}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === 'clicks') return (b.clicks || 0) - (a.clicks || 0);
      if (sort === 'slug') return a.slug.localeCompare(b.slug);
      return 0; // newest: server already ordered by createdAt desc
    });
    return rows;
  }, [links, query, sort, heat]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white text-[22px] font-extrabold tracking-tight">All Links</h1>
          <p className="text-[#8A8B91] text-[13px] mt-1">{connected ? `${filtered.length} of ${links.length} links · live` : 'Connecting…'}</p>
        </div>
        {toast && <span className="text-emerald-400 text-[12px] font-bold">{toast}</span>}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
        <div className="rounded-[14px] p-4 grid gap-3 content-start min-w-0 w-full" style={surface}>
          <div className="grid gap-1.5">
            <span className="text-[#E1E2E6] text-[12px] font-bold uppercase tracking-[0.1em]">Sort</span>
            <Dropdown
              ariaLabel="Sort links"
              value={sort}
              onChange={(v) => setSort(v as SortMode)}
              options={[
                { value: 'newest', label: 'Newest first' },
                { value: 'clicks', label: 'Most clicked' },
                { value: 'slug', label: 'Slug A–Z' },
              ]}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-[#E1E2E6] text-[12px] font-bold uppercase tracking-[0.1em]">Filter</span>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'hot', label: 'Hot 10+' },
                  { value: 'cold', label: 'Cold' },
                  { value: 'visible', label: 'Visible' },
                  { value: 'hidden', label: 'Hidden' },
                ] as { value: HeatFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setHeat(f.value)}
                  aria-pressed={heat === f.value}
                  className="px-3 py-2 rounded-[10px] text-[12px] font-bold"
                  style={heat === f.value ? { background: '#FF2B55', color: '#fff' } : { background: '#16171D', color: '#A1A2A7', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[#E1E2E6] text-[12px] font-bold uppercase tracking-[0.1em]">Search</span>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B91]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ep12, source url, pill…"
                className="w-full pl-9 pr-3 py-2.5 rounded-[10px] text-white text-[13px] outline-none placeholder:text-[#8A8B91]"
                style={inputStyle}
              />
            </div>
          </label>
        </div>

        <div className="grid gap-3 content-start sm:grid-cols-2">
          {filtered.length === 0 && connected ? (
            <div className="rounded-[14px] p-10 text-center text-[#8A8B91] text-[14px] flex flex-col items-center gap-2 sm:col-span-2" style={surface}>
              <Clapperboard size={22} />
              No links match these filters.
            </div>
          ) : (
            filtered.map((l) => <LinkCard key={l.id} link={l} onCopied={setToast} />)
          )}
          {!connected && (
            <div className="flex items-center gap-2 text-[#8A8B91] text-[13px]">
              <Loader2 size={15} className="animate-spin" /> Loading links…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
