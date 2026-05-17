import { Compass, GraduationCap, HeartHandshake, Home, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { routes } from '../routes';

const navItems = [
  { to: routes.home, label: 'Início', Icon: Home },
  { to: routes.orientation, label: 'Orientação', Icon: Compass },
  { to: routes.education, label: 'Estudos', Icon: GraduationCap },
  { to: routes.contacts, label: 'Contatos', Icon: Users },
  { to: routes.support, label: 'Apoio', Icon: HeartHandshake },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 w-full z-50 grid grid-cols-5 items-center px-2 py-2 bg-surface shadow-[0_-4px_12px_0_rgba(27,58,107,0.1)] rounded-t-xl md:hidden"
      aria-label="Navegação principal"
    >
      {navItems.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-14 px-1 py-1 duration-200 ease-in-out font-label-md rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
              isActive
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:text-primary'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} fill="none" className="mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] leading-tight">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
