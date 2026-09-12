import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlowDestinationMap } from '../FlowDestinationMap';
import { focusFlow, flow, renderMap, renderStatefulMap } from './FlowDestinationMapTestHarness';
import { installScrollStub } from './scrollStubs';

describe('FlowDestinationMap - focus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selects the requested stage and scrolls its panel section on focusRequest', () => {
    const { stub: scrollIntoViewStub, restore } = installScrollStub();
    try {
      renderMap({
        flow: focusFlow,
        flows: [focusFlow],
        focusRequest: { nodeId: 'q2', section: 'opcoes', requestId: 1 },
      });

      expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Quer deixar um recado?');
      expect(scrollIntoViewStub).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      restore();
    }
  });

  it('re-fires the section scroll when the same stage is requested again', () => {
    const { stub: scrollIntoViewStub, restore } = installScrollStub();
    try {
      const view = renderMap({
        flow: focusFlow,
        flows: [focusFlow],
        focusRequest: { nodeId: 'q2', section: 'opcoes', requestId: 1 },
      });
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      view.rerender(
        <FlowDestinationMap {...view.props} focusRequest={{ nodeId: 'q2', section: 'opcoes', requestId: 2 }} />,
      );

      expect(scrollIntoViewStub).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('clears the held section focus when a stage is clicked manually', () => {
    const { stub: scrollIntoViewStub, restore } = installScrollStub();
    try {
      renderMap({
        flow: focusFlow,
        flows: [focusFlow],
        focusRequest: { nodeId: 'q2', section: 'texto', requestId: 1 },
      });

      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getAllByText('Pergunta')[0]);
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getAllByText('Pergunta')[1]);
      expect(scrollIntoViewStub).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('textbox', { name: /texto da etapa/i })).toHaveValue('Quer deixar um recado?');
    } finally {
      restore();
    }
  });

  it('clears the node selection and requests settings for a node-less focusRequest', () => {
    const onRequestSettingsOpen = vi.fn();
    const view = renderMap({ onRequestSettingsOpen });

    fireEvent.click(screen.getByText('Como você está hoje?'));
    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();

    view.rerender(<FlowDestinationMap {...view.props} focusRequest={{ requestId: 1 }} />);

    expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
    expect(onRequestSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it('ignores a focusRequest pointing at an unknown stage', () => {
    renderMap({
      flow: focusFlow,
      flows: [focusFlow],
      focusRequest: { nodeId: 'fantasma', section: 'texto', requestId: 1 },
    });

    expect(screen.queryByTestId('node-editor-panel')).not.toBeInTheDocument();
  });

  it('opens focused mode on an option when clicked on canvas and highlights it', async () => {
    const user = userEvent.setup();
    renderStatefulMap(flow);

    const optionSupport = screen.getByText('Preciso de apoio');
    await user.click(optionSupport);

    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByText('Editando Opção 1')).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 1' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Rótulo da opção 2' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ver etapa inteira/i }));
    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 2' })).toBeInTheDocument();
  });

  it('opens focused mode on stage text when clicked on canvas', async () => {
    const user = userEvent.setup();
    renderStatefulMap(flow);

    await user.click(screen.getByText('Como você está hoje?'));

    expect(screen.getByTestId('node-editor-panel')).toBeInTheDocument();
    expect(screen.getByText('Editando Texto da etapa')).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: 'Texto da etapa' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Rótulo da opção 1' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ver todas as seções da etapa/i }));
    expect(screen.getByRole('textbox', { name: 'Rótulo da opção 1' })).toBeInTheDocument();
  });
});
