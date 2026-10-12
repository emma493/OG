import { NavLink } from 'react-router-dom';
import { ChartNoAxesColumn, Clapperboard, LayoutDashboard, UploadCloud, Wrench } from 'lucide-react';

const linkBase =
  'flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[14px] font-semibold transition-colors no-underline';
const linkIdle = 'text-[#A1A2A7] hover:bg-white/[0.06] hover:text-white';
const linkActive = 'bg-[#FF2B55]/[0.12] text-white';

export default function Sidebar() {
  return (
    <aside
      className="w-[248px] shrink-0 min-h-screen flex flex-col px-4 py-5 max-lg:hidden"
      style={{ background: '#16171D', borderRight: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="px-2 mb-8">
        <div className="text-white text-[19px] font-black tracking-tight">Og Maker</div>
        <div className="text-[#8A8B91] text-[12px] font-semibold mt-0.5">Link dashboard</div>
      </div>
      <nav className="flex flex-col gap-1">
        <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <LayoutDashboard size={18} strokeWidth={2.2} />
          Dashboard
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <UploadCloud size={18} strokeWidth={2.2} />
          Add Links
        </NavLink>
        <NavLink to="/all" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <Clapperboard size={18} strokeWidth={2.2} />
          All Links
        </NavLink>
        <NavLink to="/manage" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <Wrench size={18} strokeWidth={2.2} />
          Manage Links
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : linkIdle}`}>
          <ChartNoAxesColumn size={18} strokeWidth={2.2} />
          Analytics
        </NavLink>
      </nav>
    </aside>
  );
}
