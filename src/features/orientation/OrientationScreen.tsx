import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { flowRegistry } from '../../content/flows/registry';
import { advanceFlow } from '../../domain/flow-engine/advanceFlow';
import { createInitialFlowStateFromRegistry, createMessage } from '../../domain/flow-engine/loadFlows';
import { resolveOptions } from '../../domain/flow-engine/resolveOptions';
import type { ChatMessage, FlowRuntimeState, RuntimeOption } from '../../domain/flow-engine/types';

const TYPING_DELAY_MS = 1200;

const flows = flowRegistry.flows;

const INTRO_STARTERS = [
  {
    id: 'understand-feelings',
    label: 'Quero entender como estou me sentindo',
    flowId: 'orientation-understand-feelings',
    recordAsMessage: true,
  },
  {
    id: 'talk-through-experience',
    label: 'Quero falar sobre o que estou vivendo',
    flowId: 'orientation-talk-through-experience',
    recordAsMessage: true,
  },
  {
    id: 'next-care-step',
    label: 'Quero encontrar um próximo passo de cuidado',
    flowId: 'orientation-next-care-step',
    recordAsMessage: true,
  },
  {
    id: 'calm-moment',
    label: 'Preciso de um momento mais leve',
    flowId: 'orientation-calm-moment',
    recordAsMessage: true,
  },
  {
    id: 'other',
    label: 'Outro',
    flowId: 'orientation-understand-feelings',
    recordAsMessage: false,
  },
] as const;

type IntroStarter = (typeof INTRO_STARTERS)[number];

const typingIndicatorStyle = (
  <style>{`
    @keyframes orientation-typing-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }
    .orientation-typing-dot {
      width: 8px;
      height: 8px;
      background: #6b7280;
      border-radius: 50%;
      display: inline-block;
      animation: orientation-typing-bounce 1.2s infinite ease-in-out;
    }
  `}</style>
);

