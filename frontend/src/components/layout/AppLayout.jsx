import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { useAccess } from '../../hooks/useAccess';
import { usePlatformView } from '../../context/PlatformViewContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const COLLAPSE_KEY = 'hms.sidebar.collapsed';

function PlatformViewBanner() {
  const { platformView, viewingOrg } = useAccess();
  const { exit } = usePlatformView();
  const { pathname } = useLocation();
  if (!platformView || !pathname.startsWith('/admin')) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        Viewing <span className="font-semibold">{viewingOrg.name}</span> as platform admin. Everything here is
        read-only.
      </p>
      <button
        type="button"
        onClick={() => exit()}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-amber-100"
      >
        <X className="h-4 w-4" /> Exit view
      </button>
    </div>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div
        className={`flex min-h-screen flex-col transition-[padding] duration-200 ${collapsed ? 'lg:pl-20' : 'lg:pl-64'}`}
      >
        <Topbar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <PlatformViewBanner />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
