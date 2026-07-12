import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { DashboardNotice } from './DashboardNotice';

export type DashboardTab = 'flows' | 'education' | 'contacts' | 'export';

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'flows', label: 'Fluxos' },
  { id: 'education', label: 'Materiais' },
  { id: 'contacts', label: 'Contatos' },
  { id: 'export', label: 'Exportar' },
];

export function DashboardShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: ReactNode;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function activateTabAtIndex(index: number) {
    const tab = tabs[index];
    if (!tab) return;

    onTabChange(tab.id);
    tabRefs.current[index]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number;

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    activateTabAtIndex(nextIndex);
  }

  return (
    <div className="flex flex-col gap-stack-md">
      <DashboardNotice />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Áreas do dashboard">
        {tabs.map((tab, tabIndex) => (
          <button
            key={tab.id}
            ref={(button) => {
              tabRefs.current[tabIndex] = button;
            }}
            id={`dashboard-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`dashboard-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
            className={`min-h-11 rounded-full px-4 font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section id={`dashboard-panel-${activeTab}`} role="tabpanel" aria-labelledby={`dashboard-tab-${activeTab}`}>
        {children}
      </section>
    </div>
  );
}
