import { Brain, Compass, Gauge, GraduationCap, HeartHandshake, Home, Users } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { routes } from '../routes';

function getNavItems() {
  return [
    { to: routes.home, label: 'Início', Icon: Home },
    { to: routes.orientation, label: 'Orientação', Icon: Compass },
    { to: routes.education, label: 'Estudos', Icon: GraduationCap },
    { to: routes.contacts, label: 'Contatos', Icon: Users },
    { to: routes.support, label: 'Apoio', Icon: HeartHandshake },
    ...(import.meta.env.VITE_ENABLE_DEV_DASHBOARD === 'true'
      ? [{ to: routes.dashboard, label: 'Dashboard', Icon: Gauge }]
      : []),
  ];
}

export function TopBar() {
  return (
    <header className="bg-surface sticky top-0 z-40 w-full border-b border-outline-variant/30">
      <div className="flex items-center px-container-padding-mobile h-16 w-full max-w-7xl mx-auto justify-between">
        <Link to={routes.home} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Brain className="text-primary" size={28} />
          <span className="font-headline-lg-mobile text-primary">SeCuida</span>
        </Link>

        <nav className="hidden md:flex items-center gap-3" aria-label="Navegação principal">
          {getNavItems().map(({ to, label, Icon }) => (
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
      </div>
    </header>
  );
}
