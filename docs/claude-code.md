# Neuro Harness no Claude Code

Os especialistas do Neuro Harness rodam também no Claude Code (terminal, app desktop e VS Code), como três plugins de um mesmo marketplace, `neuro-harness`:

| Plugin | Comandos | O que faz |
|---|---|---|
| `neuro-harness` | `/neuro-harness:comecar`, `/neuro-harness:verificar`, `/neuro-harness:atualizar`; skill `muse-code` | Porta de entrada: mostra os especialistas, verifica o ambiente de todos, atualiza e delega ao Muse Code (Meta) pela assinatura |
| `neuro-mv-edit` | `/neuro-mv-edit:editar`, `exportar`, `verificar`, `perfil`, `tema`, `estudio`, `entregar`, `setup`, `status`; subagentes `decupador` e `revisor`; MCP do ElevenLabs; hook de início de sessão | Edição de vídeo do bruto à entrega, com exportação em 4K, 1440p, 1080p ou na resolução da fonte (H.264, HEVC, ProRes) sem perder qualidade |
| `neuro-ads-manager` | `/neuro-ads-manager:auditar`, `planejar`, `relatorio`, `conversao`, `criativos`, `perfil`; subagentes `auditor`, `analista-conversao`, `revisor-compliance` | Gestão de tráfego na Meta e copy de criativos com compliance por segmento |

## Instalar

### Pela conta Neuro (sem GitHub)

| Situação | Comando |
|---|---|
| Só o Claude Code (sem app, painel nem runtime do Harness) | `curl -fsSL https://harness.neuros.my/install.sh \| bash -s -- --apenas-claude-code` |
| Harness completo e Claude Code | `curl -fsSL https://harness.neuros.my/install.sh \| bash -s -- --claude-code` |
| Windows | `& ([scriptblock]::Create((irm https://harness.neuros.my/install.ps1))) -ApenasClaudeCode` (ou `-ClaudeCode`) |
| Já tem o Neuro Harness | `neuro-harness claude instalar` |

O instalador liga o computador à sua conta (o navegador abre para confirmar), baixa os pacotes pela conta e roda `neuro-harness claude instalar`, que:

1. monta o marketplace local em `~/.neuro-harness/.claude-plugin/marketplace.json`, apontando para os pacotes da distribuição nas versões fixadas (`engine/neuro-mv-edit/<versão>`, `addons/neuro-ads-manager/<versão>` e `claude-code/neuro-harness`);
2. baixa os perfis privados da sua conta, se houver, para a biblioteca local;
3. registra o marketplace no Claude Code (`claude plugin marketplace add ~/.neuro-harness`, escopo do usuário);
4. instala ou atualiza os três plugins e os deixa ativos;
5. tira os marketplaces antigos de um plugin só (`neuro-mv-edit`, `neuro-ads-manager`), para os comandos não aparecerem em dobro.

Depois, abra uma sessão nova do Claude Code (ou rode `/reload-plugins`) e comece com `/neuro-harness:comecar`.

### Pelo npm ou pelo marketplace público

```bash
npx @oneuros/harness claude        # só os especialistas no Claude Code
npx @oneuros/harness               # o Neuro Harness completo
```

No Claude Code, o plugin central é público: `/plugin marketplace add monrars1995/neuro-harness-install`, `/plugin install neuro-harness@neuros` e depois `/neuro-harness:instalar`, que liga a conta e instala os especialistas. Quando o plugin estiver no marketplace oficial do Claude, basta `/plugin install neuro-harness@claude-plugins-official`. Com o plugin central vindo de um desses marketplaces, o `neuro-harness claude instalar` instala só os especialistas.

## Atualizar, conferir e remover

| Comando | O que faz |
|---|---|
| `neuro-harness claude status` | Versão instalada de cada plugin e se há uma mais nova na distribuição |
| `neuro-harness setup && neuro-harness claude instalar` | Baixa as versões novas e atualiza os plugins (o mesmo que `/neuro-harness:atualizar`) |
| `neuro-harness claude remover` | Desinstala os três plugins e o marketplace `neuro-harness` |
| `neuro-harness doctor` | Inclui uma linha com o estado dos plugins no Claude Code |

## Primeira conversa de cada sessão

O `neuro-mv-edit` traz um hook de início de sessão (rápido e sem rede) que lembra o fluxo: antes da primeira edição, o agente pergunta o motor e a exportação (resolução, codec, fps) e depois roda `neuro-mv-edit verificar --corrigir`, que confere e instala o que falta para essas decisões (motor Remotion e navegador, CLI do HyperFrames, skills de apoio, fontes, ffmpeg com os codecs pedidos) e mostra o que depende de você (MCP do ElevenLabs em `/mcp`, espaço em disco para 4K).

## Desenvolvimento

- `claude-code/neuro-harness/` é o plugin central. A skill `skills/muse-code` é copiada para ele por `npm run claude:sync`, que também grava a versão do pacote e as tags fixadas dos especialistas no marketplace. O `npm run check` falha se estiverem fora de sincronia.
- `lib/claude.js` monta o marketplace local e fala com o `claude plugin ... --json`.
