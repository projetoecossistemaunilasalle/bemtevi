import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ChoiceFlowNode, GuidedFlow } from '../../../domain/flow-engine/types';
import {
  choiceNode,
  createFlow,
  isScoreBranchNode,
  lastPatch,
  patchedNodeOf,
  renderPanel,
  renderStatefulPanel,
  resultNode,
} from './nodeEditorPanelTestSupport';

describe('NodeEditorPanel imagens', () => {
  const EMPTY_HINT = 'A imagem aparece logo abaixo da mensagem no chat. Envie um arquivo ou cole um link https://…';

  function createVisualFlow(nodeOverrides: Partial<ChoiceFlowNode> = {}): GuidedFlow {
    const q1: ChoiceFlowNode = { ...choiceNode, ...nodeOverrides };
    return createFlow({ nodes: { q1, fim: resultNode }, nodeOrder: ['q1', 'fim'] });
  }

  it('adds an empty visual on "Adicionar imagem" and hides the empty hint', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createVisualFlow(), 'q1');

    expect(screen.getByText(EMPTY_HINT)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'q1').visuals).toEqual([{ id: 'q1-visual-1', alt: '', src: '' }]);
    expect(screen.queryByText(EMPTY_HINT)).not.toBeInTheDocument();
  });

  it('commits edited src and alt on blur', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createVisualFlow(), 'q1');

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    await user.type(screen.getByLabelText('Origem da imagem 1'), 'https://exemplo.com/foto.png');
    await user.tab();
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'q1').visuals?.[0]?.src).toBe('https://exemplo.com/foto.png');

    await user.type(screen.getByLabelText('Descrição da imagem 1'), 'Pessoa respirando fundo');
    await user.tab();
    expect(history).toHaveLength(3);
    expect(patchedNodeOf(history[2].patch, 'q1').visuals?.[0]?.alt).toBe('Pessoa respirando fundo');
  });

  it('shows uploaded data URLs as a disabled origin field and lets them be deleted', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(
      createVisualFlow({ visuals: [{ id: 'v1', alt: 'x', src: 'data:image/png;base64,AAAA' }] }),
      'q1',
    );

    const srcInput = screen.getByLabelText('Origem da imagem 1');
    expect(srcInput).toBeDisabled();
    expect(srcInput).toHaveValue('Imagem enviada neste navegador');
    expect(screen.getByText('Trocar imagem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deletar imagem enviada' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deletar imagem enviada' }));
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'q1').visuals?.[0]?.src).toBe('');
  });

  it('uploads a file and commits the data URL as src', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createVisualFlow(), 'q1');

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'foto.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Enviar imagem 1'), { target: { files: [file] } });

    await waitFor(() => expect(history).toHaveLength(2));
    const committed = patchedNodeOf(history[1].patch, 'q1').visuals?.[0]?.src ?? '';
    expect(committed.startsWith('data:image/png;base64,')).toBe(true);

    expect(screen.getByText('Trocar imagem')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Deletar imagem enviada' }));
    expect(history).toHaveLength(3);
    expect(patchedNodeOf(history[2].patch, 'q1').visuals?.[0]?.src).toBe('');
  });

  it('alerts and commits nothing when the file is not a compatible image', async () => {
    const history = renderStatefulPanel(createVisualFlow({ visuals: [{ id: 'v1', alt: '', src: '' }] }), 'q1');

    const file = new File(['conteúdo'], 'notas.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Enviar imagem 1'), { target: { files: [file] } });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('não é uma imagem compatível');
    // Nenhum commit aconteceu: o histórico continua vazio.
    expect(history).toHaveLength(0);
  });

  it('removes one visual keeping siblings and drops the visuals key on the last removal', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(
      createVisualFlow({
        visuals: [
          { id: 'v1', alt: 'a', src: 'https://exemplo.com/a.png' },
          { id: 'v2', alt: 'b', src: 'https://exemplo.com/b.png' },
        ],
      }),
      'q1',
    );

    await user.click(screen.getByRole('button', { name: 'Remover imagem 1' }));
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'q1').visuals).toEqual([
      { id: 'v2', alt: 'b', src: 'https://exemplo.com/b.png' },
    ]);

    await user.click(screen.getByRole('button', { name: 'Remover imagem 1' }));
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'q1')).not.toHaveProperty('visuals'); // last removal drops the key entirely
  });

  it('offers images on score_branch nodes without touching scoreKey/branches', async () => {
    const user = userEvent.setup();
    const flow = createFlow({
      entry: { nodeId: 'r1', enteringPhrases: [], transitionMessage: '' },
      nodes: {
        r1: {
          id: 'r1',
          kind: 'score_branch',
          text: 'Ramificação',
          scoreKey: 'pontuacao',
          branches: [{ id: 'r1-faixa-1', min: 0, max: 5, next: 'fim' }],
        },
        fim: resultNode,
      },
      nodeOrder: ['r1', 'fim'],
    });
    const history = renderStatefulPanel(flow, 'r1');

    expect(screen.getByRole('button', { name: 'Adicionar imagem' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Adicionar imagem' }));

    const node = patchedNodeOf(history[0].patch, 'r1', isScoreBranchNode);
    expect(node.scoreKey).toBe('pontuacao');
    expect(node.branches).toEqual([{ id: 'r1-faixa-1', min: 0, max: 5, next: 'fim' }]);
    expect(node.visuals).toEqual([{ id: 'r1-visual-1', alt: '', src: '' }]);
  });

  it('updates the node exercise to breathing when selected', async () => {
    const user = userEvent.setup();
    const props = renderPanel(createFlow(), 'q1');
    const select = screen.getByRole('combobox', { name: 'Exercício interativo' });
    expect(select).toHaveValue('');

    await user.selectOptions(select, 'breathing');

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const patch = lastPatch(props.onFlowChange);
    expect(patch.nodes?.q1).toMatchObject({ exercise: 'breathing' });
  });

  it('removes the exercise key when "Nenhum exercício" is selected', async () => {
    const user = userEvent.setup();
    const flow = createFlow({
      nodes: {
        q1: { ...choiceNode, exercise: 'breathing' },
        fim: resultNode,
      },
    });
    const props = renderPanel(flow, 'q1');
    const select = screen.getByRole('combobox', { name: 'Exercício interativo' });
    expect(select).toHaveValue('breathing');
    expect(screen.getByText(/exercício de respiração guiada será exibido/i)).toBeInTheDocument();

    await user.selectOptions(select, '');

    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    const patch = lastPatch(props.onFlowChange);
    expect(patch.nodes?.q1).not.toHaveProperty('exercise');
  });

  it('allows configuring exercise on result and score_branch nodes', async () => {
    const user = userEvent.setup();
    const resultFlow = createFlow({
      nodes: {
        fim: { ...resultNode, exercise: 'breathing' },
      },
      nodeOrder: ['fim'],
      entry: { nodeId: 'fim', enteringPhrases: [], transitionMessage: '' },
    });
    const props = renderPanel(resultFlow, 'fim');
    const select = screen.getByRole('combobox', { name: 'Exercício interativo' });
    expect(select).toHaveValue('breathing');

    await user.selectOptions(select, '');
    const patch = lastPatch(props.onFlowChange);
    expect(patch.nodes?.fim).not.toHaveProperty('exercise');
  });
});
