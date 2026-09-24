import { describe, expect, it, vi } from "vitest";

// settings.ts pulls in the snippet engine (CodeMirror) and esbuild `inline:` imports.
// getFormatterOptions needs none of that, so stub those modules out.
vi.mock("../../src/snippets/snippets", () => ({ Snippet: class {} }));
vi.mock("src/utils/default_snippets", () => ({ DEFAULT_SNIPPETS: "[]" }));
vi.mock("src/utils/default_snippet_variables", () => ({ DEFAULT_SNIPPET_VARIABLES: "{}" }));

const { DEFAULT_SETTINGS, getFormatterOptions } = await import("../../src/settings/settings");
const { DEFAULT_FORMATTER_OPTIONS } = await import("../../src/features/latex_formatter");

describe("getFormatterOptions", () => {
	it("default settings map to DEFAULT_FORMATTER_OPTIONS", () => {
		expect(getFormatterOptions(DEFAULT_SETTINGS)).toEqual(DEFAULT_FORMATTER_OPTIONS);
	});

	it("maps every formatter setting", () => {
		expect(
			getFormatterOptions({
				...DEFAULT_SETTINGS,
				formatterLineWidth: 80,
				formatterTermWidth: 10,
				formatterIndentWithTabs: false,
				formatterIndentSize: 4,
				formatterScriptBraces: "always",
				formatterBreakAtRelations: "always",
				formatterRowSeparator: "comment",
				formatterAnnotationOwnLine: false,
			}),
		).toEqual({
			width: 80,
			termWidth: 10,
			indent: "    ",
			scriptBraces: "always",
			breakAtRelations: "always",
			rowSeparator: "comment",
			annotationOwnLine: false,
		});
	});

	it("indentWithTabs wins over indentSize", () => {
		expect(getFormatterOptions({ ...DEFAULT_SETTINGS, formatterIndentWithTabs: true, formatterIndentSize: 4 }).indent).toBe("\t");
	});

	it("negative indent size becomes no indent", () => {
		expect(getFormatterOptions({ ...DEFAULT_SETTINGS, formatterIndentSize: -2 }).indent).toBe("");
	});
});
