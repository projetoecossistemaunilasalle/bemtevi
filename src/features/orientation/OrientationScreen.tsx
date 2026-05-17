import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { flowRegistry } from '../../content/flows/registry';
import { advanceFlow } from '../../domain/flow-engine/advanceFlow';
import { createInitialFlowStateFromRegistry } from '../../domain/flow-engine/loadFlows';
import { resolveOptions } from '../../domain/flow-engine/resolveOptions';
import type { ChatMessage, RuntimeOption } from '../../domain/flow-engine/types';

const flows = flowRegistry.flows;

export function OrientationScreen() {
  const navigate = useNavigate();
  const logRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [state, setState] = useState(() => createInitialFlowStateFromRegistry(flows, 'work-stress'));
  const options = useMemo(() => resolveOptions(state, flows), [state]);
  const visibleOptions = useMemo(() => {
    const normalizedInput = inputValue.trim().toLocaleLowerCase('pt-BR');
    const strictMatch = options.find(
      (option) => option.label.toLocaleLowerCase('pt-BR') === inputValue.toLocaleLowerCase('pt-BR'),
    );

    if (strictMatch) return [];

    if (!normalizedInput) {
      return options.filter((option) => option.kind === 'node_option');
    }

    return options.filter((option) => option.label.toLocaleLowerCase('pt-BR').includes(normalizedInput));
  }, [inputValue, options]);

  const exactOption = options.find((option) => option.label.toLocaleLowerCase('pt-BR') === inputValue.trim().toLocaleLowerCase('pt-BR'));

  useEffect(() => {
    const log = logRef.current;

    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [state.transcript, visibleOptions.length]);

  useEffect(() => {
    if (state.pendingNavigation) {
      navigate(state.pendingNavigation);
    }
  }, [navigate, state.pendingNavigation]);

  function selectOption(option: RuntimeOption) {
    submitOption(option);
  }

  function submitOption(option: RuntimeOption) {
    if (option.kind === 'global_action' && option.target !== 'end') {
      navigate(option.target);
      return;
    }

    setState((currentState) => advanceFlow(currentState, flows, option.label));
    setInputValue('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (exactOption) {
      submitOption(exactOption);
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100dvh-160px)] w-full max-w-3xl flex-col overflow-hidden px-container-padding-mobile pt-3 md:h-[calc(100dvh-64px)] md:px-container-padding-desktop md:pt-stack-md">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-outline-variant/50 bg-surface-container-lowest shadow-[0_16px_48px_rgba(17,28,44,0.08)]">
        <div
          role="log"
          aria-label="Histórico da orientação guiada"
          aria-live="polite"
          ref={logRef}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-56 pt-5 [scrollbar:none] md:px-6 md:pb-48 [&::-webkit-scrollbar]:hidden"
        >
          {state.transcript.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
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
              className="min-h-11 min-w-0 flex-1 bg-transparent font-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Enviar opção selecionada"
              data-icon="send"
              disabled={!exactOption}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-colors disabled:bg-secondary-container disabled:text-on-secondary-container"
            >
              <Send size={21} aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </main>
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary" aria-hidden="true">
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-secondary" aria-hidden="true">
          <User size={18} />
        </span>
      )}
    </article>
  );
}