export function OrientationScreen() {
  const navigate = useNavigate();
  const logRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [hasStarted, setHasStarted] = useState(false);
  const [selectedIntroStarter, setSelectedIntroStarter] = useState<string | null>(null);
  const [selectedIntroFlowId, setSelectedIntroFlowId] = useState<string>(INTRO_STARTERS[0].flowId);
  const [state, setState] = useState<FlowRuntimeState | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRevealing = hasStarted && (state === null || visibleCount < state.transcript.length);

  const options = useMemo(() => (state && !isRevealing ? resolveOptions(state, flows) : []), [state, isRevealing]);
  const visibleOptions = useMemo(() => {
    const normalizedInput = inputValue.trim().toLocaleLowerCase('pt-BR');
    const strictMatch = options.find(
      (option) => option.label.toLocaleLowerCase('pt-BR') === inputValue.toLocaleLowerCase('pt-BR'),
    );

    if (strictMatch) return [];

    if (!normalizedInput) {
      return options.filter((option) => option.kind === 'node_option' || option.kind === 'flow_start');
    }

    return options.filter((option) => option.label.toLocaleLowerCase('pt-BR').includes(normalizedInput));
  }, [inputValue, options]);

  const exactOption = options.find(
    (option) => option.label.toLocaleLowerCase('pt-BR') === inputValue.trim().toLocaleLowerCase('pt-BR'),
  );

  useEffect(() => {
    const log = logRef.current;

    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [state?.transcript, visibleOptions.length, visibleCount]);

  useEffect(() => {
    if (state && !isRevealing && state.pendingNavigation) {
      navigate(state.pendingNavigation);
    }
  }, [navigate, state, isRevealing]);

  useEffect(() => {
    if (!hasStarted || state) return;

    typingTimerRef.current = setTimeout(() => {
      const initialState = createInitialFlowStateFromRegistry(flows, selectedIntroFlowId);
      const introMessages =
        selectedIntroStarter === null
          ? []
          : [
              createMessage(
                'user',
                selectedIntroStarter,
                initialState.activeFlowId ?? selectedIntroFlowId,
                initialState.activeNodeId,
              ),
            ];
      const nextState = {
        ...initialState,
        transcript: [...introMessages, ...initialState.transcript],
      };

      setState(nextState);
      setVisibleCount(nextState.transcript.length);
    }, TYPING_DELAY_MS);
  }, [hasStarted, selectedIntroStarter, selectedIntroFlowId, state]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  function startConversation(starter: IntroStarter) {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    setSelectedIntroFlowId(starter.flowId);
    setSelectedIntroStarter(starter.recordAsMessage ? starter.label : null);
    setInputValue('');
    setState(null);
    setVisibleCount(0);
    setHasStarted(true);
  }

  function selectOption(option: RuntimeOption) {
    submitOption(option);
  }

  function submitOption(option: RuntimeOption) {
    if (!state) return;

    if (option.kind === 'global_action' && option.target !== 'end') {
      navigate(option.target);
      return;
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    setInputValue('');

    const preAdvanceCount = state.transcript.length;
    const newState = advanceFlow(state, flows, option.label);

    let immediateCount: number;
    if (option.kind === 'entry_phrase') {
      immediateCount = 0;
    } else if (option.kind === 'resume_flow') {
      immediateCount = newState.transcript.length;
    } else {
      immediateCount = preAdvanceCount + 1;
    }

    setState(newState);
    setVisibleCount(immediateCount);

    const totalMessages = newState.transcript.length;
    if (immediateCount < totalMessages) {
      typingTimerRef.current = setTimeout(() => {
        setVisibleCount(totalMessages);
      }, TYPING_DELAY_MS);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (exactOption) {
      submitOption(exactOption);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-160px)] w-full max-w-3xl flex-col overflow-hidden px-container-padding-mobile pt-3 md:h-[calc(100dvh-64px)] md:px-container-padding-desktop md:pt-stack-md">
      {!hasStarted && <OrientationIntroScreen onSelectStarter={startConversation} />}

      {hasStarted && (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_48px_rgba(17,28,44,0.08)]">
          <div
            role="log"
            aria-label="Histórico da orientação guiada"
            aria-live="polite"
            ref={logRef}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-56 pt-5 [scrollbar:none] md:px-6 md:pb-48 [&::-webkit-scrollbar]:hidden"
          >
            {state?.transcript.slice(0, visibleCount).map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isRevealing && <TypingIndicator />}
          </div>

          <form
            onSubmit={handleSubmit}
            data-testid="orientation-composer"
            className="fixed bottom-21.5 left-0 right-0 z-40 mx-auto max-w-3xl px-container-padding-mobile md:bottom-6 md:px-container-padding-desktop"
          >
            {visibleOptions.length > 0 && (
              <div
                id="orientation-suggestions"
                role="listbox"
                aria-label="Sugestões de resposta"
                className="absolute bottom-18.5 right-container-padding-mobile z-20 flex max-h-40 max-w-[calc(100%-2.5rem)] flex-col items-end gap-2 overflow-y-auto md:right-container-padding-desktop md:max-w-[calc(100%-5rem)]"
              >
                {visibleOptions.map((option) => (
                  <button
                    key={`${option.kind}-${option.id}`}
                    type="button"
                    role="option"
                    aria-selected={exactOption?.id === option.id}
                    onClick={() => selectOption(option)}
                    className={`min-h-10 w-fit max-w-full rounded-full px-4 py-2 text-left font-label-md shadow-sm transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      option.kind === 'global_action'
                        ? 'border border-outline-variant bg-surface-container-lowest text-secondary hover:border-secondary hover:bg-surface-container-low'
                        : 'bg-primary-fixed text-on-surface hover:bg-primary-fixed-dim'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            <label htmlFor="orientation-choice-input" className="sr-only">
              Digite ou escolha uma opção
            </label>
            <div className="flex items-center gap-2 rounded-full border border-secondary/30 bg-surface-container-lowest py-2 pl-5 pr-2 shadow-[0_4px_14px_rgba(17,28,44,0.12)] focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary">
              <input
                id="orientation-choice-input"
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Digite ou escolha uma opção"
                aria-autocomplete="list"
                aria-controls="orientation-suggestions"
                disabled={isRevealing}
                className="min-h-11 min-w-0 flex-1 bg-transparent font-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Enviar opção selecionada"
                data-icon="send"
                disabled={isRevealing || !exactOption}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors disabled:bg-secondary-container disabled:text-on-secondary-container"
              >
                <Send size={21} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

function OrientationIntroScreen({ onSelectStarter }: { onSelectStarter: (starter: IntroStarter) => void }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_48px_rgba(17,28,44,0.08)]">
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-6 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary"
              aria-hidden="true"
            >
              <MessageCircle size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="font-title-lg text-on-surface">Antes de começar</h1>
              <p className="mt-2 max-w-xl font-body-md text-on-surface-variant">
                Escolha um caminho para começar. O SeCuida vai te guiar com perguntas simples, no seu ritmo.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-4">
            <p id="orientation-intro-question" className="font-label-lg text-on-surface">
              O que você gostaria de fazer agora?
            </p>
          </div>

          <div className="grid gap-2" role="group" aria-labelledby="orientation-intro-question">
            {INTRO_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => onSelectStarter(starter)}
                className="min-h-12 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-3 text-left font-label-md text-on-surface shadow-sm transition-colors hover:border-primary hover:bg-primary-fixed/45 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {starter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-outline-variant/50 bg-surface-container px-4 py-3">
          <Shield className="mt-0.5 shrink-0 text-secondary" size={20} aria-hidden="true" />
          <p className="font-body-sm text-on-surface-variant">Este espaço é anônimo e não salva sua conversa.</p>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === 'user';
  const label = isUser ? 'Você' : 'SeCuida';

  return (
    <article className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[84%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="flex items-center gap-2 font-label-md text-on-surface-variant">
          {!isUser && (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary"
              aria-hidden="true"
            >
              <MessageCircle size={17} />
            </span>
          )}
          {label}
        </span>
        <div
          className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser
              ? 'rounded-br-sm bg-primary text-on-primary'
              : 'ml-10 rounded-bl-sm border border-outline-variant/40 bg-[#EEF8F3] text-on-surface'
          }`}
        >
          <p className="font-body-md">{message.text}</p>
        </div>
      </div>
      {isUser && (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-secondary"
          aria-hidden="true"
        >
          <User size={18} />
        </span>
      )}
    </article>
  );
}

function TypingIndicator() {
  return (
    <>
      <span role="status" className="sr-only">
        Carregando conversa
      </span>
      <article className="flex items-end gap-2 justify-start" aria-hidden="true">
        {typingIndicatorStyle}
        <div className="flex max-w-[84%] flex-col gap-1 items-start">
          <span className="flex items-center gap-2 font-label-md text-on-surface-variant">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
              <MessageCircle size={17} />
            </span>
            SeCuida
          </span>
          <div className="ml-10 rounded-2xl rounded-bl-sm border border-outline-variant/40 bg-[#EEF8F3] px-4 py-3 shadow-sm">
            <span className="orientation-typing-dot" style={{ animationDelay: '0s' }} />
            <span className="orientation-typing-dot" style={{ animationDelay: '0.15s', marginLeft: 4 }} />
            <span className="orientation-typing-dot" style={{ animationDelay: '0.3s', marginLeft: 4 }} />
          </div>
        </div>
      </article>
    </>
  );
}
