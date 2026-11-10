# Neuro Harness para Claude Code

Plugin central da distribuição Neuro Harness no Claude Code. Vem no marketplace `neuro-harness` junto com os especialistas:

| Plugin | O que traz |
|---|---|
| `neuro-harness` | `/neuro-harness:comecar`, `/neuro-harness:verificar`, `/neuro-harness:atualizar` e a skill `muse-code` |
| `neuro-mv-edit` | Edição de vídeo do bruto à entrega, exportação em 4K/1440p/1080p (H.264, HEVC, ProRes), Remotion Studio e HyperFrames |
| `neuro-ads-manager` | Gestão de tráfego na Meta (auditoria, plano, relatório, conversão) e copy de criativos com compliance por segmento |

## Instalar

**Com a conta Neuro (sem GitHub):**

```bash
curl -fsSL https://harness.neuros.my/install.sh | bash -s -- --claude-code
```

Já tem o Neuro Harness instalado? `neuro-harness claude instalar`.

**Pelo marketplace público, dentro do Claude Code:**

```
/plugin marketplace add monrars1995/neuro-harness-install
/plugin install neuro-harness@neuros
/neuro-harness:instalar
```

A pasta `skills/muse-code` é copiada de `skills/muse-code` na raiz do repositório por `npm run claude:sync`; não edite a cópia.
