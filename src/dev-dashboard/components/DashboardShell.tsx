import type { ReactNode } from 'react';
import { DashboardNotice } from './DashboardNotice';

export type DashboardTab = 'flows' | 'education' | 'export';

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: 'flows', label: 'Fluxos' },
  { id: 'education', label: 'Materiais' },
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
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="flex flex-col gap-stack-md">
      <DashboardNotice />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Áreas do dashboard">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
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
      <section role="tabpanel" aria-label={activeTabLabel}>
        {children}
      </section>
    </div>
  );
}
