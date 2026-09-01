import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { FlowEditor } from '../FlowEditor';

function makeFlow(): GuidedFlow {
  return {
    id: 'flow-1',
    version: '1.0',
    locale: 'pt-BR',
    title: 'F',
    type: 'guided_conversation',
    status: 'draft',
    entry: { nodeId: 'q1', enteringPhrases: ['oi'], transitionMessage: '' },
    nodes: {
      q1: { id: 'q1', kind: 'choice', text: 'Q', options: [{ id: 'a', label: 'Ok', next: 'fim' }] },
      fim: { id: 'fim', kind: 'result', text: 'Fim.' },
    },
  };
}

function renderEditor(flow: GuidedFlow) {
  const onChange = vi.fn();
  const onSelectNodeId = vi.fn();
  render(
    <FlowEditor
      flow={flow}
      flows={[flow]}
      onChange={onChange}
      selectedNodeId="q1"
      scrollRequest={null}
      nodeSearch=""
      activeNodeFilter="all"
      onSelectNodeId={onSelectNodeId}
    />,
  );
  return { onChange };
}

function lastPatch(onChange: ReturnType<typeof vi.fn>): Partial<GuidedFlow> {
  const calls = onChange.mock.calls as Array<[Partial<GuidedFlow>]>;
  return calls.at(-1)?.[0] as Partial<GuidedFlow>;
}

describe('FlowEditor — imagens na orientação', () => {
  it('adiciona um visual com id/alt/src vazios ao clicar em "Adicionar imagem"', () => {
    const { onChange } = renderEditor(makeFlow());

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar imagem na etapa 1' }));

    const patch = lastPatch(onChange) as { nodes: GuidedFlow['nodes'] };
    expect(patch.nodes.q1.visuals).toEqual([{ id: 'visual', alt: '', src: '' }]);
  });

  it('salva origem e descrição digitadas nos campos da imagem', () => {
    const flow = makeFlow();
    flow.nodes.q1 = {
      ...flow.nodes.q1,
      visuals: [{ id: 'visual', alt: '', src: '' }],
    } as GuidedFlow['nodes'][string];
    const { onChange } = renderEditor(flow);

    fireEvent.change(screen.getByLabelText('Origem da imagem 1 da etapa 1'), {
      target: { value: 'https://exemplo.com/foto.png' },
    });
    fireEvent.change(screen.getByLabelText('Descrição da imagem 1 da etapa 1'), {
      target: { value: 'Pessoa respirando fundo' },
    });

    const patches = onChange.mock.calls as Array<[{ nodes: GuidedFlow['nodes'] }]>;
    const srcPatch = patches[0][0];
    const altPatch = patches.at(-1)?.[0];
    expect(srcPatch.nodes.q1.visuals).toEqual([{ id: 'visual', alt: '', src: 'https://exemplo.com/foto.png' }]);
    expect(altPatch?.nodes.q1.visuals).toEqual([{ id: 'visual', alt: 'Pessoa respirando fundo', src: '' }]);
  });

  it('envia um arquivo e salva a imagem como data URL', async () => {
    const flow = makeFlow();
    flow.nodes.q1 = {
      ...flow.nodes.q1,
      visuals: [{ id: 'visual', alt: '', src: '' }],
    } as GuidedFlow['nodes'][string];
    const { onChange } = renderEditor(flow);

    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'foto.png', {
      type: 'image/png',
    });
    fireEvent.change(screen.getByLabelText('Enviar imagem 1 da etapa 1'), { target: { files: [file] } });

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const patches = onChange.mock.calls as Array<[{ nodes: GuidedFlow['nodes'] }]>;
    const srcPatch = patches.at(-1)?.[0];
    const committed = srcPatch?.nodes.q1.visuals?.[0]?.src ?? '';
    expect(committed.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('mostra um alerta e não salva quando o arquivo não é uma imagem compatível', async () => {
    const flow = makeFlow();
    flow.nodes.q1 = {
      ...flow.nodes.q1,
      visuals: [{ id: 'visual', alt: '', src: '' }],
    } as GuidedFlow['nodes'][string];
    const { onChange } = renderEditor(flow);

    const file = new File(['conteudo'], 'notas.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Enviar imagem 1 da etapa 1'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    expect(screen.getByRole('alert').textContent).toContain('não é uma imagem compatível');
    // Nenhum patch de src foi commitado: onChange nem foi chamado.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('remove a imagem da etapa e limpa a chave visuals quando era a última', () => {
    const flow = makeFlow();
    flow.nodes.q1 = {
      ...flow.nodes.q1,
      visuals: [{ id: 'visual', alt: 'Foto', src: 'https://exemplo.com/foto.png' }],
    } as GuidedFlow['nodes'][string];
    const { onChange } = renderEditor(flow);

    expect(screen.getByLabelText('Origem da imagem 1 da etapa 1')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover imagem 1' }));

    const patch = lastPatch(onChange) as { nodes: GuidedFlow['nodes'] };
    expect(patch.nodes.q1.visuals).toBeUndefined();
  });

  it('mantém as imagens ao trocar o tipo da etapa', () => {
    const flow = makeFlow();
    flow.nodes.q1 = {
      ...flow.nodes.q1,
      visuals: [{ id: 'visual', alt: 'Foto', src: 'https://exemplo.com/foto.png' }],
    } as GuidedFlow['nodes'][string];
    const { onChange } = renderEditor(flow);

    fireEvent.change(screen.getByLabelText('Tipo da etapa 1'), { target: { value: 'result' } });

    const patch = lastPatch(onChange) as { nodes: GuidedFlow['nodes'] };
    expect(patch.nodes.q1.visuals).toEqual([{ id: 'visual', alt: 'Foto', src: 'https://exemplo.com/foto.png' }]);
    expect(patch.nodes.q1.kind).toBe('result');
  });
});
