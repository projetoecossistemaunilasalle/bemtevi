import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedContentPayload } from '../../../app/content/publishedContent';
import { DirectAgentSection } from '../DirectAgentSection';

const { pairAgentBridge, getAgentBridgeStatus, runAgent } = vi.hoisted(() => ({
  pairAgentBridge: vi.fn(),
  getAgentBridgeStatus: vi.fn(),
  runAgent: vi.fn(),
}));

vi.mock('../agentBridge', async () => {
  const actual = await vi.importActual<typeof import('../agentBridge')>('../agentBridge');
  return { ...actual, pairAgentBridge, getAgentBridgeStatus, runAgent };
});

const payload: PublishedContentPayload = {
  flows: [],
  educationMaterials: [],
  educationGroups: [],
  contacts: [],
  locations: [],
  defaultGroupOrder: 0,
};

describe('DirectAgentSection', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    pairAgentBridge.mockResolvedValue('secret');
    getAgentBridgeStatus.mockResolvedValue({
      connected: true,
      workspace: 'bemtevi',
      providers: [
        { id: 'codex', label: 'Codex', available: true },
        { id: 'claude', label: 'Claude Code', available: false },
        { id: 'hermes', label: 'Hermes Agent', available: false },
      ],
    });
    runAgent.mockResolvedValue(JSON.stringify(payload));
  });

  it('mostra uma instalação guiada em português para cada assistente', async () => {
    const user = userEvent.setup();
    render(<DirectAgentSection draft={payload} onApply={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Escolha seu assistente' })).toBeInTheDocument();
    expect(screen.getByText(/Sua senha nunca passa pelo BemTeVi/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Windows' }));
    expect(screen.getByText('npm install -g @openai/codex')).toBeInTheDocument();
    expect(screen.getByText(/dê dois cliques em “iniciar-assistente-ia.cmd”/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Claude Code/ }));
    expect(screen.getByText('irm https://claude.ai/install.ps1 | iex')).toBeInTheDocument();
    expect(screen.getByText(/Requer uma conta compatível do Claude/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Hermes Agent/ }));
    expect(screen.getByText('hermes setup --portal')).toBeInTheDocument();
    expect(screen.getByText(/permite escolher entre vários serviços de IA/)).toBeInTheDocument();
  });

  it('pareia a ponte, executa o agente e aplica o payload ao rascunho', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(<DirectAgentSection draft={payload} onApply={onApply} />);

    await user.type(screen.getByLabelText('Código de seis números'), '123456');
    await user.click(screen.getByRole('button', { name: 'Conectar assistente' }));
    expect(await screen.findByText('Conexão pronta')).toBeInTheDocument();

    await user.type(screen.getByLabelText('O que você quer alterar?'), 'Revise a ortografia.');
    await user.click(screen.getByRole('button', { name: 'Enviar ao agente' }));

    expect(await screen.findByText(/concluiu a tarefa/)).toBeInTheDocument();
    expect(runAgent).toHaveBeenCalledWith(
      'http://127.0.0.1:4318',
      'secret',
      'codex',
      expect.stringContaining('Revise a ortografia.'),
      expect.any(Object),
    );
    expect(onApply).toHaveBeenCalledWith(payload);
  });
});
