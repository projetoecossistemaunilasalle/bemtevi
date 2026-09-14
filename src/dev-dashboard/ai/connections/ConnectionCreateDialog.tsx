import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, Download, KeyRound } from 'lucide-react';
import { Button } from '../../../design-system/components/Button';
import type { AgentConnection, Result } from '@bemtevi/content-core';
import { ConnectionRepository } from './connectionRepository';
import {
  MCP_CONFIG_FILE_NAME,
  generateAgentCredential,
  serializePortableMcpConfig,
  buildPortableMcpConfig,
  type AgentCredential,
} from './connectionConfig';

/**
 * One-time connection creation dialog (docs 04/16, task AI-FILE-02).
 *
 * Security rules frozen by the dossier:
 * - the secret (32 random bytes via Web Crypto) is generated only on the
 *   explicit `Criar` action and never regenerated on rerender;
 * - it exists ONLY in explicit component state for the one-time disclosure,
 *   is cleared on close/unmount and is never cached in storage;
 * - only the SHA-256 hash is sent to the repository, never the raw token;
 * - a lost create response is retried with the SAME UUID/hash (never a
 *   duplicate unseen connection);
 * - the download is the exact portable MCP JSON from doc 04.
 */

type DialogStatus =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'created'; connection: AgentConnection }
  | { kind: 'error'; message: string };

const COPY_RESET_MS = 2500;

