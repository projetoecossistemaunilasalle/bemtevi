import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bot, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../../design-system/components/Button';
import type { AgentConnection } from '@bemtevi/content-core';
import { ConnectionRepository } from './connectionRepository';
import { ConnectionCreateDialog } from './ConnectionCreateDialog';
import { ConnectionList } from './ConnectionList';

/**
 * Connected assistants section (docs 04/06/16, task AI-FILE-02).
 *
 * Receives EXACTLY `{ repository, authUrl, dataApiUrl }`. It is the second AI
 * surface in the dashboard: the file-first ChatGPT flow comes before it.
 * It owns no route state and no publish toggle — a connection is full
 * delegated edit/publication authority from its creating admin, and the only
 * permission change is revocation.
 */

type LoadStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; connections: AgentConnection[] }
  | { kind: 'error'; message: string };

export function ConnectedAssistantsSection({
  repository,
  authUrl,
  dataApiUrl,
}: {
  repository: ConnectionRepository;
  authUrl: string;
  dataApiUrl: string;
}) {
  const [status, setStatus] = useState<LoadStatus>({ kind: 'loading' });
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    const result = await repository.list();
    if (result.ok === true) {
      setStatus({ kind: 'ready', connections: result.data });
      return;
    }
    setStatus({
      kind: 'error',
      message:
        result.error.code === 'unauthorized'
          ? 'Não foi possível listar as conexões: você precisa estar autenticado como administrador.'
          : 'Não foi possível listar as conexões. Tente atualizar em instantes.',
    });
  }, [repository]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Bot aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline-sm text-on-surface">Assistentes conectados</h2>
          <p className="mt-1 max-w-[75ch] font-body-md text-on-surface-variant">
            Caminho avançado: conecte um assistente com IA que edita o rascunho compartilhado e publica em seu nome pelo
            protocolo verificado do BemTeVi. Para edições pontuais, use o fluxo por arquivo acima — ele não exige
            instalação.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-surface-container-low p-4">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
        <p className="font-body-sm text-on-surface-variant">
          Uma conexão age como o administrador que a criou: pode editar o rascunho e publicar conteúdo. Vale por um ano
          e não é renovável; depois disso crie uma nova. Nunca compartilhe a chave da conexão. Não existe permissão
          parcial de publicação: a única forma de retirar o acesso é revogar a conexão.
        </p>
      </div>

      {status.kind === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 p-4 text-on-error-container"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-body-sm">{status.message}</p>
            <Button variant="secondary" size="sm" onClick={() => void refresh()}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      )}

      {status.kind === 'ready' && (
        <ConnectionList connections={status.connections} repository={repository} onChanged={() => void refresh()} />
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setDialogOpen(!dialogOpen)} disabled={status.kind === 'loading'}>
          {dialogOpen ? 'Cancelar criação de conexão' : 'Conectar um assistente'}
        </Button>
      </div>

      {dialogOpen && (
        <ConnectionCreateDialog
          repository={repository}
          authUrl={authUrl}
          dataApiUrl={dataApiUrl}
          onClose={() => setDialogOpen(false)}
          onCreated={() => void refresh()}
        />
      )}
    </section>
  );
}
