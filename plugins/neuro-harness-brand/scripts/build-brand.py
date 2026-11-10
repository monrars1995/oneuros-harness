#!/usr/bin/env python3
"""Gera a identidade do Neuro Harness: lib/client.js (plugin de interface) e assets/ (SVG do isotipo,
lockup, favicon e ícone de app). Rode de novo depois de mexer na geometria ou nas cores.

  python3 scripts/build-brand.py

Isotipo "n-neurônio": o n minúsculo desenhado por um traço único que nasce de um nó — o corpo do
neurônio no pé esquerdo, de onde o axônio sobe e faz o arco da letra. Uma cor (a do texto) e um acento (o nó).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

# ---------------------------------------------------------------- geometria (grade 32x32)
ARCH = "M9 21.6V16a7 7 0 0 1 14 0v9"   # axônio: sobe do nó, faz o arco e desce
STROKE = 4
NODE = (9, 24.4, 3.1)                    # corpo do neurônio (cx, cy, r)
BOX = (4.95, 6.75, 21)                   # recorte quadrado centrado no desenho (x, y, lado)
CENTER = (BOX[0] + BOX[2] / 2, BOX[1] + BOX[2] / 2)

# ---------------------------------------------------------------- cores
COLORS = {
    "dark": {"ink": "#ECEEF6", "node": "#8F7DFF", "muted": "#9AA0B4", "tile": "#121319"},
    "light": {"ink": "#15171F", "node": "#5A46F0", "muted": "#6B7186", "tile": "#F6F7FB"},
}


def glyph(ink, node, transform=""):
    cx, cy, r = NODE
    t = f' transform="{transform}"' if transform else ""
    return (f'<g{t}><path d="{ARCH}" fill="none" stroke="{ink}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{node}"/></g>')


def mark_svg(mode):
    c = COLORS[mode]
    x, y, s = BOX
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {s} {s}">{glyph(c["ink"], c["node"])}</svg>'


def tile_svg(mode, scale=0.74, rx=7.2):
    c = COLORS[mode]
    tr = f"translate(16 16) scale({scale}) translate({-CENTER[0]:.2f} {-CENTER[1]:.2f})"
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="{rx}" fill="{c["tile"]}"/>{glyph(c["ink"], c["node"], tr)}</svg>'


def favicon_svg():
    d, l = COLORS["dark"], COLORS["light"]
    tr = f"translate(16 16) scale(0.74) translate({-CENTER[0]:.2f} {-CENTER[1]:.2f})"
    style = (f"<style>.t{{fill:{l['tile']}}}.i{{stroke:{l['ink']}}}.n{{fill:{l['node']}}}"
             f"@media (prefers-color-scheme: dark){{.t{{fill:{d['tile']}}}.i{{stroke:{d['ink']}}}.n{{fill:{d['node']}}}}}</style>")
    cx, cy, r = NODE
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">{style}<rect class="t" width="32" height="32" rx="7.2"/>'
            f'<g transform="{tr}"><path class="i" d="{ARCH}" fill="none" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<circle class="n" cx="{cx}" cy="{cy}" r="{r}"/></g></svg>')


def lockup_svg(mode):
    c = COLORS[mode]
    x, y, s = BOX
    text = (f'<text x="{x + s + 4}" y="{CENTER[1] + 5.6:.2f}" font-family="Inter, -apple-system, Segoe UI, Helvetica, Arial" font-size="17" letter-spacing="-0.4">'
            f'<tspan font-weight="700" fill="{c["ink"]}">neuro</tspan><tspan font-weight="400" fill="{c["muted"]}" dx="4">harness</tspan></text>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} 158 {s}">{glyph(c["ink"], c["node"])}{text}</svg>'


for mode in COLORS:
    (ASSETS / f"neuro-harness-mark-{mode}.svg").write_text(mark_svg(mode))
    (ASSETS / f"neuro-harness-lockup-{mode}.svg").write_text(lockup_svg(mode))
    (ASSETS / f"neuro-harness-icon-{mode}.svg").write_text(tile_svg(mode))
(ASSETS / "neuro-harness-favicon.svg").write_text(favicon_svg())

d, l = COLORS["dark"], COLORS["light"]
CSS = (f":root{{--nh-node:light-dark({l['node']},{d['node']});--nh-muted:light-dark({l['muted']},{d['muted']})}}"
       ".nh-name{display:inline-flex;align-items:baseline;gap:.32em;font-size:15px;letter-spacing:-.02em;white-space:nowrap;color:currentColor;line-height:1}"
       ".nh-name b{font-weight:700}.nh-name span{font-weight:400;color:var(--nh-muted)}")

CLIENT = r'''/*
 * neuro-harness-brand — metade do navegador. GERADO por scripts/build-brand.py; não edite à mão.
 * Isotipo "n-neurônio": o n desenhado por um traço único que nasce do corpo de um neurônio.
 * O traço usa a cor do texto da interface (currentColor) e o nó é o único acento, então isotipo
 * e nome ficam unificados nos temas claro e escuro. Ocupa sidebar.brand.mark, sidebar.brand.name e
 * conversation.hero.brand.mark; troca "DeepSeek Harness" por "Neuro Harness" no título e no ícone da aba.
 * Construído sobre o DeepSeek Harness (MIT, © DeepSeek); não usa material de marca da DeepSeek.
 */
window.__ModuleLoader__.load({
	id: "neuro-harness-brand",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const { jsx, jsxs } = require("react/jsx-runtime");

		const PRODUCT = "Neuro Harness";
		const UPSTREAM = "DeepSeek Harness";
		const ARCH = __ARCH__;
		const NODE = __NODE__;
		const BOX = __BOX__;
		const STROKE = __STROKE__;
		const FAVICON = __FAVICON__;
		const CSS = __CSS__;

		/** O isotipo: traço na cor do texto, nó no acento. */
		function Mark({ size }) {
			return jsxs("svg", {
				width: size, height: size, viewBox: BOX.join(" "), role: "img", "aria-label": PRODUCT,
				style: { display: "block", flex: "none" },
				children: [
					jsx("path", { d: ARCH, fill: "none", stroke: "currentColor", strokeWidth: STROKE, strokeLinecap: "round", strokeLinejoin: "round" }),
					jsx("circle", { cx: NODE[0], cy: NODE[1], r: NODE[2], style: { fill: "var(--nh-node)" } })
				]
			});
		}

		function NeuroBrandMark({ size }) {
			return jsx(Mark, { size: size || 24 });
		}

		function NeuroBrandName() {
			return jsxs("span", { className: "nh-name", "aria-label": PRODUCT, children: [jsx("b", { children: "neuro" }), jsx("span", { children: "harness" })] });
		}

		function NeuroHeroMark({ size, className }) {
			return jsx("span", { className, style: { display: "inline-flex", color: "inherit" }, children: jsx(Mark, { size: size || 34 }) });
		}

		function brandStyles() {
			const el = document.createElement("style");
			el.dataset.neuroHarnessBrand = "";
			el.textContent = CSS;
			document.head.appendChild(el);
			return () => el.remove();
		}

		function brandTitle() {
			const fix = () => {
				if (document.title.includes(UPSTREAM)) document.title = document.title.split(UPSTREAM).join(PRODUCT);
			};
			fix();
			const observer = new MutationObserver(fix);
			observer.observe(document.head, { subtree: true, childList: true, characterData: true });
			return () => observer.disconnect();
		}

		function brandFavicon() {
			const href = "data:image/svg+xml," + encodeURIComponent(FAVICON);
			const previous = [...document.querySelectorAll('link[rel~="icon"]')].map((el) => [el, el.getAttribute("href")]);
			let link = document.querySelector('link[rel~="icon"]');
			const created = !link;
			if (!link) {
				link = document.createElement("link");
				link.rel = "icon";
				document.head.appendChild(link);
			}
			for (const [el] of previous) el.setAttribute("href", href);
			link.type = "image/svg+xml";
			link.setAttribute("href", href);
			return () => {
				if (created) link.remove();
				for (const [el, old] of previous) old === null ? el.removeAttribute("href") : el.setAttribute("href", old);
			};
		}

		const inject = ["slots"];
		function apply(ctx) {
			ctx.effect(() => brandStyles(), "neuro-harness-brand: estilos");
			ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", function* () {
				yield ctx.slots.register({ name: "sidebar.brand.mark" }, NeuroBrandMark);
				yield ctx.slots.register({ name: "sidebar.brand.name" }, NeuroBrandName);
			}));
			ctx.slots.inject("conversation.hero.brand.mark", () => ctx.slots.register({ name: "conversation.hero.brand.mark" }, NeuroHeroMark));
			ctx.effect(() => brandTitle(), "neuro-harness-brand: título da aba");
			ctx.effect(() => brandFavicon(), "neuro-harness-brand: ícone da aba");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
'''
for k, v in {"__ARCH__": json.dumps(ARCH), "__NODE__": json.dumps(list(NODE)), "__BOX__": json.dumps(list(BOX)),
             "__STROKE__": json.dumps(STROKE), "__FAVICON__": json.dumps(favicon_svg()), "__CSS__": json.dumps(CSS)}.items():
    CLIENT = CLIENT.replace(k, v)
(ROOT / "lib" / "client.js").write_text(CLIENT)
print("ok:", sorted(p.name for p in ASSETS.iterdir()))
