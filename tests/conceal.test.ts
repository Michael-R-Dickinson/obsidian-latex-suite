import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ContextId, evalInObsidian, registerLibResolver } from "obsidian-integration-testing";
// import "obsidian-integration-testing/vitest/typings";
import { getTemporaryVault } from "obsidian-integration-testing/vitest-global-setup-plugin";
import TestPlugin  from "./main";
import { TFile } from "obsidian";

interface FileContext {
	file: TFile
}

describe("conceal", async () => {
	const vault = getTemporaryVault();
	const contextId = new ContextId<FileContext>()
	registerLibResolver(() => window.__latex_suite_test_library)
	await evalInObsidian({
	    contextId,
	    callback: async ({ app, context, obsidianModule, lib }) => {
			context.file =
				app.vault.getFileByPath("test.md") ??
				await app.vault.create("test.md", "");
			const leaf = app.workspace.getLeaf(false)
			await leaf.openFile(context.file)
			if (window.__latex_suite_test_library.view?.state.field(obsidianModule.editorLivePreviewField)) {
				app.commands.executeCommandById("editor:toggle-source");
			}
			lib.plugin.settings.concealEnabled = true;	
			lib.plugin.saveSettings();
	    }
	});
	beforeEach(() => {
		registerLibResolver(() => window.__latex_suite_test_library)
	})
	it("Simple einstein equation", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: ({app, pluginId, obsidianModule, lib }) => {
				const plugin = lib.plugin
				const view = lib.view
				const conceal = plugin.test.conceal
				// set content to "Einstein's equation is $E=mc^2$."
				const basic_display =
`
$$
E = mc^2
$$
`
				const callout_display =
`
> [!note] info callout
> $$
> E = mc^{2}
> $$
`
				view.dispatch({
					changes: {from: 0, to: view.state.doc.length, insert: basic_display}
				})
				const basic_output = conceal(view, {})
				view.dispatch({
					changes: {from: 0, to: view.state.doc.length, insert: callout_display}
				})
				const callout_output = conceal(view, {})
				return [basic_output, callout_output]
			}
		})
		expect(result[0].cached_equations).toStrictEqual({
			"E = mc^2": [
				[{"start": 6, "end": 8, "text": "2", "class": "cm-number", "elementType": "sup"}]
			]
		})
		expect(result[1].cached_equations).toStrictEqual({
			"E = mc^{2}": [
				[{"start": 6, "end": 10, "text": "2", "class": "cm-number", "elementType": "sup"}]
			]
		})
	})
	
	it("multiline equation", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: ({app, pluginId, obsidianModule, lib }) => {
				const plugin = lib.plugin
				const view = lib.view
				const conceal = plugin.test.conceal
				const equation = 
`
$$
X_{1}
X_{2}
$$
`
				view.setDoc(equation)
				const equation_result = conceal(view, {}).cached_equations
				return [equation_result]
			}
		})
		result.forEach((equation_result) => {
			expect(equation_result).toStrictEqual({
				"X_{1}": [
					[{"start": 1, "end": 5, "text": "1", "class": "cm-number", "elementType": "sub"}]
				],
				"X_{2}": [
					[{"start": 1, "end": 5, "text": "2", "class": "cm-number", "elementType": "sub"}]
				]
			});
		})
	})
	
	it("malformed multiline equation", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: ({app, pluginId, obsidianModule, lib }) => {
				const plugin = lib.plugin
				const view = lib.view
				const conceal = plugin.test.conceal
				const start_end_equation = 
`
$$X_1
X_2
X_3$$
`
				view.setDoc(start_end_equation)
				const equation_result = conceal(view, {}).cached_equations
				return equation_result
			}
		})
		expect(result).toStrictEqual({
			"X_1": [
				[{"start": 1, "end": 3, "text": "1", "class": "cm-number", "elementType": "sub"}]
			],
			"X_2": [
				[{"start": 1, "end": 3, "text": "2", "class": "cm-number", "elementType": "sub"}]
			],
			"X_3": [
				[{"start": 1, "end": 3, "text": "3", "class": "cm-number", "elementType": "sub"}]
			]
		})
	})

	it("line reveal mode reveals concealments touching the cursor's line", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: ({ lib: {plugin, view} }) => {
				const { determineLineCursorPosType } = plugin.test
				// Lines: "" | "$$" | "a^{2}" (4-9) | "b^{2}" (10-15) | "$$"
				view.setDoc("\n$$\na^{2}\nb^{2}\n$$\n", 5)
				const specs = [
					[{ start: 5, end: 9, text: "2" }],   // on the cursor's line
					[{ start: 11, end: 15, text: "2" }], // on the next line
					[{ start: 5, end: 15, text: "x" }],  // spans both lines
				]
				return specs.map(spec => determineLineCursorPosType(view.state, spec))
			}
		})
		expect(result).toStrictEqual(["within", "apart", "within"])
	})

	it("overline hides its syntax and marks content with a css overline", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: ({ lib: {plugin, view} }) => {
				const conceal = plugin.test.conceal
				view.setDoc("\n$$\n\\overline{AB}\n\\overline{x}\n\\overline{z_1}\n$$\n")
				return conceal(view, {}).cached_equations
			}
		})
		const overline = (from: number, to: number) => [
			{ start: 0, end: from, text: "" },
			{ start: from, end: to, text: "", class: "cm-concealed-overline", mark: true },
			{ start: to, end: to + 1, text: "" },
		]
		expect(result).toStrictEqual({
			"\\overline{AB}": [overline(10, 12)],
			// single letters keep the combining macron
			"\\overline{x}": [
				[{ start: 0, end: 12, text: "x\u0304", class: "latex-suite-unicode" }]
			],
			// nested LaTeX is still concealed inside the overline
			"\\overline{z_1}": [
				overline(10, 13),
				[{ start: 11, end: 13, text: "1", class: "cm-number", elementType: "sub" }]
			],
		})
	})

	it("overline renders as one flat line around nested concealments", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: async ({ app, obsidianModule, lib: {view} }) => {
				// Source mode, so live preview doesn't render the block with MathJax
				if (view.state.field(obsidianModule.editorLivePreviewField)) {
					app.commands.executeCommandById("editor:toggle-source");
				}
				// cursor on the "x" line, away from the overlines
				const doc = "$$\n\\overline{z_1}\n\\overline{\\alpha z}\n\\overline{a^2+b^2} + \\overline{cx+d}\n\\overline{\\overline{ab}c}\nz_1\nx\n$$\n"
				view.setDoc(doc, doc.indexOf("x\n"))
				await new Promise(r => setTimeout(r, 200))
				const lineEl = (n: number) => {
					const node = view.domAtPos(view.state.doc.line(n).from).node as Node
					return (node instanceof HTMLElement ? node : node.parentElement)!.closest(".cm-line") as HTMLElement
				}
				// Reference lines without overline (a subscript alone already grows the line)
				const height = (n: number) => lineEl(n).getBoundingClientRect().height
				const plainHeight = (n: number) => n === 2 ? height(6) : height(7)
				return [2, 3, 4, 5].map(n => {
					const line = lineEl(n)
					const marked = [...line.querySelectorAll<HTMLElement>(".cm-concealed-overline")]
					const outer = marked.filter(m => !m.parentElement?.closest(".cm-concealed-overline"))
					return {
						// one element per overline, wrapping highlight spans and widgets
						texts: outer.map(m => m.textContent),
						hasSub: outer.some(m => !!m.querySelector("sub")),
						hasSup: outer.some(m => !!m.querySelector("sup")),
						raw: line.textContent?.includes("overline") ?? true,
						// flat, single-colored line at one height
						tops: new Set(outer.map(m => m.getBoundingClientRect().top)).size,
						colors: [...new Set(marked.map(m => getComputedStyle(m).borderTopColor))].length,
						textDecoration: marked.some(m => getComputedStyle(m).textDecorationLine.includes("overline")),
						// nested overline sits above its parent's content
						nestedAbove: marked.length > outer.length
							? outer[0].getBoundingClientRect().top < marked.find(m => !outer.includes(m))!.getBoundingClientRect().top
							: null,
						// doesn't change the line layout
						sameHeight: height(n) === plainHeight(n),
					}
				})
			}
		})
		const line = { hasSub: false, hasSup: false, raw: false, tops: 1, colors: 1, textDecoration: false, nestedAbove: null, sameHeight: true }
		expect(result).toStrictEqual([
			{ ...line, texts: ["z1"], hasSub: true },
			{ ...line, texts: ["α z"] },
			{ ...line, texts: ["a2+b2", "cx+d"], hasSup: true },
			{ ...line, texts: ["abc"], nestedAbove: true },
		])
	})

	it("collapses \\left and \\right to plain brackets", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: ({ lib: {plugin, view} }) => {
				view.setDoc("\n$$\n\\left( x \\right]\n\\left\\{ y \\right\\|\n$$\n")
				const { cached_equations } = plugin.test.conceal(view, {})
				return Object.fromEntries(Object.entries(cached_equations)
					.map(([eq, specs]) => [eq, specs.flat().map(r => r.text)]))
			}
		})
		expect(result).toStrictEqual({
			"\\left( x \\right]": ["(", "]"],
			"\\left\\{ y \\right\\|": ["{", "‖"],
		})
	})

	it("should conceal subscript after parenthesis", async () => {
		const result = await evalInObsidian({
			input: {pluginId: "obsidian-latex-suite" },
			callback: ({app, pluginId, obsidianModule, lib: {plugin, view} }) => {
				const conceal = plugin.test.conceal
				const equation = 
`
$$
(x)^{2}
$$
`
				view.setDoc(equation)
				const equation_result = conceal(view, {}).cached_equations
				return equation_result
			}
		})
		expect(result).toMatchInlineSnapshot(`
{
  "(x)^{2}": [
    [
      {
        "class": "cm-number",
        "elementType": "sup",
        "end": 7,
        "start": 3,
        "text": "2",
      },
    ],
  ],
}
`)
	})
})
