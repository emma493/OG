import { memo } from 'react';
import type { ReactNode } from 'react';

const StatCard = memo(function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-[14px] p-5" style={{ background: '#1E1F27', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center gap-2.5 text-[#8A8B91]">
        {icon}
        <span className="text-[12px] font-bold uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className="text-white text-[28px] font-black mt-2 tabular-nums truncate" title={value}>
        {value}
      </div>
      <div className="text-[#8A8B91] text-[12px] mt-0.5 flex items-center gap-1.5 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
        <span className="truncate">{sub}</span>
      </div>
    </div>
  );
});

export default StatCard;
