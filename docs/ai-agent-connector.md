# Conexão direta com agentes de IA

O painel administrativo pode enviar o rascunho diretamente para Codex, Claude Code ou Hermes Agent instalados no mesmo computador. A integração usa uma ponte HTTP limitada ao endereço local (`127.0.0.1`). Chaves e sessões dos agentes permanecem nos respectivos CLIs e nunca são enviadas ao navegador.

## Uso

1. Instale e autentique pelo menos um dos CLIs: `codex`, `claude` ou `hermes`.
2. Na raiz do BemTeVi, execute `pnpm agent:bridge`. No Windows, também é possível abrir `iniciar-assistente-ia.cmd` com dois cliques, sem usar o terminal.
3. Abra `Painel > Assistente IA > Conexão direta com agente`.
4. Digite o código temporário exibido no terminal e clique em **Conectar**.
5. Escolha o agente, descreva a alteração e clique em **Enviar ao agente**.
6. Revise o rascunho gerado antes de publicar.

O código de conexão muda sempre que a ponte é reiniciada. A credencial derivada fica apenas no `sessionStorage` da aba. A ponte aceita solicitações de até 7 MiB, limita a saída e encerra execuções após dez minutos.

## Segurança

- A ponte sempre escuta apenas em `127.0.0.1`.
- Codex é iniciado com sandbox somente leitura e sessão efêmera.
- Claude Code é iniciado sem ferramentas, sem MCP e sem persistência de sessão.
- Hermes é iniciado em diretório temporário, sem acesso a ferramentas de arquivo ou terminal. A ponte usa o modo programático do ambiente Hermes instalado e, como alternativa, `hermes chat --query-file` nas versões que o oferecem.
- Imagens do rascunho são substituídas por referências `./images/...` antes do envio e restauradas localmente depois.
- A resposta passa pela validação existente e vira apenas um rascunho. A publicação continua sendo uma ação separada.

## Configuração opcional

Variáveis aceitas pela ponte:

```dotenv
BEMTEVI_AGENT_BRIDGE_PORT=4318
BEMTEVI_AGENT_BRIDGE_CODE=123456
BEMTEVI_CODEX_COMMAND=C:\caminho\codex.exe
BEMTEVI_CLAUDE_COMMAND=C:\caminho\claude.exe
BEMTEVI_HERMES_COMMAND=C:\caminho\hermes.exe
```

Não fixe `BEMTEVI_AGENT_BRIDGE_CODE` em máquinas compartilhadas. O código aleatório padrão é mais seguro.
