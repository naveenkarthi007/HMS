import { NavLink } from 'react-router-dom';
import { Building2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePlatformView } from '../../context/PlatformViewContext';
import { getNavigation } from '../../routes/navigation';
import { ROLE_LABELS } from '../../lib/format';

function NavItems({ sections, collapsed, onNavigate }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
      {sections.map((section, index) => (
        <div key={section.title || index} className={index > 0 ? 'mt-4 border-t border-gray-100 pt-4' : ''}>
          {section.title &&
            (collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-gray-200" />
            ) : (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-amber-600">{section.title}</p>
            ))}
          <div className="space-y-1">
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  } ${collapsed ? 'justify-center' : ''}`
                }
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed }) {
  return (
    <div className={`flex h-16 items-center gap-2.5 px-5 ${collapsed ? 'justify-center px-0' : ''}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
        <Building2 className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-semibold text-gray-900">HostelHub</p>
          <p className="text-xs text-gray-500">Management System</p>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, mobileOpen, onCloseMobile }) {
  const { user } = useAuth();
  const { org } = usePlatformView();
  const sections = getNavigation(user?.role, org);

  return (
    <>
      {/* Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-gray-200 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <Brand collapsed={collapsed} />
        <NavItems sections={sections} collapsed={collapsed} />
        {!collapsed && (
          <div className="border-t border-gray-100 p-4 text-xs text-gray-500">
            Signed in as <span className="font-medium text-gray-700">{ROLE_LABELS[user?.role]}</span>
          </div>
        )}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${mobileOpen ? '' : 'pointer-events-none'}`}
        // inert keeps the closed drawer out of the tab order and the accessibility tree.
        inert={mobileOpen ? undefined : ''}
      >
        <div
          className={`absolute inset-0 bg-gray-900/50 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={onCloseMobile}
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-soft-lg transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between pr-3">
            <Brand collapsed={false} />
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <NavItems sections={sections} collapsed={false} onNavigate={onCloseMobile} />
        </aside>
      </div>
    </>
  );
}
