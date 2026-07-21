import { Brain, Compass, Gauge, GraduationCap, HeartHandshake, Home, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useAdminAuth } from '../auth/AdminAuthContext';
import { canShowDevDashboard } from '../devDashboard';
import { Link, NavLink } from 'react-router-dom';
import { routes } from '../routes';

function getNavItems(showDashboard: boolean) {
  return [
    { to: routes.home, label: 'Início', Icon: Home },
    { to: routes.orientation, label: 'Orientação', Icon: Compass },
    { to: routes.education, label: 'Estudos', Icon: GraduationCap },
    { to: routes.contacts, label: 'Contatos', Icon: Users },
    { to: routes.support, label: 'Apoio', Icon: HeartHandshake },
    ...(showDashboard ? [{ to: routes.dashboard, label: 'Dashboard', Icon: Gauge }] : []),
  ];
}

export function TopBar() {
  const { account, status, logout } = useAdminAuth();
  const showAdmin = status === 'authenticated' && account !== null && canShowDevDashboard();

  return (
    <header className="bg-surface sticky top-0 z-40 w-full border-b border-outline-variant/30">
      <div className="flex items-center px-container-padding-mobile h-16 w-full max-w-7xl mx-auto justify-between">
        <Link to={routes.home} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Brain className="text-primary" size={28} />
          <span className="font-headline-lg-mobile text-primary">BemTeVi</span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-3" aria-label="Navegação principal">
            {getNavItems(showAdmin).map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `font-label-md px-4 py-2 min-h-11 flex items-center gap-2 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} fill="none" strokeWidth={isActive ? 2.5 : 2} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {showAdmin ? (
            <div className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary-fixed/35 p-1 pl-2">
              <ShieldCheck className="text-primary" size={18} aria-hidden="true" />
              <span className="hidden lg:inline max-w-40 truncate font-label-md text-on-surface" title={account.email}>
                {account.email}
              </span>
              <Link
                to={routes.dashboard}
                className="md:hidden min-h-9 rounded-full px-2 py-2 font-label-md text-primary hover:bg-surface"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => void logout().catch(() => undefined)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 font-label-md text-primary hover:bg-surface"
              >
                <LogOut size={16} aria-hidden="true" />
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
