import { useEffect, useMemo, useState } from 'react';
import { Eye, Link2, MousePointerClick, PlusCircle } from 'lucide-react';
import DateRangeFilter, { type DatePreset } from '../components/DateRangeFilter';
import StatCard from '../components/StatCard';
import { subscribeToLinks } from '../lib/ogFirebase';
import { getDateStrFromTimestamp, getFormattedDate, getPresetDates, isDateInRange, normalizeDateRange } from '../lib/utils';
import type { OgLinkDocument } from '../types';

export default function DashboardPage() {
  const [preset, setPreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState(() => getFormattedDate(0));
  const [customEnd, setCustomEnd] = useState(() => getFormattedDate(0));
  const [links, setLinks] = useState<OgLinkDocument[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => subscribeToLinks((list) => { setLinks(list); setLive(true); }, () => setLive(false)), []);

  const { startDate, endDate } = useMemo(() => {
    if (preset === 'custom') return normalizeDateRange(customStart, customEnd);
    return getPresetDates(preset);
  }, [preset, customStart, customEnd]);

  const rangeLabel = preset === 'all' || (!startDate && !endDate) ? 'All time' : startDate === endDate ? startDate : `${startDate} → ${endDate}`;

  const inRange = useMemo(
    () => links.filter((l) => isDateInRange(getDateStrFromTimestamp(l.createdAt), startDate || undefined, endDate || undefined)),
    [links, startDate, endDate],
  );

  const totalLinks = links.length;
  const totalClicks = useMemo(() => links.reduce((a, l) => a + (l.clicks || 0), 0), [links]);
  const rangeClicks = useMemo(() => inRange.reduce((a, l) => a + (l.clicks || 0), 0), [inRange]);
  const avg = totalLinks ? (totalClicks / totalLinks).toFixed(1) : '0';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-white text-[22px] font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-[#8A8B91] text-[13px] mt-1">{live ? `Live — Firestore real-time · ${rangeLabel}` : 'Connecting to Firestore…'}</p>
        </div>
        <DateRangeFilter
          ariaLabel="Dashboard date range"
          preset={preset}
          onPresetChange={setPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={(s, e) => { const n = normalizeDateRange(s, e); setCustomStart(n.startDate); setCustomEnd(n.endDate); }}
        />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Link2 size={15} />} label="Total links" value={String(totalLinks)} sub={rangeLabel} />
        <StatCard icon={<MousePointerClick size={15} />} label="Total clicks" value={totalClicks.toLocaleString()} sub={rangeLabel} />
        <StatCard icon={<Eye size={15} />} label="Clicks in range" value={rangeClicks.toLocaleString()} sub={`${inRange.length} links`} />
        <StatCard icon={<PlusCircle size={15} />} label="Avg clicks / link" value={avg} sub={live ? 'live' : 'connecting'} />
      </div>
    </div>
  );
}
