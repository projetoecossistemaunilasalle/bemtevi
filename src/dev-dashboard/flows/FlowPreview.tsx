import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { advanceFlow } from '../../domain/flow-engine/advanceFlow';
import { createInitialFlowState } from '../../domain/flow-engine/loadFlows';
import { resolveOptions } from '../../domain/flow-engine/resolveOptions';
import { Button } from '../../design-system/components/Button';

export function FlowPreview({ flow, flows }: { flow: GuidedFlow; flows: GuidedFlow[] }) {
  const [state, setState] = useState(() => createInitialFlowState(flow, flows));

  const options = resolveOptions(state, flows).filter((option) => option.kind === 'node_option');

  function chooseOption(label: string) {
    setState((current) => advanceFlow(current, flows, label));
  }

  function clearChat() {
    setState(() => createInitialFlowState(flow, flows));
  }

  return (
    <section className="flex flex-col gap-stack-sm rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline-sm text-on-surface">Testar conversa</h2>
          <p className="mt-1 font-body-md text-on-surface-variant">
            Simule o fluxo para verificar o caminho das mensagens.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={clearChat} aria-label="Limpar" className="shrink-0">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Limpar
        </Button>
      </div>
      <div className="flex max-h-[420px] flex-col gap-3 overflow-auto">
        {state.transcript.map((message) => (
          <div
            key={message.id}
            className={`rounded-2xl px-4 py-3 ${
              message.sender === 'bot'
                ? 'self-start rounded-bl-sm bg-[#EEF8F3]'
                : 'self-end rounded-br-sm bg-primary text-on-primary'
            }`}
          >
            <p className="font-body-md">{message.text}</p>
          </div>
        ))}
        {state.transcript.length > 2 && (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" onClick={clearChat}>
              <X aria-hidden="true" className="h-4 w-4" />
              Limpar conversa
            </Button>
          </div>
        )}
      </div>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button key={option.id} variant="secondary" size="sm" onClick={() => chooseOption(option.label)}>
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
