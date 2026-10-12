import { useEffect, useMemo, useState } from 'react';
import { Download, Eye, Link2, Loader2, MousePointerClick } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DateRangeFilter, { type DatePreset } from '../components/DateRangeFilter';
import { subscribeToEventsInRange, subscribeToLinks } from '../lib/ogFirebase';
import { countryFlag, normalizeDeviceType } from '../lib/device';
import { getDateStrFromTimestamp, getFormattedDate, getPresetDates, isDateInRange, normalizeDateRange } from '../lib/utils';
import type { OgLinkDocument } from '../types';

const surface = { background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' };
const inputStyle = { background: '#16171D', border: '1px solid rgba(255,255,255,0.1)' };

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden min-w-0">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

const DEVICE_COLORS: Record<string, string> = {
  Mobile: '#38bdf8',
  Tablet: '#a78bfa',
  Desktop: '#34d399',
};

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<DatePreset>('30days');
  const [customStart, setCustomStart] = useState(() => getFormattedDate(0));
  const [customEnd, setCustomEnd] = useState(() => getFormattedDate(0));
  const [links, setLinks] = useState<OgLinkDocument[]>([]);
  const [events, setEvents] = useState<import('../types').OgLinkEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => subscribeToLinks((list) => { setLinks(list); setConnected(true); }, () => setConnected(false)), []);
  useEffect(() => subscribeToEventsInRange('', '', setEvents), []);

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

  const eventsInRange = useMemo(() => {
    if (preset === 'all') return events;
    return events.filter((e) => isDateInRange(getDateStrFromTimestamp(e.timestamp), startDate || undefined, endDate || undefined));
  }, [events, preset, startDate, endDate]);

  const topLinks = useMemo(() => [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10), [links]);
  const maxClicks = topLinks[0]?.clicks || 1;

  // Clicks trend from link_events (falls back to createdAt distribution when empty).
  const trend = useMemo(() => {
    const buckets = new Map<string, number>();
    const push = (day: string) => buckets.set(day, (buckets.get(day) ?? 0) + 1);
    if (eventsInRange.length > 0) {
      for (const e of eventsInRange) push(getDateStrFromTimestamp(e.timestamp));
    } else {
      for (const l of linksInRange) push(getDateStrFromTimestamp(l.lastClickedAt || l.createdAt));
    }
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([day, clicks]) => ({ day, label: day.slice(5), clicks }));
  }, [eventsInRange, linksInRange]);

  // ---- Referral sources (by host) + UTM campaigns ----
  const refGroups = useMemo(() => {
    const map = new Map<string, { views: number; topUtm: Record<string, number> }>();
    for (const e of eventsInRange) {
      const host = (e.referrerHost || '').toLowerCase() || 'Direct';
      const cur = map.get(host) ?? { views: 0, topUtm: {} };
      cur.views += 1;
      if (e.utmSource) cur.topUtm[e.utmSource] = (cur.topUtm[e.utmSource] ?? 0) + 1;
      map.set(host, cur);
    }
    const total = [...map.values()].reduce((a, v) => a + v.views, 0) || 1;
    return [...map.entries()]
      .map(([host, s]) => ({
        host,
        views: s.views,
        pct: (s.views / total) * 100,
        topUtm: Object.entries(s.topUtm).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [eventsInRange]);

  const topUtms = useMemo(() => {
    const map = new Map<string, { source: string; medium: string; campaign: string; views: number }>();
    for (const e of eventsInRange) {
      if (!e.utmSource && !e.utmCampaign) continue;
      const key = `${e.utmSource || '—'}|${e.utmMedium || '—'}|${e.utmCampaign || '—'}`;
      const cur = map.get(key) ?? { source: e.utmSource || '—', medium: e.utmMedium || '—', campaign: e.utmCampaign || '—', views: 0 };
      cur.views += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.views - a.views).slice(0, 8);
  }, [eventsInRange]);
  const maxUtmViews = topUtms[0]?.views || 1;

  // ---- Devices (Mobile / Tablet / Desktop) ----
  const devices = useMemo(() => {
    const counts = { Mobile: 0, Tablet: 0, Desktop: 0 };
    for (const e of eventsInRange) counts[normalizeDeviceType(e.deviceType, e.userAgent)] += 1;
    const total = counts.Mobile + counts.Tablet + counts.Desktop || 1;
    return (Object.keys(counts) as (keyof typeof counts)[]).map((name) => ({
      name,
      value: counts[name],
      pct: (counts[name] / total) * 100,
      color: DEVICE_COLORS[name],
    }));
  }, [eventsInRange]);
  const deviceTotal = devices.reduce((a, d) => a + d.value, 0);

  // ---- Countries (clicks only — events carry no user identity for uniques) ----
  const countries = useMemo(() => {
    const map = new Map<string, { views: number; hosts: Record<string, number> }>();
    for (const e of eventsInRange) {
      const code = (e.country || '').toUpperCase() || '—';
      const cur = map.get(code) ?? { views: 0, hosts: {} };
      cur.views += 1;
      const host = (e.referrerHost || '').toLowerCase() || 'Direct';
      cur.hosts[host] = (cur.hosts[host] ?? 0) + 1;
      map.set(code, cur);
    }
    const total = [...map.values()].reduce((a, v) => a + v.views, 0) || 1;
    return [...map.entries()]
      .map(([code, s]) => ({
        code,
        views: s.views,
        pct: (s.views / total) * 100,
        topHost: Object.entries(s.hosts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Direct',
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [eventsInRange]);
  const maxCountryViews = countries[0]?.views || 1;

  const exportCsv = () => {
    const esc = (v: unknown): string => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [`# Og analytics export — ${rangeLabel}`, 'slug,url,clicks,sourceUrl,duration'];
    for (const l of topLinks) lines.push([l.slug, `${window.location.origin}/${l.slug}`, l.clicks || 0, l.sourceUrl, l.duration].map(esc).join(','));
    lines.push('', 'day,clicks');
    for (const t of trend) lines.push([t.day, t.clicks].map(esc).join(','));
    lines.push('', 'referrer_host,clicks,sharePct,topUtm');
    for (const r of refGroups) lines.push([r.host, r.views, `${r.pct.toFixed(1)}%`, r.topUtm].map(esc).join(','));
    lines.push('', 'utm_source,utm_medium,utm_campaign,clicks');
    for (const u of topUtms) lines.push([u.source, u.medium, u.campaign, u.views].map(esc).join(','));
    lines.push('', 'device,clicks,sharePct');
    for (const d of devices) lines.push([d.name, d.value, `${d.pct.toFixed(1)}%`].map(esc).join(','));
    lines.push('', 'country,clicks,sharePct,topHost');
    for (const c of countries) lines.push([c.code, c.views, `${c.pct.toFixed(1)}%`, c.topHost].map(esc).join(','));
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
          { icon: <Download size={15} />, label: 'Events tracked', value: String(events.length), sub: `${eventsInRange.length} in range` },
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

      <div className="mt-3 grid gap-3 lg:grid-cols-3 items-start">
        <div className="rounded-[14px] p-5 grid gap-3 content-start min-w-0" style={surface}>
          <h2 className="text-white text-[15px] font-bold">Referral sources</h2>
          <p className="text-[#8A8B91] text-[12px]">{eventsInRange.length} clicks in range · host + UTM</p>
          {refGroups.length === 0 ? (
            <p className="text-[#8A8B91] text-[13px]">No referrer data in range yet.</p>
          ) : (
            refGroups.map((r) => (
              <div key={r.host} className="grid gap-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                  <span className="text-white font-semibold truncate" title={r.host}>{r.host} <span className="text-[#8A8B91] font-normal">· {r.topUtm}</span></span>
                  <span className="text-[#8A8B91] tabular-nums shrink-0">{r.views} · {r.pct.toFixed(0)}%</span>
                </div>
                <Bar pct={r.pct} color="#fbbf24" />
              </div>
            ))
          )}
          <h3 className="text-white text-[13px] font-bold mt-1">UTM campaigns</h3>
          {topUtms.length === 0 ? (
            <p className="text-[#8A8B91] text-[12px]">No UTM-tagged clicks in range. Try <span className="text-white">?utm_source=tiktok&amp;utm_medium=social&amp;utm_campaign=launch</span></p>
          ) : (
            topUtms.map((u) => (
              <div key={`${u.source}|${u.medium}|${u.campaign}`} className="grid gap-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                  <span className="text-white font-semibold truncate" title={`${u.source} / ${u.medium} / ${u.campaign}`}>{u.source} <span className="text-[#8A8B91] font-normal">· {u.medium} · {u.campaign}</span></span>
                  <span className="text-[#8A8B91] tabular-nums shrink-0">{u.views}</span>
                </div>
                <Bar pct={(u.views / maxUtmViews) * 100} color="#a78bfa" />
              </div>
            ))
          )}
        </div>

        <div className="rounded-[14px] p-5 grid gap-3 content-start min-w-0" style={surface}>
          <h2 className="text-white text-[15px] font-bold">Devices</h2>
          {deviceTotal === 0 ? (
            <p className="text-[#8A8B91] text-[13px]">No clicks in range yet.</p>
          ) : (
            <>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={devices} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                      {devices.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#16171D', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {devices.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-[13px] min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-[#E1E2E6] flex-1 truncate">{d.name}</span>
                  <span className="text-[#8A8B91] tabular-nums shrink-0">{d.value} · {d.pct.toFixed(0)}%</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="rounded-[14px] p-5 grid gap-3 content-start min-w-0" style={surface}>
          <h2 className="text-white text-[15px] font-bold">Countries</h2>
          <p className="text-[#8A8B91] text-[12px]">Clicks only — events carry no user identity for uniques</p>
          {countries.length === 0 ? (
            <p className="text-[#8A8B91] text-[13px]">No country data in range yet — new clicks capture edge geo.</p>
          ) : (
            countries.map((c) => (
              <div key={c.code} className="grid gap-1.5 min-w-0">
                <div className="flex items-center justify-between gap-2 text-[13px] min-w-0">
                  <span className="text-white font-semibold truncate" title={`${c.code} · via ${c.topHost}`}>{c.code === '—' ? '🌐 —' : `${countryFlag(c.code)} ${c.code}`} <span className="text-[#8A8B91] font-normal">· {c.topHost}</span></span>
                  <span className="text-[#8A8B91] tabular-nums shrink-0">{c.views} · {c.pct.toFixed(0)}%</span>
                </div>
                <Bar pct={(c.views / maxCountryViews) * 100} color="#34d399" />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 rounded-[14px] p-5 grid gap-3 content-start min-w-0" style={surface}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-white text-[15px] font-bold">Live activity</h2>
          <span className="text-[#8A8B91] text-[12px]">Latest {events.length} click events · {eventsInRange.length} in range · live</span>
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
                <span className="shrink-0 text-[12px]" title={e.country || 'unknown geo'}>
                  {e.country ? `${countryFlag(e.country)} ${e.country}` : '🌐'}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-[#8A8B91] hidden md:inline">{normalizeDeviceType(e.deviceType, e.userAgent)}</span>
                {!connected && <Loader2 size={13} className="animate-spin text-[#8A8B91]" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
