import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Link2, Loader2, MousePointerClick } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DateRangeFilter, { type DatePreset } from '../components/DateRangeFilter';
import { subscribeToLinks, subscribeToRecentEvents } from '../lib/ogFirebase';
import { getDateStrFromTimestamp, getFormattedDate, getPresetDates, isDateInRange, normalizeDateRange } from '../lib/utils';
import type { OgLinkDocument, OgLinkEvent } from '../types';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };
const inputStyle = { background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' };

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden min-w-0">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>('30days');
  const [customStart, setCustomStart] = useState(() => getFormattedDate(0));
  const [customEnd, setCustomEnd] = useState(() => getFormattedDate(0));
  const [links, setLinks] = useState<OgLinkDocument[]>([]);
  const [events, setEvents] = useState<OgLinkEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => subscribeToLinks((list) => { setLinks(list); setConnected(true); }, () => setConnected(false)), []);
  useEffect(() => subscribeToRecentEvents(100, setEvents), []);

  const { startDate, endDate } = useMemo(() => {
    if (preset === 'custom') return normalizeDateRange(customStart, customEnd);
    return getPresetDates(preset);
  }, [preset, customStart, customEnd]);
  const rangeLabel = preset === 'all' || (!startDate && !endDate) ? 'All time' : startDate === endDate ? startDate : `${startDate} → ${endDate}`;

  const linksInRange = useMemo(
    () => (preset === 'all' ? links : links.filter((l) => isDateInRange(getDateStrFromTimestamp(l.createdAt), startDate || undefined, endDate || undefined))),
    [links, preset, startDate, endDate],
  );
  const totalClicks = useMemo(() => links.reduce((a, l) => a + (l.clicks || 0), 0), [links]);
  const rangeClicks = useMemo(() => linksInRange.reduce((a, l) => a + (l.clicks || 0), 0), [linksInRange]);

  const topLinks = useMemo(() => [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10), [links]);
  const maxClicks = topLinks[0]?.clicks || 1;

  // Clicks trend from link_events (falls back to createdAt distribution when empty).
  const trend = useMemo(() => {
    const buckets = new Map<string, number>();
    const push = (day: string) => buckets.set(day, (buckets.get(day) ?? 0) + 1);
    if (events.length > 0) {
      for (const e of events) {
        const d = getDateStrFromTimestamp(e.timestamp);
        if (preset !== 'all' && !isDateInRange(d, startDate || undefined, endDate || undefined)) continue;
        push(d);
      }
    } else {
      for (const l of linksInRange) push(getDateStrFromTimestamp(l.lastClickedAt || l.createdAt));
    }
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([day, clicks]) => ({ day, label: day.slice(5), clicks }));
  }, [events, linksInRange, preset, startDate, endDate]);

  const exportCsv = () => {
    const esc = (v: unknown): string => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [`# Og analytics export — ${rangeLabel}`, 'slug,url,clicks,sourceUrl,duration'];
    for (const l of topLinks) lines.push([l.slug, `${window.location.origin}/${l.slug}`, l.clicks || 0, l.sourceUrl, l.duration].map(esc).join(','));
    lines.push('', 'day,clicks');
    for (const t of trend) lines.push([t.day, t.clicks].map(esc).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `og-analytics-${startDate || 'all'}-${endDate || 'all'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white text-[22px] font-extrabold tracking-tight">Analytics</h1>
          <p className="text-[#8A8B91] text-[13px] mt-1">{connected ? `Deep insights · ${rangeLabel} · live` : 'Connecting…'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter
            ariaLabel="Analytics date range"
            preset={preset}
            onPresetChange={setPreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => { const n = normalizeDateRange(s, e); setCustomStart(n.startDate); setCustomEnd(n.endDate); }}
          />
          <button onClick={exportCsv} className="flex items-center gap-2 text-[13px] font-bold px-4 py-2.5 rounded-[10px] text-[#E1E2E6] hover:text-white" style={inputStyle} title="Download scoped analytics as CSV">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: <Link2 size={15} />, label: 'Total links', value: String(links.length), sub: rangeLabel },
          { icon: <MousePointerClick size={15} />, label: 'Total clicks', value: totalClicks.toLocaleString(), sub: rangeLabel },
          { icon: <Eye size={15} />, label: 'Clicks in range', value: rangeClicks.toLocaleString(), sub: `${linksInRange.length} links` },
          { icon: <Download size={15} />, label: 'Events tracked', value: String(events.length), sub: 'latest 100 live' },
        ].map((k) => (
          <div key={k.label} className="rounded-[14px] p-5" style={surface}>
            <div className="flex items-center gap-2.5 text-[#8A8B91]">{k.icon}<span className="text-[12px] font-bold uppercase tracking-[0.12em]">{k.label}</span></div>
            <div className="text-white text-[24px] font-black mt-2 tabular-nums truncate" title={k.value}>{k.value}</div>
            <div className="text-[#8A8B91] text-[12px] mt-0.5 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" /><span className="truncate">{k.sub}</span></div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[14px] p-5 grid gap-3 content-start min-w-0" style={surface}>
        <h2 className="text-white text-[15px] font-bold">Clicks trend</h2>
        {trend.length === 0 || trend.every((t) => t.clicks === 0) ? (
          <p className="text-[#8A8B91] text-[13px]">No clicks in range yet — share a link to test.</p>
        ) : (
          <div className="h-[220px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: '#8A8B91', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} minTickGap={24} />
                <YAxis tick={{ fill: '#8A8B91', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#16171D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} labelFormatter={(label, payload) => (payload?.[0]?.payload as { day?: string } | undefined)?.day ?? label} />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#FF2B55" fill="#FF2B55" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-[14px] p-5 grid gap-3 content-start min-w-0" style={surface}>
        <h2 className="text-white text-[15px] font-bold">Top links by clicks</h2>
        {topLinks.length === 0 ? (
          <p className="text-[#8A8B91] text-[13px]">No links yet.</p>
        ) : (
          topLinks.map((l) => (
            <div key={l.id} className="grid gap-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                <span className="text-white font-semibold truncate" title={l.slug}>/{l.slug} <span className="text-[#8A8B91] font-normal">· {l.duration || '—'}</span></span>
                <span className="text-[#8A8B91] tabular-nums shrink-0">{(l.clicks || 0).toLocaleString()} clicks</span>
              </div>
              <Bar pct={((l.clicks || 0) / maxClicks) * 100} color="#FF2B55" />
            </div>
          ))
        )}
      </div>

      <div className="mt-3 rounded-[14px] p-5 grid gap-3 content-start min-w-0" style={surface}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-white text-[15px] font-bold">Live activity</h2>
          <span className="text-[#8A8B91] text-[12px]">Latest {events.length} click events · live</span>
        </div>
        {events.length === 0 && connected ? (
          <p className="text-[#8A8B91] text-[13px]">No click events yet — events appear here once humans open /epN links (edge writes link_events).</p>
        ) : (
          <div className="grid gap-2 content-start">
            {events.slice(0, 30).map((e) => (
              <div key={e.id} className="flex items-center gap-3 text-[13px] min-w-0 rounded-[10px] px-3 py-2" style={inputStyle}>
                <span className="text-[11px] font-black uppercase tracking-[0.08em] px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}>click</span>
                <span className="text-white font-semibold truncate">/{e.slug}</span>
                <span className="text-[#8A8B91] truncate hidden sm:inline">{e.referrerHost || 'Direct'}</span>
                {!connected && <Loader2 size={13} className="animate-spin text-[#8A8B91]" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
