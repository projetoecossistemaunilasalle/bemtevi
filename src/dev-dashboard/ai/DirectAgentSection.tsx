import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  MonitorDown,
  ShieldCheck,
  Square,
  TerminalSquare,
  Unplug,
} from 'lucide-react';
import { Button } from '../../design-system/components/Button';
import type { PublishedContentPayload } from '../../app/content/publishedContent';
import { buildDirectAgentPrompt, copyTextWithFallback } from './aiPrompts';
import { parseAiResponseText, preparePayloadForAi } from './aiArchive';
import { applyAiOperations } from './aiOperations';
import {
  agentBridgeDefaults,
  getAgentBridgeStatus,
  pairAgentBridge,
  runAgent,
  type AgentBridgeStatus,
  type AgentProviderId,
} from './agentBridge';
import { agentSetups, detectSetupPlatform, getAgentSetup, type SetupPlatform } from './agentSetup';

interface DirectAgentSectionProps {
  draft: PublishedContentPayload;
  /** The Neon revision used to build the AI request. */
  baseRevision: number;
  onApply: (nextPayload: PublishedContentPayload, envelope: ReturnType<typeof parseAiResponseText>) => void;
}

type RunStatus =
  | { kind: 'idle' }
  | { kind: 'running'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function initialBridgeUrl() {
  return localStorage.getItem(agentBridgeDefaults.urlStorageKey) || agentBridgeDefaults.url;
}

function StepNumber({ children }: { children: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary font-label-md font-bold text-on-secondary">
      {children}
    </span>
  );
}

export function DirectAgentSection({ draft, baseRevision, onApply }: DirectAgentSectionProps) {
  const [bridgeUrl, setBridgeUrl] = useState(initialBridgeUrl);
  const [pairCode, setPairCode] = useState('');
  const [token, setToken] = useState(() => sessionStorage.getItem(agentBridgeDefaults.tokenStorageKey) || '');
  const [bridge, setBridge] = useState<AgentBridgeStatus | null>(null);
  const [provider, setProvider] = useState<AgentProviderId>('codex');
  const [platform, setPlatform] = useState<SetupPlatform>(detectSetupPlatform);
  const [copiedCommand, setCopiedCommand] = useState('');
  const [instruction, setInstruction] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus>({ kind: 'idle' });
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!token) return;
    void refreshStatus(token, false);
    // The stored token is only valid while the current bridge process is alive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshStatus(nextToken = token, showError = true) {
    try {
      const status = await getAgentBridgeStatus(bridgeUrl, nextToken);
      setBridge(status);
      setConnectionError('');
      const selected = status.providers.find((item) => item.id === provider && item.available);
      if (!selected) {
        const firstAvailable = status.providers.find((item) => item.available);
        if (firstAvailable) setProvider(firstAvailable.id);
      }
      return status;
    } catch (error) {
      setBridge(null);
      if (showError) setConnectionError(error instanceof Error ? error.message : 'Falha ao verificar a conexão.');
      return null;
    }
  }

  async function handlePair() {
    setConnectionError('');
    try {
      const nextToken = await pairAgentBridge(bridgeUrl, pairCode);
      const status = await refreshStatus(nextToken);
      if (!status) return;
      sessionStorage.setItem(agentBridgeDefaults.tokenStorageKey, nextToken);
      localStorage.setItem(agentBridgeDefaults.urlStorageKey, bridgeUrl);
      setToken(nextToken);
      setPairCode('');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Falha ao conectar.');
    }
  }

  function disconnect() {
    abortControllerRef.current?.abort();
    sessionStorage.removeItem(agentBridgeDefaults.tokenStorageKey);
    setToken('');
    setBridge(null);
    setRunStatus({ kind: 'idle' });
  }

  async function handleCopyCommand(command: string) {
    try {
      await copyTextWithFallback(command);
      setCopiedCommand(command);
      window.setTimeout(() => setCopiedCommand((current) => (current === command ? '' : current)), 2000);
    } catch {
      setConnectionError('Não foi possível copiar. Selecione o comando e copie manualmente.');
    }
  }

  async function handleRun() {
    if (!instruction.trim()) {
      setRunStatus({ kind: 'error', message: 'Descreva o que o agente deve alterar.' });
      return;
    }
    const selected = bridge?.providers.find((item) => item.id === provider);
    if (!selected?.available) {
      setRunStatus({ kind: 'error', message: 'O agente selecionado não está instalado ou não foi encontrado.' });
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setRunStatus({ kind: 'running', message: `${selected.label} recebeu o conteúdo e está analisando a tarefa.` });

    try {
      const { payload } = preparePayloadForAi(draft);
      const prompt = buildDirectAgentPrompt(payload, instruction.trim(), baseRevision);
      const output = await runAgent(bridgeUrl, token, provider, prompt, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'progress') setRunStatus({ kind: 'running', message: event.message });
        },
      });
      const operations = parseAiResponseText(output);
      const nextPayload = applyAiOperations(draft, operations, baseRevision);
      onApply(nextPayload, operations);
      setRunStatus({
        kind: 'success',
        message: `${selected.label} concluiu a tarefa. As alterações foram aplicadas ao rascunho para revisão.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setRunStatus({ kind: 'error', message: 'Execução cancelada. O rascunho não foi alterado.' });
      } else {
        setRunStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Falha ao executar o agente.',
        });
      }
    } finally {
      abortControllerRef.current = null;
    }
  }

  const isRunning = runStatus.kind === 'running';
  const selectedSetup = getAgentSetup(provider);

  return (
    <section className="flex flex-col gap-stack-md rounded-lg border border-secondary/35 bg-secondary-container/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary">
            <Bot aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-headline-sm text-on-surface">Use um assistente de IA no painel</h2>
            <p className="mt-1 max-w-3xl font-body-md text-on-surface-variant">
              Escolha Codex, Claude Code, Hermes ou Antigravity. A configuração é feita uma vez; depois, basta escrever o que você
              quer revisar ou alterar.
            </p>
          </div>
        </div>
        {bridge && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1.5 font-label-md text-on-primary-container">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            Conexão pronta
          </span>
        )}
      </div>

      {!bridge ? (
        <div className="flex flex-col gap-5 rounded-lg bg-surface-container-lowest p-4 sm:p-5">
          <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary-container/30 p-4">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="font-body-sm text-on-surface">
              Sua senha nunca passa pelo BemTeVi. O assistente trabalha com uma cópia do conteúdo e devolve um rascunho.
              Você revisa tudo antes de publicar.
            </p>
          </div>

          <ol className="flex flex-col gap-5">
            <li className="flex gap-3 sm:gap-4">
              <StepNumber>1</StepNumber>
              <div className="min-w-0 flex-1">
                <h3 className="font-label-lg text-on-surface">Escolha seu assistente</h3>
                <p className="mt-1 font-body-sm text-on-surface-variant">
                  Se você já usa um deles, escolha o mesmo. O BemTeVi funciona com qualquer um dos quatro.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Assistente de IA">
                  {agentSetups.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={provider === item.id}
                      onClick={() => setProvider(item.id)}
                      className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                        provider === item.id
                          ? 'border-secondary bg-secondary-container text-on-secondary-container'
                          : 'border-outline-variant bg-surface text-on-surface hover:border-secondary/60'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2 font-label-lg font-semibold">
                        {item.label}
                        {provider === item.id && <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />}
                      </span>
                      <span className="mt-1 block font-body-sm">{item.shortDescription}</span>
                      <span className="mt-3 block font-label-sm font-semibold">{item.bestFor}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 rounded-md bg-surface-container-low p-3 font-body-sm text-on-surface-variant">
                  <strong className="text-on-surface">Conta necessária:</strong> {selectedSetup.accountDescription}
                </p>
              </div>
            </li>

            <li className="flex gap-3 sm:gap-4">
              <StepNumber>2</StepNumber>
              <div className="min-w-0 flex-1">
                <h3 className="font-label-lg text-on-surface">Instale o {selectedSetup.label}</h3>
                <p className="mt-1 font-body-sm text-on-surface-variant">
                  Os comandos abaixo vêm da documentação oficial. Faça esta etapa somente uma vez.
                </p>

                <div
                  className="mt-3 inline-flex rounded-full border border-outline-variant bg-surface p-1"
                  aria-label="Sistema operacional"
                >
                  <button
                    type="button"
                    onClick={() => setPlatform('windows')}
                    aria-pressed={platform === 'windows'}
                    className={`min-h-9 rounded-full px-4 font-label-md ${platform === 'windows' ? 'bg-secondary text-on-secondary' : 'text-on-surface'}`}
                  >
                    Windows
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatform('mac_linux')}
                    aria-pressed={platform === 'mac_linux'}
                    className={`min-h-9 rounded-full px-4 font-label-md ${platform === 'mac_linux' ? 'bg-secondary text-on-secondary' : 'text-on-surface'}`}
                  >
                    macOS ou Linux
                  </button>
                </div>

                <div className="mt-3 flex items-start gap-3 rounded-md bg-surface-container-low p-3">
                  <TerminalSquare aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <p className="font-body-sm text-on-surface-variant">
                    {platform === 'windows'
                      ? 'Para abrir o PowerShell: pressione a tecla Windows, escreva “PowerShell” e abra o aplicativo. Cole um comando por vez e pressione Enter.'
                      : 'Abra o aplicativo Terminal. Cole um comando por vez e pressione Enter.'}
                  </p>
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  {selectedSetup.commands[platform].map((item) => (
                    <div key={item.command} className="rounded-lg border border-outline-variant bg-surface p-3">
                      <p className="font-label-md font-semibold text-on-surface">{item.label}</p>
                      <div className="mt-2 flex items-stretch gap-2">
                        <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-surface-container-low px-3 py-2.5 font-mono text-xs text-on-surface sm:text-sm">
                          {item.command}
                        </code>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleCopyCommand(item.command)}
                          aria-label={`Copiar: ${item.label}`}
                        >
                          {copiedCommand === item.command ? (
                            <Check aria-hidden="true" className="h-4 w-4" />
                          ) : (
                            <Copy aria-hidden="true" className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">
                            {copiedCommand === item.command ? 'Copiado' : 'Copiar'}
                          </span>
                        </Button>
                      </div>
                      <p className="mt-2 font-body-sm text-on-surface-variant">{item.help}</p>
                    </div>
                  ))}
                </div>

                <a
                  href={selectedSetup.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-10 items-center gap-2 font-label-md font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Ver instruções oficiais do {selectedSetup.label}
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                </a>
              </div>
            </li>

            <li className="flex gap-3 sm:gap-4">
              <StepNumber>3</StepNumber>
              <div className="min-w-0 flex-1">
                <h3 className="font-label-lg text-on-surface">Ligue a conexão do BemTeVi</h3>
                <div className="mt-3 flex items-start gap-3 rounded-lg border border-secondary/30 bg-secondary-container/35 p-4">
                  <MonitorDown aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <div>
                    <p className="font-body-md font-semibold text-on-surface">
                      {platform === 'windows'
                        ? 'Na pasta do BemTeVi, dê dois cliques em “iniciar-assistente-ia.cmd”.'
                        : 'No Terminal, abra a pasta do BemTeVi e execute “pnpm agent:bridge”.'}
                    </p>
                    <p className="mt-1 font-body-sm text-on-surface-variant">
                      Uma janela mostrará um código de seis números. Mantenha essa janela aberta enquanto usar o
                      assistente.
                    </p>
                  </div>
                </div>
                <p className="mt-2 font-body-sm text-on-surface-variant">
                  Não encontrou a pasta ou o arquivo? Peça à pessoa responsável pela instalação do BemTeVi para ligar a
                  conexão local.
                </p>
              </div>
            </li>

            <li className="flex gap-3 sm:gap-4">
              <StepNumber>4</StepNumber>
              <div className="min-w-0 flex-1">
                <h3 className="font-label-lg text-on-surface">Digite o código e conecte</h3>
                <p className="mt-1 font-body-sm text-on-surface-variant">
                  Esse código é temporário e pode mudar quando a janela de conexão for reaberta.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex max-w-xs flex-1 flex-col gap-1.5 font-label-md text-on-surface">
                    Código de seis números
                    <input
                      value={pairCode}
                      onChange={(event) => setPairCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="min-h-12 rounded-md border border-outline-variant bg-surface px-3 font-mono text-lg tracking-[0.25em] text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                    />
                  </label>
                  <Button onClick={() => void handlePair()} disabled={pairCode.length !== 6}>
                    <Link2 aria-hidden="true" className="h-4 w-4" />
                    Conectar assistente
                  </Button>
                </div>

                <details className="mt-4 rounded-md border border-outline-variant bg-surface px-3 py-2">
                  <summary className="cursor-pointer font-label-md font-semibold text-on-surface">
                    Opções avançadas
                  </summary>
                  <label className="mt-3 flex flex-col gap-1.5 font-label-md text-on-surface">
                    Endereço da conexão local
                    <input
                      value={bridgeUrl}
                      onChange={(event) => setBridgeUrl(event.target.value)}
                      className="min-h-11 rounded-md border border-outline-variant bg-surface px-3 font-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                      spellCheck={false}
                    />
                  </label>
                </details>
              </div>
            </li>
          </ol>

          {connectionError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-error-container/35 p-3 font-body-sm text-on-error-container"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {connectionError}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg bg-surface-container-lowest p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-label-lg text-on-surface">Escolha o agente</h3>
              <p className="font-body-sm text-on-surface-variant">
                Somente os assistentes instalados podem ser usados.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={disconnect} disabled={isRunning}>
              <Unplug aria-hidden="true" className="h-4 w-4" />
              Desconectar
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Agente conectado">
            {bridge.providers.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={provider === item.id}
                disabled={!item.available || isRunning}
                onClick={() => setProvider(item.id)}
                className={`min-h-14 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  provider === item.id && item.available
                    ? 'border-secondary bg-secondary-container text-on-secondary-container'
                    : 'border-outline-variant bg-surface text-on-surface'
                } disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <span className="block font-label-md font-semibold">{item.label}</span>
                <span className="block font-body-sm">
                  {item.available ? 'Pronto para usar' : 'Ainda não instalado'}
                </span>
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-1.5 font-label-md text-on-surface">
            O que você quer alterar?
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              disabled={isRunning}
              rows={5}
              className="rounded-md border border-outline-variant bg-surface px-3 py-2.5 font-body-md text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
              placeholder="Ex.: revise a clareza dos materiais sobre ansiedade sem alterar títulos, IDs ou contatos."
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            {isRunning ? (
              <Button variant="secondary" onClick={() => abortControllerRef.current?.abort()}>
                <Square aria-hidden="true" className="h-4 w-4" />
                Cancelar execução
              </Button>
            ) : (
              <Button onClick={() => void handleRun()} disabled={!instruction.trim()}>
                <Bot aria-hidden="true" className="h-4 w-4" />
                Enviar ao agente
              </Button>
            )}
            {isRunning && (
              <span className="inline-flex items-center gap-2 font-body-sm text-on-surface-variant" role="status">
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                {runStatus.message}
              </span>
            )}
          </div>

          {runStatus.kind === 'success' && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-md bg-primary-container/40 p-3 font-body-sm text-on-primary-container"
            >
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {runStatus.message}
            </p>
          )}
          {runStatus.kind === 'error' && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-error-container/35 p-3 font-body-sm text-on-error-container"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {runStatus.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
