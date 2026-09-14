import { useState } from 'react';
import { AlertCircle, CalendarClock, History, RefreshCw, ShieldOff } from 'lucide-react';
import { Button } from '../../../design-system/components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import type { AgentConnection } from '@bemtevi/content-core';
import { ConnectionRepository } from './connectionRepository';

/**
 * Connected assistants list (docs 06/16, task AI-FILE-02): metadata-only
 * listing with expiry and last-use information, plus explicit two-step
 * revocation. All admins may list/revoke; creation always binds to self.
 * No publish-permission toggle exists — delegated authority is total and
 * revocable only.
 */

type ListStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'revoking'; id: string };

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function describeDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'data desconhecida' : dateTimeFormat.format(date);
}

function status(connection: AgentConnection, now: Date): { label: string; tone: 'active' | 'expired' | 'revoked' } {
  if (connection.revokedAt !== null) return { label: 'Revogada', tone: 'revoked' };
  if (new Date(connection.expiresAt).getTime() <= now.getTime()) return { label: 'Expirada', tone: 'expired' };
  return { label: 'Ativa', tone: 'active' };
}

const toneClasses = {
  active: 'border-primary/30 bg-primary-container/20 text-on-surface',
  expired: 'border-outline-variant/60 bg-surface-container-low text-on-surface-variant',
  revoked: 'border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant',
} as const;

export function ConnectionList({
  connections,
  repository,
  onChanged,
}: {
  connections: AgentConnection[];
  repository: ConnectionRepository;
  onChanged(): void;
}) {
  const [listStatus, setListStatus] = useState<ListStatus>({ kind: 'idle' });
  const [now] = useState(() => new Date());

  async function revoke(id: string) {
    if (listStatus.kind === 'revoking') return;
    setListStatus({ kind: 'revoking', id });
    const result = await repository.revoke(id);
    if (result.ok) {
      setListStatus({ kind: 'idle' });
      onChanged(); // stale list refresh after completion (doc 16)
      return;
    }
    setListStatus({ kind: 'error', message: 'Não foi possível revogar a conexão. Tente novamente.' });
  }

  return (
    <div className="flex flex-col gap-3">
      {listStatus.kind === 'error' && (
        <p role="alert" className="flex items-start gap-2 font-body-sm text-on-error-container">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {listStatus.message}
        </p>
      )}
      {connections.length === 0 ? (
        <p className="font-body-md text-on-surface-variant">
          Nenhuma conexão de assistente registrada. A edição via arquivo com o ChatGPT não exige conexão.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {connections.map((connection) => {
            const state = status(connection, now);
            const busy = listStatus.kind === 'revoking';
            return (
              <li
                key={connection.id}
                className={`flex flex-col gap-2 rounded-lg border p-4 ${toneClasses[state.tone]}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-label-md font-semibold">{connection.label}</span>
                  <span className="font-label-md">
                    {state.tone === 'active' ? 'Ativa' : state.tone === 'expired' ? 'Expirada' : 'Revogada'}
                  </span>
                </div>
                <dl className="grid gap-1 font-body-sm sm:grid-cols-2">
                  <div className="flex items-start gap-1.5">
                    <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <dt className="font-label-md">Criada em</dt>
                      <dd>{describeDate(connection.createdAt)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <dt className="font-label-md">Expira em</dt>
                      <dd>{describeDate(connection.expiresAt)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <History aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <dt className="font-label-md">Último uso</dt>
                      <dd>{connection.lastUsedAt === null ? 'Nunca usado' : describeDate(connection.lastUsedAt)}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <dt className="font-label-md">Situação</dt>
                      <dd>
                        {connection.revokedAt === null
                          ? 'Delegada no seu nome'
                          : `Revogada em ${describeDate(connection.revokedAt)}`}
                      </dd>
                    </div>
                  </div>
                </dl>
                {connection.revokedAt === null && new Date(connection.expiresAt).getTime() > now.getTime() && (
                  <div className="flex flex-wrap items-center gap-3">
                    <ConfirmButton
                      prompt="Revogar acesso"
                      confirmLabel="Confirmar revogação"
                      disabled={busy}
                      onConfirm={() => void revoke(connection.id)}
                    />
                    {listStatus.kind === 'revoking' && listStatus.id === connection.id && (
                      <span className="inline-flex items-center gap-2 font-body-sm text-on-surface-variant">
                        <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
                        Revogando...
                      </span>
                    )}
                    <span className="font-body-sm text-on-surface-variant">
                      A revogação é imediata e definitiva. O assistente perde o acesso; o registro permanece para
                      auditoria.
                    </span>
                  </div>
                )}
                {(connection.revokedAt !== null || new Date(connection.expiresAt).getTime() <= now.getTime()) && (
                  <p className="font-body-sm text-on-surface-variant">
                    {connection.revokedAt !== null
                      ? 'Esta conexão não pode mais ser usada. Crie uma nova conexão se precisar novamente.'
                      : 'Conexões expiradas não podem ser renovadas. Crie uma nova conexão para continuar.'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {listStatus.kind === 'revoking' && (
        <Button variant="secondary" disabled aria-label="Ações bloqueadas durante a revogação">
          Aguarde a revogação terminar
        </Button>
      )}
    </div>
  );
}
