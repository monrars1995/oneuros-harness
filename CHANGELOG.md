# Changelog

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). A CLI e o app desktop compartilham a mesma versão.

## [0.6.0] — 2026-11-10

### Mudado
- **Código aberto.** O Neuro Harness e os especialistas passam a ter código público (MIT): `oneuros-harness`, `oneuros-mv-edit` (motor neuro-mv-edit 1.10.0) e `oneuros-ads-manager` (neuro-ads-manager 0.2.0). Os repositórios novos começam com histórico limpo.
- **A instalação dos agentes continua passando pela conta Neuro aprovada.** Sem a chave da conta, o `setup` e o `claude instalar` recusam instalar os agentes; `NEURO_HARNESS_DEV=1` clona os repositórios públicos para desenvolvimento.
- **Perfis de clientes fora do código.** Os perfis de edição dos clientes saíram do motor e viraram o pacote privado `neuro-clientes`, que o site só entrega às contas liberadas para ele; o `setup` e o `claude instalar` o importam para a biblioteca local sem sobrescrever o que existe. Dados de campanhas e análises não ficam em nenhum repositório.
- O marketplace do GitHub com os especialistas saiu (instalaria sem a conta). No Claude Code: `npx @oneuros/harness claude`, `neuro-harness claude instalar` ou o plugin público `neuro-harness@neuros`.

## [0.5.1] — 2026-11-09

### Adicionado
- **Plugin central público.** O `neuro-harness` do Claude Code passa a ser publicado pelo repositório público do instalador (marketplace `neuros`, pacote npm `@oneuros/harness` e submissão ao marketplace oficial do Claude), com o comando novo `/neuro-harness:instalar`. Os especialistas continuam privados e liberados pela conta Neuro.
- **`npx @oneuros/harness`:** instala o Neuro Harness; `npx @oneuros/harness claude` instala só os especialistas no Claude Code.

### Mudado
- `neuro-harness claude instalar` não instala uma segunda cópia do plugin central quando ele já veio de outro marketplace (oficial ou `neuros`), e o `claude status` o reconhece.
- `npm run claude:sync` copia os comandos do plugin público (`../neuro-harness-install/claude-plugin`) para `claude-code/neuro-harness`.

## [0.5.0] — 2026-11-09

### Adicionado
- **Neuro Harness no Claude Code.** Os especialistas viram três plugins de um marketplace `neuro-harness`:
  - `neuro-harness` (novo, em `claude-code/neuro-harness`): `/neuro-harness:comecar`, `/neuro-harness:verificar`, `/neuro-harness:atualizar` e a skill `muse-code`;
  - `neuro-mv-edit` v1.9.0 e `neuro-ads-manager` v0.1.0, fixados nas tags da distribuição.
- **`neuro-harness claude [instalar|status|remover]`:** marketplace local em `~/.neuro-harness` apontando para os pacotes que a distribuição já baixa, sem GitHub; registra no Claude Code, instala ou atualiza os três plugins e tira os marketplaces antigos de um plugin só. O `doctor` mostra o estado deles.
- **Marketplace do GitHub** (`.claude-plugin/marketplace.json`): `/plugin marketplace add monrars1995/neuro-harness` para quem tem acesso aos repositórios.
- **Instalador:** `--claude-code` (Harness completo + Claude Code) e `--apenas-claude-code` (só os plugins, sem app, painel nem runtime); no Windows, `-ClaudeCode` e `-ApenasClaudeCode`.
- `npm run claude:sync` e a conferência no `npm run check`.

### Mudado
- **Motor neuro-mv-edit v1.9.0:** exportação em 4K, 1440p, 1080p, 720p ou na resolução da fonte, em H.264, HEVC ou ProRes, decidida pelo usuário antes da edição e sem perder a qualidade da fonte; verificação do ambiente (dependências, skills de apoio, MCPs, disco e memória) na primeira conversa da sessão.

## [0.4.1] — 2026-11-09

### Corrigido
- **App do macOS "danificado e não pode ser aberto":** o pacote saía só com a assinatura automática do executável do Electron, que não cobria os arquivos do app.
  - Agora o app inteiro é assinado (ad-hoc), e o macOS passa a mostrar o aviso de desenvolvedor não verificado, que se libera uma vez em Ajustes do Sistema.
  - Quem instala pelo comando de uma linha não vê aviso nenhum.
