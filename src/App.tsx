import { Suspense, lazy } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { ChartNoAxesColumn, Clapperboard, LayoutDashboard, UploadCloud, Wrench } from 'lucide-react';
import { db } from './lib/ogFirebase';
import Sidebar from './components/Sidebar';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AddLinksPage = lazy(() => import('./pages/AddLinksPage'));
const AllLinksPage = lazy(() => import('./pages/AllLinksPage'));
const ManageLinksPage = lazy(() => import('./pages/ManageLinksPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

function PageFallback() {
  return <div className="rounded-[14px] min-h-[240px] animate-pulse" style={{ background: '#1E1F27' }} />;
}

// Reference db so Firebase wiring stays compiled in the build.
void db;

const tabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/add', label: 'Add Links', icon: UploadCloud, end: false },
  { to: '/all', label: 'All Links', icon: Clapperboard, end: false },
  { to: '/manage', label: 'Manage', icon: Wrench, end: false },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn, end: false },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex" style={{ background: '#0F1014' }}>
        <Sidebar />
        <div className="flex-1 min-w-0">
          <div
            className="lg:hidden flex items-center gap-2 px-4 py-3 overflow-x-auto"
            style={{ background: '#16171D', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <span className="text-white font-black mr-2 shrink-0">Og</span>
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[13px] font-bold no-underline shrink-0 ${isActive ? 'text-white bg-[#FF2B55]/[0.14]' : 'text-[#A1A2A7]'}`
                }
              >
                <t.icon size={15} /> {t.label}
              </NavLink>
            ))}
          </div>
          <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/add" element={<AddLinksPage />} />
                <Route path="/all" element={<AllLinksPage />} />
                <Route path="/manage" element={<ManageLinksPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
