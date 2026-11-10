# App desktop

O app é uma janela nativa (Electron 44) sobre o mesmo núcleo da CLI (`lib/harness.js`).

## Instalar

Baixe da página de [Releases](https://github.com/monrars1995/oneuros-harness/releases):
- **macOS, Apple Silicon:** `Neuro-Harness-<versão>-arm64.dmg`. Abra e arraste o app para Aplicativos.
- **Windows 10/11, 64 bits:** `Neuro-Harness-Setup-<versão>.exe`. Siga o instalador; você pode escolher a pasta.

### Apps sem assinatura

Os instaladores ainda não têm assinatura de código. Na primeira vez:

**macOS (Gatekeeper):**
- clique com o botão direito no app e escolha **Abrir**, depois **Abrir** de novo;
- ou, no Terminal: `xattr -dr com.apple.quarantine "/Applications/Neuro Harness.app"`.

**Windows (SmartScreen):** clique em **Mais informações** e depois em **Executar assim mesmo**.

**Para tirar esses avisos,** os apps precisam de assinatura:
- **macOS:** certificado Apple Developer ID, mais a notarização;
- **Windows:** certificado de assinatura de código.

O CI já está pronto para receber esses certificados como segredos do repositório.

## O que o app faz

1. **Tela de abertura:** o app roda o `setup` num processo filho e mostra o andamento.
   - Na primeira vez, ele baixa o DeepSeek Harness (cerca de 550 MB) e o motor neuro-mv-edit.
   - Nas outras vezes, só confere e atualiza o que mudou.
2. **Harness local:** ele sobe o Harness. Se a CLI já estiver rodando, o app reaproveita.
3. **Painel:** ele abre o painel numa janela nativa.
   - Endereços locais (`127.0.0.1` e `localhost`, como o Remotion Studio) abrem dentro do app.
   - Links externos abrem no navegador padrão.
4. **Ao sair:** o app para o Harness, se foi ele que o subiu.

**PATH no macOS:** apps abertos pelo Finder recebem um PATH mínimo. Por isso o app usa o PATH do seu shell de login (Homebrew, nvm etc.) para achar o Node, o git, o Python e o FFmpeg.

## Montar localmente

```bash
cd apps/desktop
npm ci
npm start                 # roda sem empacotar (usa o lib/ e o plugins/ do repositório)
npm run pack              # app sem instalador em dist/ (teste rápido)
npm run dist:mac          # dist/Neuro-Harness-<versão>-arm64.dmg (em um Mac)
npm run dist:win          # dist/Neuro-Harness-Setup-<versão>.exe (em um Windows)
```

O `npm run sync` (chamado pelos outros scripts) copia `lib/`, `plugins/`, `LICENSE` e `NOTICE` para `apps/desktop/vendor`. É de lá que o empacotador lê.

## CI

O workflow [`.github/workflows/desktop.yml`](../.github/workflows/desktop.yml) roda a cada tag `v*` e também à mão.
- **macOS:** monta o `.dmg` num runner `macos-latest` (Apple Silicon).
- **Windows:** monta o `.exe` num runner `windows-latest`.
- **Publicação:** anexa os dois à Release da tag.
