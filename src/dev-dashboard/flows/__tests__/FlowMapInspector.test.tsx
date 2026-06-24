import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FlowMapInspector } from '../FlowMapInspector';
import type { ChoiceFlowNode, FlowNode, GuidedFlow } from '../../../domain/flow-engine/types';

const choiceNode: ChoiceFlowNode = {
  id: 'q1',
  kind: 'choice',
  text: 'Você se sente triste?',
  options: [
    { id: 'yes', label: 'Sim', next: 'result', effects: [{ kind: 'score', scoreKey: 'srq20', value: 1 }] },
    { id: 'no', label: 'Não', next: 'result' },
  ],
};

const nodes: FlowNode[] = [choiceNode, { id: 'result', kind: 'result', text: 'Fim.' }];
const flows: GuidedFlow[] = [];

function renderInspector(overrides: Partial<Parameters<typeof FlowMapInspector>[0]> = {}) {
  const props = {
    node: choiceNode,
    nodes,
    flows,
    onTextChange: vi.fn(),
    onRemoveEffect: vi.fn(),
    onEditFully: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<FlowMapInspector {...props} />), props };
}

describe('FlowMapInspector', () => {
  it('renders the node text in a textarea', () => {
    renderInspector();
    expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Você se sente triste?');
  });

  it('calls onTextChange with new value on blur', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    const textarea = screen.getByRole('textbox', { name: /texto da etapa/i });
    await user.clear(textarea);
    await user.type(textarea, 'Nova pergunta');
    await user.tab();
    expect(props.onTextChange).toHaveBeenCalledWith('Nova pergunta');
  });

  it('renders each option with its label and destination', () => {
    renderInspector();
    expect(screen.getByText('Sim')).toBeInTheDocument();
    expect(screen.getByText('Não')).toBeInTheDocument();
    expect(screen.getAllByText(/Etapa 2/i).length).toBeGreaterThan(0);
  });

  it('renders a remove button for each effect chip', () => {
    renderInspector();
    expect(screen.getByRole('button', { name: /remover efeito score/i })).toBeInTheDocument();
  });

  it('calls onRemoveEffect with optionId and effectIndex when remove chip is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    await user.click(screen.getByRole('button', { name: /remover efeito score/i }));
    expect(props.onRemoveEffect).toHaveBeenCalledWith('yes', 0);
  });

  it('calls onEditFully when "Editar completamente" is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    await user.click(screen.getByRole('button', { name: /editar completamente/i }));
    expect(props.onEditFully).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderInspector();
    await user.click(screen.getByRole('button', { name: /fechar inspetor/i }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows branch ranges for score_branch nodes instead of options', () => {
    const branchNode = {
      id: 'branch',
      kind: 'score_branch' as const,
      text: 'Calculando',
      scoreKey: 'srq20',
      branches: [
        { id: 'low', min: 0, max: 6, next: 'low-result' },
        { id: 'high', min: 7, max: 20, next: 'high-result' },
      ],
    };
    renderInspector({ node: branchNode, nodes: [branchNode] });
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('shows kind badge with "Escolha" for choice nodes', () => {
    renderInspector();
    expect(screen.getByText('Escolha')).toBeInTheDocument();
  });
});
