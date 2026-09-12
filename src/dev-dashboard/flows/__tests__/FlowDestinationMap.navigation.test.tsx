import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GuidedFlow } from '../../../domain/flow-engine/types';
import { flow, renderMap } from './FlowDestinationMapTestHarness';

describe('FlowDestinationMap - navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the reachable destination index and structural counts', () => {
    renderMap();

    expect(screen.getByRole('heading', { name: 'Mapa por destino' })).toBeInTheDocument();
    expect(screen.getByText('3', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /segurança imediata/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /segurança ao concluir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /encerramento|result/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/etapas fora do caminho de entrada/i)).toBeInTheDocument();
  });

  it('gives converging relations separate destination ports', () => {
    const { container } = renderMap();
    const resultNode = container.querySelector('.react-flow__node[data-id="destination:result:result"]');
    const targetHandles = [...(resultNode?.querySelectorAll('.flow-destination-map__target') ?? [])];

    expect(targetHandles).toHaveLength(2);
    expect(new Set(targetHandles.map((handle) => handle.getAttribute('data-handleid')).filter(Boolean)).size).toBe(2);
  });

  it('selects a destination and reports its reverse reachability', async () => {
    const user = userEvent.setup();
    renderMap();

    await user.click(screen.getByRole('button', { name: /segurança imediata/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Segurança imediata');
    expect(screen.getByRole('button', { name: /limpar destino selecionado/i })).toBeInTheDocument();
  });

  it('opens a connected flow directly from its destination', async () => {
    const user = userEvent.setup();
    const onOpenFlow = vi.fn();
    const targetFlow: GuidedFlow = {
      ...flow,
      id: 'acolhimento',
      title: 'Acolhimento',
      nodes: { result: { id: 'result', kind: 'result', text: 'Acolhimento.' } },
      entry: { ...flow.entry, nodeId: 'result' },
    };
    const sourceFlow: GuidedFlow = {
      ...flow,
      nodes: {
        q1: {
          id: 'q1',
          kind: 'choice',
          text: 'Como você quer seguir?',
          options: [
            {
              id: 'handoff',
              label: 'Quero acolhimento',
              next: 'result',
              effects: [{ kind: 'flow_start', flowId: 'acolhimento' }],
            },
          ],
        },
        result: { id: 'result', kind: 'result', text: 'Fallback não alcançável.' },
      },
    };
    renderMap({ flow: sourceFlow, flows: [sourceFlow, targetFlow], onOpenFlow });

    expect(screen.getByText('Abre Acolhimento')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /abrir fluxo · acolhimento/i }));

    expect(onOpenFlow).toHaveBeenCalledWith('acolhimento');
  });

  it('keeps unreachable stages out of the live graph and exposes them in a separate strip', async () => {
    const user = userEvent.setup();
    renderMap();

    const unreachable = screen.getByLabelText('Etapas fora do caminho de entrada');
    expect(unreachable).toHaveTextContent('Etapa não alcançada.');
    await user.click(screen.getByRole('button', { name: /etapa não alcançada/i }));

    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Etapa não alcançada.');
  });

  it('searches without hiding the topology and reports no matches', async () => {
    const user = userEvent.setup();
    renderMap();
    const search = screen.getByRole('searchbox', { name: /buscar etapa/i });

    await user.type(search, 'does-not-exist');

    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma etapa corresponde à busca.');
    expect(screen.getByRole('heading', { name: 'Mapa por destino' })).toBeInTheDocument();
  });

  it('opens the node editor panel when a stage is selected', async () => {
    const user = userEvent.setup();
    const { props } = renderMap();

    fireEvent.click(screen.getAllByText('Pergunta')[0]);
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /abrir no editor legado/i }));
    expect(props.onEditNode).toHaveBeenCalledWith('check-in', 'q1');
  });

  it('renders unreachable nodes with disconnected badge', () => {
    renderMap();
    expect(screen.getByText('Não conectada')).toBeInTheDocument();
    expect(screen.getAllByText('Etapa não alcançada.')).toHaveLength(2);
  });

  it('shifts map overlays clear of the editor panel only while it is open', async () => {
    const user = userEvent.setup();
    renderMap();
    const canvas = screen.getByLabelText('Mapa por destino do fluxo Check-in');
    expect(canvas).not.toHaveClass('flow-destination-map__canvas--with-panel');

    fireEvent.click(screen.getByText('Como você está hoje?'));
    expect(canvas).toHaveClass('flow-destination-map__canvas--with-panel');

    await user.click(screen.getByRole('button', { name: /segurança imediata/i }));
    expect(screen.getByRole('status')).toHaveClass('flow-destination-map__selection--clear-of-panel');

    await user.click(screen.getByRole('button', { name: /fechar painel de edição/i }));
    expect(canvas).not.toHaveClass('flow-destination-map__canvas--with-panel');
    expect(screen.getByRole('status')).not.toHaveClass('flow-destination-map__selection--clear-of-panel');
  });
});
