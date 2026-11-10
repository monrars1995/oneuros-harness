# Instalação e operação

## Instalador de uma linha (recomendado)

```bash
# macOS e Linux
curl -fsSL https://harness.neuros.my/install.sh | bash
```

```powershell
# Windows 10/11
irm https://harness.neuros.my/install.ps1 | iex
```

**Se o site estiver fora do ar:** troque `https://harness.neuros.my/` por `https://raw.githubusercontent.com/monrars1995/neuro-harness-install/main/`.

**O que ele faz:** instala as dependências abaixo, faz o login no GitHub, baixa a última Release para `~/.neuro-harness/src`, põe o `neuro-harness` no PATH, roda o `setup`, importa as chaves e instala o app.
- **Opções e detalhes:** no repositório [neuro-harness-install](https://github.com/monrars1995/neuro-harness-install).
- **Atualizar:** rode o mesmo comando de novo.

O resto desta página descreve a instalação à mão, a partir de um clone.


## Instalar com a sua conta Neuro

Por padrão, o instalador usa a sua conta Neuro, sem login no GitHub:
1. Peça acesso em [harness.neuros.my/acesso](https://harness.neuros.my/acesso) e aguarde a aprovação.
2. Rode o instalador. O navegador abre em harness.neuros.my/conectar com um código. Confirme este computador.
3. A máquina recebe a sua chave pessoal e baixa tudo pelo site.

Já tem uma chave gerada em [harness.neuros.my/conta](https://harness.neuros.my/conta)? Use direto:

```bash
curl -fsSL https://harness.neuros.my/install.sh | bash -s -- --chave nh_…
```

```powershell
& ([scriptblock]::Create((irm https://harness.neuros.my/install.ps1))) -Chave nh_…
```

Depois de instalado, `neuro-harness conta` mostra a conta conectada, `neuro-harness entrar` conecta de novo e `neuro-harness sair` apaga a chave deste computador.

## Requisitos

| Ferramenta | Versão | macOS | Windows |
|---|---|---|---|
| Node.js | 22+ | `brew install node` | `winget install OpenJS.NodeJS.LTS` |
| git | qualquer | `xcode-select --install` | `winget install Git.Git` |
| Python | 3.10+ | `brew install python` | `winget install Python.Python.3.12` |
| FFmpeg | 5+ | `brew install ffmpeg` | `winget install Gyan.FFmpeg` |

O código é aberto, mas a instalação dos agentes usa a sua conta Neuro: rode `node lib/cli.js entrar` antes do `setup`. Para desenvolver sem conta, `NEURO_HARNESS_DEV=1` faz o `setup` clonar os repositórios públicos.

## Instalar pela CLI

```bash
git clone https://github.com/monrars1995/oneuros-harness.git
cd neuro-harness
node lib/cli.js setup
npm link                     # opcional: deixa o comando neuro-harness no PATH
```

O `setup` é idempotente: rode de novo sempre que atualizar o repositório. Ele:
1. instala o DeepSeek Harness 0.2.1-alpha.2 em `~/.neuro-harness/runtime` (com o `npm` do sistema);
2. baixa o motor neuro-mv-edit da tag fixada para `~/.neuro-harness/engine/neuro-mv-edit/<versão>` e aponta `current` para ela;
3. cria os atalhos `~/.neuro-harness/bin/neuro-mv-edit` e `neuro-mv-edit.cmd`;
4. cria o perfil `neuro` a partir do modelo Web do Harness e mantém nele o bloco gerenciado da distribuição (`# >>> neuro-harness` … `# <<< neuro-harness`);
5. copia os plugins de `plugins/` para `~/.neuro-harness/plugins/` e os instala no perfil;
6. baixa o neuro-ads-manager da tag fixada para `~/.neuro-harness/addons/`;
7. instala no perfil, fixados por versão:
   - o neuro-mv-edit e o neuro-ads-manager, como plugins;
   - os plugins oficiais Agent Teams, Auto review, busca em sessões, terminal persistente e títulos de sessão.

Com `--link`, o passo 5 liga os plugins direto do clone. Use em desenvolvimento, quando estiver mexendo neles.

## Rodar

```bash
neuro-harness start     # sobe em segundo plano e mostra a URL local (com o token de acesso)
neuro-harness open      # sobe, se precisar, e abre no navegador
neuro-harness status
neuro-harness stop
```

**Arquivos que o `start` usa:**
- **PID:** `~/.neuro-harness/harness.pid`;
- **Log:** `~/.neuro-harness/harness.log`.

**Porta:** a padrão é a 3082 (`NEURO_HARNESS_PORT`). Se ela estiver ocupada, o Harness usa uma porta livre.

**O painel fica só em `127.0.0.1`.** A URL leva um token de acesso: não a compartilhe.

### "dsh web authentication required"

Essa mensagem aparece quando você abre `http://127.0.0.1:3082/` sem o token num navegador que ainda não entrou.

**Como resolver:**
- abra uma vez o endereço completo que o `neuro-harness start` (ou o `neuro-harness url`) mostra;
- ou rode `neuro-harness open`, que já abre com o token.

**Por quanto tempo vale:** o navegador guarda um acesso assinado por **30 dias**, que continua valendo depois de reiniciar o Harness. Nesse período, o endereço sem token funciona direto.

**No app desktop** isso não acontece: ele entra sozinho.

## Ambiente das sessões

Toda sessão do Harness herda do processo:
- **PATH:** `~/.neuro-harness/bin` na frente, para o `neuro-mv-edit` ser sempre o motor fixado, e nenhuma pasta do Claude Code;
- **`npm_config_cache`:** uma pasta temporária própria. A sandbox do Harness 0.2.1 só deixa gravar na pasta de trabalho, em `/tmp` e no `TMPDIR`;
- **`NEURO_HOME`:** a biblioteca do neuro-mv-edit (perfis, temas, estilos e memória);
- **nenhuma chave de provedor:** as variáveis `ANTHROPIC_*`, `OPENAI_*` e parecidas são removidas, e as chaves vêm do cofre do Harness.

## Sandbox

As sessões de chat comuns rodam no modo `workspace-write`. Nele dá para gravar na pasta de trabalho (`~/Neuro`) e nas pastas temporárias.

**Gravar fora disso pede a sua aprovação no painel.** Isso vale, por exemplo, para salvar um perfil em `~/.neuro-mv-edit`.

**O que não pede aprovação:** os workers de vídeo do neuro-mv-superagent rodam em `danger-full-access`, como no projeto original.

**O que muda na versão 0.2.2 do Harness:** ela traz `additionalWritableRoots`. A distribuição vai liberar `~/.neuro-mv-edit` por essa opção quando subir de versão.

## Diagnóstico

```bash
neuro-harness doctor
```

Confere:
- o Node, o git, o Python e o FFmpeg;
- a versão do Harness, o motor, o perfil e os plugins;
- quantas chaves há no cofre;
- o cache npm, e se `~/.npm` tem arquivos do root (é um problema antigo do npm; a correção é `sudo chown -R "$(id -u):$(id -g)" ~/.npm`);
- se o Harness está rodando.

## Tarefas sem interface

```bash
neuro-harness run "Liste os perfis do neuro-mv-edit" --modelo kimi-coding/kimi-for-coding
```

Usa o perfil `headless` do Harness com os provedores do perfil `neuro`, no mesmo ambiente das sessões.

## Desinstalar

```bash
neuro-harness stop
rm -rf ~/.neuro-harness      # leva o Harness, o perfil, o cofre de chaves e as sessões
```

A biblioteca do neuro-mv-edit (`~/.neuro-mv-edit`) e a pasta de trabalho (`~/Neuro`) não são tocadas.
