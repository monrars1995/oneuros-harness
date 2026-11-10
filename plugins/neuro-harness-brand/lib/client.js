/*
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
		const ARCH = "M9 21.6V16a7 7 0 0 1 14 0v9";
		const NODE = [9, 24.4, 3.1];
		const BOX = [4.95, 6.75, 21];
		const STROKE = 4;
		const FAVICON = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\"><style>.t{fill:#F6F7FB}.i{stroke:#15171F}.n{fill:#5A46F0}@media (prefers-color-scheme: dark){.t{fill:#121319}.i{stroke:#ECEEF6}.n{fill:#8F7DFF}}</style><rect class=\"t\" width=\"32\" height=\"32\" rx=\"7.2\"/><g transform=\"translate(16 16) scale(0.74) translate(-15.45 -17.25)\"><path class=\"i\" d=\"M9 21.6V16a7 7 0 0 1 14 0v9\" fill=\"none\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><circle class=\"n\" cx=\"9\" cy=\"24.4\" r=\"3.1\"/></g></svg>";
		const CSS = ":root{--nh-node:light-dark(#5A46F0,#8F7DFF);--nh-muted:light-dark(#6B7186,#9AA0B4)}.nh-name{display:inline-flex;align-items:baseline;gap:.32em;font-size:15px;letter-spacing:-.02em;white-space:nowrap;color:currentColor;line-height:1}.nh-name b{font-weight:700}.nh-name span{font-weight:400;color:var(--nh-muted)}";

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
