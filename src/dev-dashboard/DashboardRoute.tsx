import { useMemo, useState } from 'react';
import { Page } from '../design-system/components/Page';
import { PageHeader } from '../design-system/components/PageHeader';
import { DashboardShell, type DashboardTab } from './components/DashboardShell';
import { getShippedDashboardContent } from './content/shippedContent';
import { FlowDashboard } from './flows/FlowDashboard';

export function DashboardRoute() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('flows');
  const shipped = useMemo(() => getShippedDashboardContent(), []);

  return (
    <Page>
      <PageHeader title="Dashboard" description="Rascunhos locais para fluxos e materiais educativos." />
      <DashboardShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'flows' && <FlowDashboard flows={shipped.flows} resources={shipped.educationMaterials} />}
        {activeTab === 'education' && (
          <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
            <h2 className="font-headline-sm text-on-surface">Materiais</h2>
          </section>
        )}
        {activeTab === 'export' && (
          <section className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
            <h2 className="font-headline-sm text-on-surface">Exportar</h2>
          </section>
        )}
      </DashboardShell>
    </Page>
  );
}
