import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { GuidedFlow, OrientationVideo, ResultFlowNode } from '../../../domain/flow-engine/types';
import { NodeEditorPanel } from '../NodeEditorPanel';
import {
  choiceNode,
  createFlow,
  isResultNode,
  lastPatch,
  makePanelProps,
  patchedNodeOf,
  renderStatefulPanel,
  resultNode,
} from './nodeEditorPanelTestSupport';

describe('NodeEditorPanel mídia', () => {
  const videoA: OrientationVideo = {
    id: 'fim-video-1',
    title: 'Respiração',
    url: 'https://www.youtube.com/watch?v=abc',
  };
  const videoB: OrientationVideo = { id: 'fim-video-2', title: 'Sono', url: 'https://youtu.be/xyz' };

  function createMediaFlow(nodeOverrides: Partial<ResultFlowNode> = {}): GuidedFlow {
    const fim: ResultFlowNode = { ...resultNode, ...nodeOverrides };
    return createFlow({ nodes: { q1: choiceNode, fim }, nodeOrder: ['q1', 'fim'] });
  }

  function renderMediaPanel(flow: GuidedFlow = createMediaFlow(), nodeId = 'fim') {
    const props = makePanelProps(flow, nodeId);
    render(<NodeEditorPanel {...props} />);
    return props;
  }

  it('shows only the add button while the node has no videos', () => {
    renderMediaPanel();

    expect(screen.queryByLabelText(/Título do vídeo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/URL do vídeo/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar vídeo' })).toBeInTheDocument();
  });

  it('renders title/url rows for existing videos without hinting YouTube links', () => {
    renderMediaPanel(createMediaFlow({ videos: [videoA, videoB] }));

    expect(screen.getByLabelText('Título do vídeo 1')).toHaveValue('Respiração');
    expect(screen.getByLabelText('URL do vídeo 1')).toHaveValue(videoA.url);
    expect(screen.getByLabelText('Título do vídeo 2')).toHaveValue('Sono');
    expect(screen.getByLabelText('URL do vídeo 2')).toHaveValue(videoB.url);
    expect(screen.getByRole('button', { name: 'Remover vídeo 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover vídeo 2' })).toBeInTheDocument();
    // youtube.com and youtu.be links never trigger the advisory hint.
    expect(screen.queryByText('Use um link completo do YouTube.')).not.toBeInTheDocument();
  });

  it('round-trips videos through the updater and drops the key when the last one goes', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createMediaFlow(), 'fim');

    await user.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim').videos).toEqual([{ id: 'fim-video-1', title: '', url: '' }]);

    await user.type(screen.getByLabelText('Título do vídeo 1'), 'Vídeo útil');
    await user.tab();
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'fim').videos?.[0]).toEqual({
      id: 'fim-video-1',
      title: 'Vídeo útil',
      url: '',
    });

    await user.type(screen.getByLabelText('URL do vídeo 1'), 'https://example.com/apoio');
    await user.tab();
    expect(history).toHaveLength(3);
    expect(patchedNodeOf(history[2].patch, 'fim').videos?.[0]?.url).toBe('https://example.com/apoio');

    await user.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    expect(patchedNodeOf(history[3].patch, 'fim').videos?.[1]?.id).toBe('fim-video-2');

    await user.click(screen.getByRole('button', { name: 'Remover vídeo 1' }));
    expect(history).toHaveLength(5);
    expect(patchedNodeOf(history[4].patch, 'fim').videos).toEqual([{ id: 'fim-video-2', title: '', url: '' }]);

    await user.click(screen.getByRole('button', { name: 'Remover vídeo 1' }));
    expect(history).toHaveLength(6);
    expect(patchedNodeOf(history[5].patch, 'fim')).not.toHaveProperty('videos'); // last removal drops the key entirely
  });

  it('shows the YouTube hint only for non-empty non-YouTube URLs', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(
      createMediaFlow({ videos: [{ id: 'fim-video-1', title: 'Dica', url: 'https://example.com/x' }] }),
      'fim',
    );

    expect(screen.getByText('Use um link completo do YouTube.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('URL do vídeo 1'));
    await user.type(screen.getByLabelText('URL do vídeo 1'), 'https://youtu.be/z9');
    await user.tab();

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim').videos?.[0]?.url).toBe('https://youtu.be/z9');
    expect(screen.queryByText('Use um link completo do YouTube.')).not.toBeInTheDocument();
  });

  it('hides the hint while the URL field is empty', () => {
    renderMediaPanel(createMediaFlow({ videos: [{ id: 'fim-video-1', title: '', url: '' }] }));

    expect(screen.queryByText('Use um link completo do YouTube.')).not.toBeInTheDocument();
  });

  it('splits recommendations one per line and joins them back for display', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createMediaFlow({ recommendations: ['Durma bem', 'Procure apoio'] }), 'fim');
    const textarea = screen.getByLabelText('Recomendações da etapa final');

    expect(textarea).toHaveValue('Durma bem\nProcure apoio'); // joined back for display
    expect(textarea).toHaveAttribute('placeholder', 'Uma recomendação por linha.');

    await user.type(textarea, '\nFale com alguém de confiança');
    await user.tab();

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim', isResultNode).recommendations).toEqual([
      'Durma bem',
      'Procure apoio',
      'Fale com alguém de confiança',
    ]);

    // Blank lines are dropped and neighbors trimmed on the next commit.
    await user.clear(textarea);
    await user.type(textarea, 'a\n\n b ');
    await user.tab();
    expect(history).toHaveLength(2);
    expect(patchedNodeOf(history[1].patch, 'fim', isResultNode).recommendations).toEqual(['a', 'b']);
  });

  it('drops the recommendations key entirely when every line is removed', async () => {
    const user = userEvent.setup();
    const history = renderStatefulPanel(createMediaFlow({ recommendations: ['Só uma linha'] }), 'fim');

    await user.clear(screen.getByLabelText('Recomendações da etapa final'));
    await user.tab();

    expect(history).toHaveLength(1);
    expect(patchedNodeOf(history[0].patch, 'fim', isResultNode)).not.toHaveProperty('recommendations');
  });

  it('omits recommendations for non-result nodes but keeps the video affordance everywhere', async () => {
    const user = userEvent.setup();
    const props = renderMediaPanel(createMediaFlow(), 'q1');

    expect(screen.queryByLabelText('Recomendações da etapa final')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar vídeo' })).toBeInTheDocument(); // mídia works on choices too

    await user.click(screen.getByRole('button', { name: 'Adicionar vídeo' }));
    expect(props.onFlowChange).toHaveBeenCalledTimes(1);
    expect(patchedNodeOf(lastPatch(props.onFlowChange), 'q1').videos).toEqual([
      { id: 'q1-video-1', title: '', url: '' },
    ]);
  });
});
