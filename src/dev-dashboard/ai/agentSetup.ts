import type { AgentProviderId } from './agentBridge';

export type SetupPlatform = 'windows' | 'mac_linux';

interface SetupCommand {
  label: string;
  command: string;
  help: string;
}

interface AgentSetup {
  id: AgentProviderId;
  label: string;
  shortDescription: string;
  accountDescription: string;
  bestFor: string;
  docsUrl: string;
  commands: Record<SetupPlatform, SetupCommand[]>;
}

export const agentSetups: AgentSetup[] = [
  {
    id: 'codex',
    label: 'Codex',
    shortDescription: 'Assistente da OpenAI que usa sua conta do ChatGPT.',
    accountDescription: 'Você entra com uma conta do ChatGPT. O uso e os limites dependem do plano dessa conta.',
    bestFor: 'Uma boa escolha para quem já usa ChatGPT ou Codex.',
    docsUrl: 'https://learn.chatgpt.com/docs/codex/cli',
    commands: {
      windows: [
        {
          label: '1. Instale o Node.js, se ainda não tiver',
          command: 'winget install OpenJS.NodeJS.LTS',
          help: 'Quando terminar, feche o PowerShell e abra-o novamente.',
        },
        {
          label: '2. Instale o Codex',
          command: 'npm install -g @openai/codex',
          help: 'Aguarde até o PowerShell voltar a aceitar comandos.',
        },
        {
          label: '3. Entre na sua conta',
          command: 'codex',
          help: 'Escolha “Entrar com ChatGPT” e siga as instruções que aparecerem no navegador.',
        },
      ],
      mac_linux: [
        {
          label: '1. Instale o Codex',
          command: 'curl -fsSL https://chatgpt.com/codex/install.sh | sh',
          help: 'O instalador oficial baixa a versão adequada para o computador.',
        },
        {
          label: '2. Entre na sua conta',
          command: 'codex',
          help: 'Escolha “Entrar com ChatGPT” e siga as instruções que aparecerem no navegador.',
        },
      ],
    },
  },
  {
    id: 'claude',
    label: 'Claude Code',
    shortDescription: 'Assistente da Anthropic, conectado à sua conta do Claude.',
    accountDescription: 'Requer uma conta compatível do Claude ou acesso pago pela API da Anthropic.',
    bestFor: 'Uma boa escolha para quem já usa Claude Code.',
    docsUrl: 'https://code.claude.com/docs/en/installation',
    commands: {
      windows: [
        {
          label: '1. Instale o Claude Code',
          command: 'irm https://claude.ai/install.ps1 | iex',
          help: 'Não é necessário abrir o PowerShell como administrador.',
        },
        {
          label: '2. Entre na sua conta',
          command: 'claude',
          help: 'Siga as instruções e conclua a entrada no navegador.',
        },
      ],
      mac_linux: [
        {
          label: '1. Instale o Claude Code',
          command: 'curl -fsSL https://claude.ai/install.sh | bash',
          help: 'O instalador oficial configura o comando automaticamente.',
        },
        {
          label: '2. Entre na sua conta',
          command: 'claude',
          help: 'Siga as instruções e conclua a entrada no navegador.',
        },
      ],
    },
  },
  {
    id: 'hermes',
    label: 'Hermes Agent',
    shortDescription: 'Assistente flexível que permite escolher entre vários serviços de IA.',
    accountDescription:
      'Na configuração, você escolhe um provedor. Alguns oferecem login; outros exigem assinatura ou chave de API.',
    bestFor: 'Indicado para quem quer escolher ou trocar o serviço de IA usado por trás.',
    docsUrl: 'https://hermes-agent.nousresearch.com/docs/getting-started/quickstart/',
    commands: {
      windows: [
        {
          label: '1. Instale o Hermes',
          command: 'iex (irm https://hermes-agent.nousresearch.com/install.ps1)',
          help: 'O instalador abre uma configuração guiada. Ao terminar, abra um novo PowerShell.',
        },
        {
          label: '2. Faça a configuração mais simples',
          command: 'hermes setup --portal',
          help: 'Uma página será aberta para você entrar e escolher o serviço de IA.',
        },
      ],
      mac_linux: [
        {
          label: '1. Instale o Hermes',
          command: 'curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash',
          help: 'Quando terminar, feche e abra o Terminal novamente.',
        },
        {
          label: '2. Faça a configuração mais simples',
          command: 'hermes setup --portal',
          help: 'Uma página será aberta para você entrar e escolher o serviço de IA.',
        },
      ],
    },
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    shortDescription: 'Assistente do Google Antigravity, conectado à sua conta Google.',
    accountDescription: 'Usa a sua conta Google autenticada no Antigravity CLI (agy).',
    bestFor: 'Uma boa escolha para quem usa ou desenvolve com o Google Antigravity.',
    docsUrl: 'https://antigravity.google/docs/cli',
    commands: {
      windows: [
        {
          label: '1. Instale o Antigravity CLI',
          command: 'irm https://antigravity.google/cli/install.ps1 | iex',
          help: 'Execute no PowerShell. O comando agy será registrado automaticamente.',
        },
        {
          label: '2. Entre na sua conta',
          command: 'agy',
          help: 'Siga as instruções para autorizar o acesso com sua conta Google.',
        },
      ],
      mac_linux: [
        {
          label: '1. Instale o Antigravity CLI',
          command: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
          help: 'O instalador configura o comando agy no seu terminal.',
        },
        {
          label: '2. Entre na sua conta',
          command: 'agy',
          help: 'Siga as instruções para autorizar o acesso com sua conta Google.',
        },
      ],
    },
  },
];

export function getAgentSetup(id: AgentProviderId) {
  return agentSetups.find((agent) => agent.id === id) ?? agentSetups[0];
}

export function detectSetupPlatform(): SetupPlatform {
  const platform = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  return platform.includes('win') ? 'windows' : 'mac_linux';
}
