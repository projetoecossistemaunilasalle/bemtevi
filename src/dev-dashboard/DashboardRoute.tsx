import { useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';

export function DashboardRoute() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('flows');

  return (
    <Page>
      <PageHeader title="Dashboard" description="Rascunhos locais para fluxos e materiais educativos." />
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
        <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
          <h2 className="font-headline-sm text-on-surface">
            {activeTab === 'flows' ? 'Fluxos' : activeTab === 'education' ? 'Materiais' : 'Exportar'}
          </h2>
        </section>
      </DashboardShell>
    </Page>
  );
}
