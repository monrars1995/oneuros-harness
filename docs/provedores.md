# Provedores e chaves

O Neuro Harness usa o sistema de provedores do DeepSeek Harness.

**Onde configurar:** em Configurações → Modelos, no painel.

**Onde ficam as chaves:** no cofre do Harness, `~/.neuro-harness/dsh/.credentials.yaml`. Só o seu usuário lê esse arquivo, e ele nunca entra no ambiente das sessões.

## Importar o que você já tem

```bash
neuro-harness credenciais --dry-run   # mostra o que encontraria e testa cada chave, sem gravar
neuro-harness credenciais             # grava no cofre as chaves aceitas
```

O comando lê `~/.hermes/.env`, `~/.local/share/opencode/auth.json` e `~/.config/opencode/meta-api-key`.
- **Teste:** cada chave é testada no próprio provedor, e só o código HTTP aparece.
- **O que é gravado:** só as chaves aceitas.
- **O que é mantido:** uma chave que já está no cofre não é trocada, a menos que você use `--sobrescrever`.

| Referência no cofre | Provedor | De onde vem |
|---|---|---|
| `KIMI_API_KEY` | `kimi-coding` (Kimi for Coding) | Hermes `KIMI_API_KEY` ou OpenCode `kimi-for-coding` |
| `OPENROUTER_API_KEY` | `openrouter` | Hermes |
| `ZAI_API_KEY` | `zai` (plano de código GLM) | OpenCode `zai-coding-plan` ou Hermes `GLM_API_KEY` |
| `MINIMAX_API_KEY` | `minimax` | Hermes ou OpenCode `minimax-coding-plan` |
| `GEMINI_API_KEY` | `google` | Hermes ou OpenCode `google` |
| `OPENAI_API_KEY` | `openai` | Hermes |
| `OPENCODE_API_KEY` | `opencode` (Zen) | Hermes `OPENCODE_ZEN_API_KEY` ou OpenCode |
| `OPENCODE_GO_API_KEY` | `opencode-go` | Hermes ou OpenCode |
| `NVIDIA_API_KEY` | `nvidia` | Hermes |
| `META_API_KEY` | `meta` | `~/.config/opencode/meta-api-key` |
| `DEEPSEEK_API_KEY` | `deepseek` | Hermes, ou o que você digitar no painel |

## Logins (OAuth)

**O que não é copiado:** os logins do ChatGPT/Codex (`openai-codex`), do Kimi CLI e do MiniMax. Neles, o token de renovação é único: se duas ferramentas usarem o mesmo, uma derruba a outra.

**Como entrar:** em Configurações → Modelos.

**Uso de assinatura fora dos apps oficiais:** depende dos termos de cada provedor. A chave de API é o caminho sem risco.

## Saldo e erros comuns

| Mensagem | O que significa |
|---|---|
| `MISSING_CREDENTIAL` | Nenhuma chave para esse provedor. Importe ou digite em Configurações → Modelos |
| `QUOTA: Insufficient Balance` ou `Insufficient balance or no resource package` | A chave é válida, mas a conta está sem saldo ou sem plano |
| `INVALID_REQUEST … always engages in thinking` | O modelo exige raciocínio ligado: escolha um nível de raciocínio no seletor de modelo |

## Modelo por papel

**Para o revisor de vídeo,** que precisa ler imagens, use um modelo com entrada de imagem. Exemplos: `kimi-coding/kimi-for-coding`, os modelos Gemini e os modelos Claude via OpenRouter.

**Para tarefas sem interface:**

```bash
neuro-harness run "..." --modelo kimi-coding/kimi-for-coding
```