- **Notarização da Apple pronta no build:** ela entra sozinha quando o CI tiver as credenciais de Desenvolvedor Apple (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`).

## [0.4.0] — 2026-11-08

### Adicionado
- **Muse Code (Meta):**
  - a skill `muse-code` deixa os agentes do Harness delegarem tarefas ao CLI oficial `muse exec`, que roda pela assinatura do Muse Code;
  - o `setup` instala a skill quando encontra o `muse` na máquina;
  - `neuro-harness meta` mostra o CLI, a assinatura e a skill.

### Alterado
- As sessões não herdam mais `META_API_KEY` do ambiente: uma chave de API venceria o login do `muse` e cobraria por uso em vez da assinatura.

### Observação
- **A assinatura só vale no cliente oficial:** a Meta recusa a assinatura do Muse Code em outros apps (`client_attestation_denied`). Por isso ela não entra como provedor de modelos.
- **Modelos Muse direto no Harness:** continuam disponíveis com uma chave de API paga, configurada em `META_API_KEY`.

## [0.3.0] — 2026-11-08

### Adicionado
- **Instalação pela conta Neuro, sem GitHub:**
  - `neuro-harness entrar` liga o computador à sua conta: mostra um código, você confirma em harness.neuros.my/conectar e a máquina recebe a chave pessoal (`nh_…`);
  - a chave fica em `~/.neuro-harness/acesso.json` (modo 600) ou em `NEURO_HARNESS_CHAVE`;
  - `neuro-harness entrar --chave nh_…` usa uma chave gerada em harness.neuros.my/conta.
- **`neuro-harness conta`** mostra a conta conectada e confere a chave no site.
- **`neuro-harness sair`** apaga a chave deste computador.
- **Downloads pela chave:** com a chave, o `setup` baixa o motor de edição e os agentes pelo site (`/api/pacotes`), sem `git clone` e sem login no GitHub.
  - Revogar o acesso corta os downloads e as atualizações.

### Alterado
- O `deps` e o app aceitam a conta Neuro ou um GitHub com acesso; o GitHub CLI deixa de ser obrigatório.
- **Site e endereço próprio:** o instalador de uma linha passa a ser servido por **harness.neuros.my**:
  - `curl -fsSL https://harness.neuros.my/install.sh | bash` (macOS e Linux);
  - `irm https://harness.neuros.my/install.ps1 | iex` (Windows).
- O endereço antigo, direto do GitHub, continua funcionando.
- O site também tem o download do app, estes guias e a versão atual em `/api/latest`.
- O `neuro-harness deps` mostra os comandos com o endereço novo.

## [0.2.1] — 2026-11-08

### Corrigido
- **Acesso pelo navegador:** abrir `http://127.0.0.1:3082/` sem o token num navegador novo mostrava "dsh web authentication required" sem explicar o porquê.
  - O `start` e o `restart` passam a explicar o que fazer: abrir uma vez o endereço com o token, ou usar `neuro-harness open`.
  - Depois disso, o navegador guarda o acesso por 30 dias.
  - A explicação também está em `docs/instalacao.md`.

## [0.2.0] — 2026-11-08

### Adicionado
- **Instalação de uma linha** pelo repositório público `neuro-harness-install` (só os scripts, sem segredos):
  - `install.sh` para macOS e Linux, `install.ps1` para Windows;
  - instala as dependências (Homebrew, apt, dnf, pacman ou winget), faz o login no GitHub, baixa a última Release, põe o `neuro-harness` no PATH, roda o setup, importa as chaves e instala o app.
- **`setup` completo:**
  - instala o **neuro-mv-edit 1.8.0** e o **neuro-ads-manager 0.1.0** como plugins do perfil, fixados por versão;
  - ativa os plugins oficiais Agent Teams, Auto review, busca em sessões, terminal persistente e títulos de sessão.
- **`neuro-harness deps`:** confere os pré-requisitos do sistema e mostra o comando do instalador quando falta algo.
- **App desktop:** confere as dependências na abertura. Se faltar alguma, o botão **Instalar o que falta** abre o Terminal (ou o PowerShell) com o instalador, e o app continua sozinho quando tudo fica pronto.

### Alterado
- O motor neuro-mv-edit passa da 1.7.2 para a 1.8.0 (plugin do Neuro Harness). O `setup` atualiza quando a versão fixada muda.

## [0.1.0] — 2026-11-08

Primeira versão do Neuro Harness, uma distribuição do DeepSeek Harness 0.2.1-alpha.2.

### Adicionado
- **CLI `neuro-harness`** (Node, sem dependências; macOS, Linux e Windows):
  - comandos `setup`, `start`, `stop`, `restart`, `status`, `url`, `open`, `doctor`, `engine`, `credenciais`, `run` e `version`;
  - o Harness sobe como processo próprio, sem tmux;
  - o ambiente das sessões é limpo: PATH com o bin da distribuição na frente, sem pastas do Claude Code, cache npm próprio e nenhuma chave de provedor vinda do ambiente.
- **Instalação idempotente** em `~/.neuro-harness`:
  - o DeepSeek Harness numa versão fixa;
  - o motor neuro-mv-edit 1.7.2, com os atalhos `neuro-mv-edit` (sh e .cmd);
  - o perfil `neuro`, com um bloco gerenciado pela distribuição;
  - os plugins da distribuição.
- **Importação de credenciais** do Hermes e do OpenCode para o cofre do Harness:
  - cada chave é validada no próprio provedor;
  - nenhum valor é mostrado;
  - os logins OAuth não são copiados.
- **Plugin `neuro-harness-brand`:**
  - o isotipo "n-neurônio": um n desenhado por um traço único que nasce de um nó;
  - o nome "neuro harness", com o título e o ícone da aba;
  - as cores dos temas claro e escuro;
  - a marca oficial do DeepSeek Harness fica desligada.
- **Plugin `neuro-harness-pt-br`:**
  - 2.489 textos da interface em 55 áreas, traduzidos para o português do Brasil;
  - o pt-BR é o idioma padrão, e a escolha que você salvar é respeitada.
- **App desktop** (Electron 44):
  - macOS Apple Silicon (`.dmg`) e Windows x64 (instalador NSIS);
  - ao abrir, instala ou atualiza e sobe o Harness; ao sair, para o Harness que subiu;
  - a tela de abertura mostra o andamento e os erros.
- **CI:** o workflow `App desktop` monta o `.dmg` e o `.exe` a cada tag `v*` e os anexa à Release.
- **Documentação** em pt-BR: README, os guias em `docs/`, o `NOTICE` com os créditos e o `LICENSE` (MIT).
