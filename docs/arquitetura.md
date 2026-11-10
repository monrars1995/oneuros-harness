# Arquitetura

## Distribuição, não fork

O Neuro Harness **não altera o código** do DeepSeek Harness.
- **O Harness:** é instalado do npm (`@deepseek-ai/dsh`) numa versão fixa, em `~/.neuro-harness/runtime`.
- **A distribuição:** acrescenta o que é dela pelas portas de extensão do próprio Harness: perfis, patches de configuração, plugins de interface e pacotes de idioma.

**Por que não um fork:** o Harness está em *developer preview* e muda toda semana. Manter um fork do monorepo custaria mais do que o que ele traz.

```
neuro-harness (este repositório)
├── lib/harness.js          núcleo: instala, configura, sobe e para (usado pela CLI e pelo app)
├── lib/cli.js              CLI neuro-harness
├── lib/credentials.js      importação de chaves do Hermes e do OpenCode para o cofre
├── plugins/
│   ├── neuro-harness-brand marca (espaços da interface + título e ícone da aba)
│   └── neuro-harness-pt-br idioma pt-BR (addLanguage + dicionários)
├── apps/desktop            app Electron (macOS arm64, Windows x64)
└── .github/workflows       CI do app desktop
```

## Em tempo de execução

```
~/.neuro-harness/
├── runtime/                DeepSeek Harness fixado (node_modules/.bin/dsh)
├── dsh/                    DSH_HOME
│   ├── profiles/neuro/     perfil: cordis.patch.yml (com bloco gerenciado) e package.json (plugins)
│   ├── .credentials.yaml   cofre de chaves (refs)
│   └── sessions/ …         sessões e armazenamento do Harness
├── engine/neuro-mv-edit/   motor de edição, uma pasta por versão + current
├── bin/                    neuro-mv-edit e neuro-mv-edit.cmd (no PATH das sessões)
├── plugins/                cópias dos plugins instaladas pelo setup
├── harness.log             log do Harness
└── harness.pid
```

## Relação com os outros repositórios

| Repositório | Papel |
|---|---|
| [oneuros-mv-edit](https://github.com/monrars1995/oneuros-mv-edit) (neuro-mv-edit) | Motor de edição de vídeo: skill, CLI, Remotion e HyperFrames. Também é plugin do Claude Code, Hermes, OpenCode e Open Design |
| [oneuros-ads-manager](https://github.com/monrars1995/oneuros-ads-manager) (neuro-ads-manager) | Plugin de tráfego pago (Meta Ads). Instalado pelo `setup` |
| [neuro-harness-install](https://github.com/monrars1995/neuro-harness-install) | Instalador de uma linha, pacote npm `@oneuros/harness` e plugin central do Claude Code |
| neuro-clientes (privado) | Perfis de edição dos clientes da conta, entregues só a ela depois do login. Sem dados de campanha |
| neuro-harness-site (privado) | O site [harness.neuros.my](https://harness.neuros.my), na Heroku: apresentação, download, estes guias, os scripts do instalador e a API de versão (`/api/latest`) |

## Decisões

- **Perfil gerenciado:** a distribuição só escreve entre `# >>> neuro-harness` e `# <<< neuro-harness` no `cordis.patch.yml` do perfil. O resto (provedores e preferências que o painel grava) é seu.
- **Plugins copiados, não ligados:** o `setup` copia os plugins para `~/.neuro-harness/plugins`. Assim, mover o clone ou atualizar o app não quebra o perfil. O `--link` serve só para desenvolvimento.
- **Bundles de cliente escritos à mão:** os plugins de interface são um `window.__ModuleLoader__.load(...)` gerado por script, que usa o React do próprio Harness. Não há etapa de build com bundler.
- **Plugin sem bundle não é instalado:** um bundle de cliente faltando derrubaria a interface, então o `setup` pula esse plugin e avisa.
- **Sem tmux:** o Harness sobe como processo próprio, com PID e log, igual no macOS, no Linux e no Windows.
