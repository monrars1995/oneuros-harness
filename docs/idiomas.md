# Idiomas e traduções

O plugin `plugins/neuro-harness-pt-br` usa o sistema de pacotes de idioma do DeepSeek Harness:
- `addLanguage({ id: "pt-BR", label: "Português (Brasil)", fallback: "en" })`;
- um dicionário por área da interface (55 áreas, 2.489 textos).

**pt-BR como padrão:**
- **Sem escolha salva:** o plugin escolhe pt-BR, e essa escolha fica salva.
- **Com uma escolha sua:** um idioma que você escolher depois em Configurações → Geral → Idioma é respeitado.

## Arquivos

| Arquivo | O que é |
|---|---|
| `i18n/en.json` | Retrato dos textos em inglês da versão fixada do Harness, por área |
| `i18n/pt-BR.json` | As traduções, com as mesmas áreas e chaves |
| `lib/client.js` | O bundle do navegador, **gerado**: não edite à mão |
| `scripts/extract-ui-strings.cjs` | Extrai os textos de todos os pacotes de interface do Harness instalado |
| `scripts/build-locale.py` | Confere (`--check`) e gera o `lib/client.js` |

## Atualizar depois de subir o Harness

```bash
# 1. extrair os textos da versão nova (precisa de uma pasta com react 18 instalado, ex.: o neuro-mv-superagent)
REACT_FROM=~/Code/neuro-mv-superagent node plugins/neuro-harness-pt-br/scripts/extract-ui-strings.cjs \
  ~/.neuro-harness/runtime/node_modules/@deepseek-ai /tmp/dicts.json
# 2. atualizar i18n/en.json com o "en" de cada área e traduzir o que for novo em i18n/pt-BR.json
# 3. conferir e gerar
npm run locale:check
npm run locale
```

## Regras de tradução

- **Variáveis:** cada `{variável}` fica igual, com o mesmo nome e a mesma quantidade. O `--check` confere.
- **Nome do app:** "DeepSeek Harness" vira **Neuro Harness**. "DeepSeek" como provedor, modelo ou conta fica.
- **Termos fixos:** sessão, espaço de trabalho, agente, subagente, predefinição, skill, plugin, ferramenta, modelo, provedor, aprovação, sandbox.
- **Formatos brasileiros:** datas em dia/mês/ano e milhar com ponto.
