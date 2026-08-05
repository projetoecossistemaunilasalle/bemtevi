import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { FileEdit } from 'lucide-react';
import { DashboardNotice } from './DashboardNotice';
import type { DashboardPublishMode } from '../publishing/publishMode';

export type DashboardTab = 'flows' | 'education' | 'contacts' | 'analytics' | 'export';

export function DashboardShell({
  activeTab,
  onTabChange,
  publishMode,
  pendingChanges,
  draftUpdatedAt,
  tabErrorCounts,
  children,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  publishMode: DashboardPublishMode;
  pendingChanges?: number;
  draftUpdatedAt?: string | null;
  tabErrorCounts?: Partial<Record<DashboardTab, number>>;
  children: ReactNode;
}) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const finalTabLabel = publishMode === 'database' ? 'Publicar' : 'Exportar';
  const tabs: Array<{ id: DashboardTab; label: string }> = [
    { id: 'flows', label: 'Fluxos' },
    { id: 'education', label: 'Materiais' },
    { id: 'contacts', label: 'Contatos' },
    { id: 'analytics', label: 'Estatísticas' },
    { id: 'export', label: finalTabLabel },
  ];
  const hasPendingChanges = typeof pendingChanges === 'number' && pendingChanges > 0;

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
      {activeTab !== 'analytics' && <DashboardNotice />}
      {hasPendingChanges && (
        <p className="flex w-fit items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 font-label-md text-on-surface-variant">
          <FileEdit className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Rascunho local · {pendingChanges} {pendingChanges === 1 ? 'alteração pendente' : 'alterações pendentes'}
            {draftUpdatedAt ? ` · salvo às ${formatSavedTime(draftUpdatedAt)}` : ''}
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Áreas do dashboard">
        {tabs.map((tab, tabIndex) => {
          const errorCount = tabErrorCounts?.[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              ref={(button) => {
                tabRefs.current[tabIndex] = button;
              }}
              id={`dashboard-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="dashboard-tabpanel"
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
              title={errorCount > 0 ? `${tab.label} — ${errorCount} ${errorCount === 1 ? 'erro' : 'erros'}` : undefined}
              className={`min-h-11 rounded-full px-4 font-label-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                activeTab === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="relative inline-flex items-center">
                {tab.label}
                {errorCount > 0 && (
                  <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-error" />
                )}
              </span>
            </button>
          );
        })}
      </div>
      <section id="dashboard-tabpanel" role="tabpanel" aria-labelledby={`dashboard-tab-${activeTab}`}>
        {children}
      </section>
    </div>
  );
}

const savedTimeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function formatSavedTime(isoString: string) {
  return savedTimeFormatter.format(new Date(isoString));
}
