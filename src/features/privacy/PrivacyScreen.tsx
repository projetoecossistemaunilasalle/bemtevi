import { Shield } from 'lucide-react';
import { Card } from '../../design-system/components/Card';
import { Page } from '../../design-system/components/Page';
import { PageHeader } from '../../design-system/components/PageHeader';

export function PrivacyScreen() {
  return (
    <Page width="narrow">
      <PageHeader
        title="Privacidade"
        description="O SeCuida deve ser anônimo por padrão e não deve salvar respostas, histórico de conversa ou localização sem revisão de privacidade."
        icon={<Shield className="text-primary" size={32} />}
      />

      <Card className="p-6">
        <h2 className="font-headline-sm text-on-surface mb-3">Política de sessão atual</h2>
        <p className="font-body-md text-on-surface-variant">
          Nesta fase, o app usa apenas estado em memória para a interação atual. Não há login, identificação pessoal, analytics ou persistência de dados sensíveis.
        </p>
      </Card>
    </Page>
  );
}
