#!/usr/bin/env python3
"""Gera lib/client.js do neuro-harness-pt-br a partir de i18n/pt-BR.json.

  python3 scripts/build-locale.py              # gera o bundle
  python3 scripts/build-locale.py --check      # confere chaves e {variáveis} contra i18n/en.json

i18n/en.json é o retrato dos textos em inglês da versão do Harness fixada (extraído com scripts/extract-ui-strings.cjs).
Ao atualizar o Harness, extraia de novo, traduza o que for novo e rode este script.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN = json.loads((ROOT / "i18n" / "en.json").read_text())
PT = json.loads((ROOT / "i18n" / "pt-BR.json").read_text())
PH = re.compile(r"\{[^{}]*\}")


def check() -> int:
    problems = []
    for ns, entries in EN.items():
        tr = PT.get(ns)
        if tr is None:
            problems.append(f"{ns}: área sem tradução")
            continue
        for key, en in entries.items():
            if key not in tr:
                problems.append(f"{ns}.{key}: sem tradução")
            elif sorted(PH.findall(en)) != sorted(PH.findall(tr[key])):
                problems.append(f"{ns}.{key}: variáveis diferentes ({PH.findall(en)} → {PH.findall(tr[key])})")
    for ns in PT:
        if ns not in EN:
            problems.append(f"{ns}: área que não existe mais no Harness")
    total = sum(len(v) for v in EN.values())
    done = sum(1 for ns, v in EN.items() for k in v if k in PT.get(ns, {}))
    print(f"pt-BR: {done}/{total} textos traduzidos em {len(PT)} áreas")
    for p in problems[:40]:
        print("  ✗", p)
    return 1 if problems else 0


if "--check" in sys.argv:
    sys.exit(check())

CLIENT = r'''/*
 * neuro-harness-pt-br — metade do navegador. GERADO por scripts/build-locale.py; não edite à mão.
 * Registra o Português do Brasil no sistema de idiomas do Harness (addLanguage + um dicionário por área)
 * e o torna o idioma padrão: se não há escolha salva, seleciona pt-BR (que passa a ficar salvo).
 * Uma escolha feita depois, em Configurações → Geral → Idioma, é respeitada.
 */
window.__ModuleLoader__.load({
	id: "neuro-harness-pt-br",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const ID = "pt-BR";
		const DICTS = __DICTS__;

		/** pt-BR vira padrão só quando o usuário ainda não escolheu um idioma. */
		function defaultToPtBr(locale) {
			let done = false;
			const decide = () => {
				if (done) return;
				done = true;
				if (locale.preference === undefined) {
					try { locale.setLocale(ID); } catch (e) { console.warn("neuro-harness-pt-br:", e); }
				}
			};
			const hostReady = () => {
				const host = locale.host;
				if (!host || typeof host.getSnapshot !== "function") return true;
				return host.getSnapshot().value !== undefined;
			};
			const unsubscribe = typeof locale.subscribe === "function" ? locale.subscribe(() => { if (hostReady()) decide(); }) : () => {};
			if (hostReady()) decide();
			const timer = setTimeout(decide, 2500);
			return () => { unsubscribe(); clearTimeout(timer); };
		}

		const inject = ["locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.addLanguage({ id: ID, label: "Português (Brasil)", fallback: "en" }), "neuro-harness-pt-br: idioma");
			for (const [ns, dict] of Object.entries(DICTS)) {
				ctx.effect(() => ctx.locale.register(ns, ID, dict), "neuro-harness-pt-br: " + ns);
			}
			ctx.effect(() => defaultToPtBr(ctx.locale), "neuro-harness-pt-br: idioma padrão");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
'''
(ROOT / "lib" / "client.js").write_text(CLIENT.replace("__DICTS__", json.dumps(PT, ensure_ascii=False, sort_keys=True)))
print(f"lib/client.js gerado com {sum(len(v) for v in PT.values())} textos em {len(PT)} áreas")
