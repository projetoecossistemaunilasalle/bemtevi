# Conexão direta com agentes de IA

O painel administrativo pode enviar o rascunho diretamente para Codex, Claude Code, Hermes Agent ou Antigravity instalados no mesmo computador. A integração usa uma ponte HTTP limitada ao endereço local (`127.0.0.1`). Chaves e sessões dos agentes permanecem nos respectivos CLIs e nunca são enviadas ao navegador.

## Uso

1. Instale e autentique pelo menos um dos CLIs: `codex`, `claude`, `hermes` ou `agy` (Antigravity).
2. Na raiz do BemTeVi, execute `pnpm agent:bridge`. No Windows, também é possível abrir `iniciar-assistente-ia.cmd` com dois cliques, sem usar o terminal.
3. Abra `Painel > Assistente IA > Conexão direta com agente`.
4. Digite o código temporário exibido no terminal e clique em **Conectar**.
5. Escolha o agente, descreva a alteração e clique em **Enviar ao agente**.
6. Revise o rascunho gerado antes de publicar.

O código de conexão muda sempre que a ponte é reiniciada. A credencial derivada fica apenas no `sessionStorage` da aba. A ponte aceita solicitações de até 7 MiB, limita a saída e encerra execuções após dez minutos.

## Verificar as mudanças

A conexão com o LLM cria ou altera um rascunho local. Ela não publica automaticamente no Neon. O fluxo para verificar e publicar é:

1. Inicie o frontend com `pnpm run dev`.
2. Abra o link exibido pelo Vite. O formato canônico é `http://localhost:<porta>/bemtevi/`. Por padrão, a porta é `3000`; na execução anterior, a porta `3000` já estava ocupada e o link entregue foi `http://localhost:3001/bemtevi/`.
3. Para validar a aplicação, use `http://localhost:<porta>/bemtevi/`.
4. Para revisar o rascunho no painel, use `http://localhost:<porta>/bemtevi/login` e depois `http://localhost:<porta>/bemtevi/dashboard`.
5. No dashboard, abra `Painel > Assistente IA`, aplique o rascunho recebido, revise a prévia/diff e só então clique em **Publicar**.
6. Depois da publicação, recarregue o conteúdo publicado para confirmar o estado que foi salvo no Neon.

Se a porta `3000` estiver ocupada, inicie com `pnpm run dev -- --port 3001` e substitua `<porta>` por `3001` nos links acima. O caminho `/bemtevi/` é obrigatório porque é o `base` da aplicação.

Para uma prévia local sem autenticação, pode-se usar `VITE_DISABLE_AUTH=true`, mas esse modo é apenas para inspeção: ele não deve ser usado para publicar no Neon. A publicação real exige a autenticação administrativa configurada no ambiente.

O endereço `http://127.0.0.1:4318` é a ponte HTTP do agente, não a página de revisão. O link de revisão é o endereço local do frontend informado pelo Vite.

## Segurança

- A ponte sempre escuta apenas em `127.0.0.1`.
- Codex é iniciado com sandbox somente leitura e sessão efêmera.
- Claude Code é iniciado sem ferramentas, sem MCP e sem persistência de sessão.
- Hermes é iniciado em diretório temporário, sem acesso a ferramentas de arquivo ou terminal. A ponte usa o modo programático do ambiente Hermes instalado e, como alternativa, `hermes chat --query-file` nas versões que o oferecem.
- Antigravity é executado pelo comando `agy` e pode ser configurado com `BEMTEVI_ANTIGRAVITY_COMMAND`.
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
BEMTEVI_ANTIGRAVITY_COMMAND=C:\caminho\agy.exe
```

Não fixe `BEMTEVI_AGENT_BRIDGE_CODE` em máquinas compartilhadas. O código aleatório padrão é mais seguro.