export function ConnectionCreateDialog({
  repository,
  authUrl,
  dataApiUrl,
  onClose,
  onCreated,
}: {
  repository: ConnectionRepository;
  authUrl: string;
  dataApiUrl: string;
  onClose(): void;
  onCreated(connection: AgentConnection): void;
}) {
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<DialogStatus>({ kind: 'idle' });
  /** One-time credential; generated only by the explicit create action. */
  const [credential, setCredential] = useState<AgentCredential | null>(null);
  const [copied, setCopied] = useState(false);

  // Clear the secret on unmount: it exists only for the disclosure action.
  // The latest value is tracked in a ref kept in sync inside an effect, never
  // during render.
  const credentialRef = useRef<AgentCredential | null>(null);
  useEffect(() => {
    credentialRef.current = credential;
    return () => {
      credentialRef.current = null;
    };
  }, [credential]);

  function close() {
    // Closing the dialog unsets the secret immediately (doc 16).
    setCredential(null);
    onClose();
  }

  async function create() {
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: 'error', message: 'Dê um nome ao assistente antes de criar a conexão.' });
      return;
    }
    if (trimmed.length > 80) {
      setStatus({ kind: 'error', message: 'O nome do assistente deve ter até 80 caracteres.' });
      return;
    }
    if (status.kind === 'creating') return;
    setStatus({ kind: 'creating' });

    // The credential is generated only here (Web Crypto); a retry after an
    // ambiguous outcome reuses the SAME UUID/hash retained in state.
    let pending = credential;
    if (pending === null) {
      pending = await generateAgentCredential();
      setCredential(pending);
    }

    const result: Result<AgentConnection> = await repository.create(pending.connectionId, pending.tokenHash, trimmed);
    if (result.ok === true) {
      setStatus({ kind: 'created', connection: result.data });
      onCreated(result.data);
      return;
    }
    // A network-level failure leaves the registration ambiguous: keep the
    // same UUID/hash so the retry cannot create an unseen duplicate. Only a
    // domain error (invalid label etc.) discards the pending credential.
    if (result.error.code === 'unavailable' || result.error.code === 'unauthorized') {
      setStatus({
        kind: 'error',
        message:
          'Não foi possível confirmar a criação da conexão. Tente novamente: o mesmo identificador será reutilizado, sem duplicar a conexão.',
      });
      return;
    }
    setCredential(null);
    setStatus({ kind: 'error', message: describeCreateError(result.error.code) });
  }

  function copyToken() {
    const token = credential?.token ?? '';
    if (token === '' || typeof navigator === 'undefined' || navigator.clipboard === undefined) return;
    void navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_RESET_MS);
    });
  }

  function downloadConfig() {
    if (credential === null) return;
    const config = buildPortableMcpConfig({
      authUrl,
      dataApiUrl,
      connectionId: credential.connectionId,
      token: credential.token,
    });
    const blob = new Blob([serializePortableMcpConfig(config)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = MCP_CONFIG_FILE_NAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      role="dialog"
      aria-label="Nova conexão de assistente"
      className="flex flex-col gap-4 rounded-lg border border-primary/30 bg-surface-container-lowest p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-headline-sm text-on-surface">
            <KeyRound aria-hidden="true" className="h-5 w-5 text-primary" />
            Conectar um assistente
          </h3>
          <p className="mt-1 max-w-[75ch] font-body-md text-on-surface-variant">
            A conexão age em seu nome: pode editar o rascunho compartilhado e publicar conteúdo pelo protocolo
            verificado. Expira em exatamente um ano e não pode ser renovada — crie uma nova quando precisar.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={close} aria-label="Fechar criação de conexão">
          Fechar
        </Button>
      </div>

      <label htmlFor="connection-label" className="flex flex-col gap-1 font-body-md text-on-surface">
        Nome do assistente
        <input
          id="connection-label"
          value={label}
          maxLength={80}
          disabled={status.kind === 'creating' || (credential !== null && status.kind === 'created')}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex.: ChatGPT da coordenação"
          className="min-h-11 rounded-md border border-outline-variant bg-surface p-2"
        />
        <span className="font-body-sm text-on-surface-variant">
          Apenas para você identificar a conexão depois. Até 80 caracteres.
        </span>
      </label>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => void create()}
          disabled={status.kind === 'creating' || (credential !== null && status.kind === 'created')}
        >
          {status.kind === 'creating' ? 'Criando...' : 'Criar conexão'}
        </Button>
        {credential !== null && status.kind === 'error' && (
          <Button variant="secondary" onClick={() => void create()}>
            Tentar novamente com o mesmo identificador
          </Button>
        )}
      </div>

      {credential !== null && status.kind === 'created' && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary-container/20 p-4">
          <p className="flex items-start gap-2 font-label-md font-semibold text-on-surface">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            Conexão criada. Salve a configuração agora — a chave não será mostrada novamente.
          </p>
          <p className="font-body-sm text-on-surface-variant">
            Baixe o arquivo {MCP_CONFIG_FILE_NAME} e entregue-o ao assistente com quem for usar. Ele contém a chave de
            acesso: não compartilhe em canais públicos. Depois de fechar esta caixa, não é possível recuperar a chave.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={downloadConfig}>
              <Download aria-hidden="true" className="h-4 w-4" />
              Baixar {MCP_CONFIG_FILE_NAME}
            </Button>
            <Button variant="secondary" onClick={copyToken}>
              <Copy aria-hidden="true" className="h-4 w-4" />
              {copied ? 'Chave copiada' : 'Copiar chave'}
            </Button>
          </div>
          <p className="font-body-sm text-on-surface-variant">
            A chave copiada fica no histórico da área de transferência do seu dispositivo. Copie apenas para o
            assistente pretendido.
          </p>
          <Button variant="secondary" onClick={close} className="self-start">
            Concluído — fechar e limpar a chave
          </Button>
        </div>
      )}

      {status.kind === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 p-4 text-on-error-container"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-label-md font-semibold">Não foi possível criar a conexão</p>
            <p className="mt-1 font-body-sm">{status.message}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function describeCreateError(code: string): string {
  if (code === 'invalid_input') return 'Verifique o nome do assistente e tente novamente.';
  if (code === 'draft_unavailable') return 'O rascunho compartilhado ainda não foi inicializado. Recarregue o painel.';
  return 'Serviço indisponível. Tente novamente em instantes.';
}
