import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { GuidedFlow } from '../../domain/flow-engine/types';
import { Button } from '../../design-system/components/Button';

interface PreviewMessage {
  id: string;
  author: 'bot' | 'user';
  text: string;
}

interface PreviewOption {
  id: string;
  label: string;
  next?: string;
  effects?: Array<{ kind: string; flowId?: string }>;
}

export function FlowPreview({ flow, flows }: { flow: GuidedFlow; flows: GuidedFlow[] }) {
  const [activeFlowId, setActiveFlowId] = useState(flow.id);
  const [activeNodeId, setActiveNodeId] = useState(flow.entry.nodeId);
  const [messages, setMessages] = useState<PreviewMessage[]>(() => createInitialMessages(flow));

  const activeFlow = flows.find((item) => item.id === activeFlowId) ?? flow;
  const activeNode = activeFlow.nodes[activeNodeId];

  function chooseOption(option: PreviewOption) {
    const flowStart = option.effects?.find((effect) => effect.kind === 'flow_start');
    const nextFlow = flowStart ? flows.find((item) => item.id === flowStart.flowId) : null;
    const nextNodeId = nextFlow?.entry.nodeId ?? option.next;
    const nextFlowForNode = nextFlow ?? activeFlow;
    const nextNode = nextNodeId ? nextFlowForNode.nodes[nextNodeId] : null;

    setMessages((current) => [
      ...current,
      { id: `user-${current.length}`, author: 'user', text: option.label },
      ...(nextFlow
        ? [{ id: `transition-${current.length}`, author: 'bot' as const, text: nextFlow.entry.transitionMessage }]
        : []),
      {
        id: `bot-${current.length}`,
        author: 'bot',
        text: nextNode?.text ?? 'Este caminho ainda precisa ser corrigido.',
      },
    ]);

    if (nextFlow) setActiveFlowId(nextFlow.id);
    if (nextNodeId) setActiveNodeId(nextNodeId);
  }

  function clearChat() {
    setMessages(createInitialMessages(flow));
    setActiveFlowId(flow.id);
    setActiveNodeId(flow.entry.nodeId);
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
        <Button variant="secondary" size="sm" onClick={clearChat} aria-label="Limpar conversa" className="shrink-0">
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Limpar
        </Button>
      </div>
      <div className="flex max-h-[420px] flex-col gap-3 overflow-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-2xl px-4 py-3 ${
              message.author === 'bot'
                ? 'self-start rounded-bl-sm bg-[#EEF8F3]'
                : 'self-end rounded-br-sm bg-primary text-on-primary'
            }`}
          >
            <p className="font-body-md">{message.text}</p>
          </div>
        ))}
      </div>
      {activeNode?.kind === 'choice' && (
        <div className="flex flex-wrap gap-2">
          {activeNode.options.map((option) => (
            <Button key={option.id} variant="secondary" size="sm" onClick={() => chooseOption(option)}>
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

function createInitialMessages(flow: GuidedFlow): PreviewMessage[] {
  const firstNode = flow.nodes[flow.entry.nodeId];

  return [
    { id: 'transition', author: 'bot', text: flow.entry.transitionMessage },
    {
      id: 'first-node',
      author: 'bot',
      text: firstNode?.text ?? 'A etapa inicial deste fluxo ainda precisa ser corrigida.',
    },
  ];
}
