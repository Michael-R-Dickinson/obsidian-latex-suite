import { beforeAll, describe, expect, it } from "vitest";
import { ContextId, evalInObsidian, registerLibResolver } from "obsidian-integration-testing";
import { getTemporaryVault } from "obsidian-integration-testing/vitest-global-setup-plugin";
import { type TFile } from "obsidian";

interface FileContext {
	file: TFile;
	snippets: TFile;
}

const snippets = `[
	{trigger: "(", replacement: "(\${VISUAL})", options: "mv"},
	{trigger: ")", replacement: "$0(\${VISUAL})", options: "mv"},
]`;

describe("vim visual snippet keys", () => {
	getTemporaryVault();
	const contextId = new ContextId<FileContext>();
	registerLibResolver(() => window.__latex_suite_test_library);
	beforeAll(async () => {
		await evalInObsidian({
			contextId,
			input: { snippets },
			callback: async ({ app, context, snippets, lib: { createNote, plugin }, obsidianModule }) => {
				// @ts-expect-error internal api
				app.vault.setConfig("vimMode", true);
				context.snippets = app.vault.getFileByPath("vim-snippets.js")
					?? await createNote({ content: snippets, path: "vim-snippets.js" });
				context.file = app.vault.getFileByPath("vim.md")
					?? await createNote({ content: "", path: "vim.md" });
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(context.file);
				plugin.setLib();
				if (window.__latex_suite_test_library.view?.state.field(obsidianModule.editorLivePreviewField)) {
					app.commands.executeCommandById("editor:toggle-source");
				}
				plugin.settings.snippetsFileLocation = context.snippets.path;
				plugin.settings.loadSnippetsFromFile = true;
				plugin.settings.mathPreviewEnabled = false;
				plugin.settings.concealEnabled = false;
				plugin.settings.vimEnabled = true;
				plugin.settings.vimVisualSnippetKeys = "()";
				await plugin.saveSettings(false, true);
				// vim commands are registered on load
				plugin.addEditorCommands();
			},
		});
	});

	/** puts the cursor at `pos` in normal mode, selects `len` chars with `v`, then presses `key` */
	async function run(text: string, pos: number, len: number, key: string) {
		return evalInObsidian({
			input: { text, pos, len, key },
			callback: async ({ text, pos, len, key, lib: { view, pressKey } }) => {
				const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
				view.focus();
				pressKey({ key: "Escape" });
				await tick();
				view.setDoc(text, pos);
				await tick();
				pressKey({ key: "v" });
				for (let i = 1; i < len; i++) pressKey({ key: "l" });
				await tick();
				const selected = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
				pressKey({ key });
				await tick();
				// @ts-expect-error cm is the vim adapter
				const vim = view.cm?.state?.vim;
				const sel = view.state.selection.main;
				return {
					selected,
					doc: view.state.doc.toString(),
					from: sel.from,
					to: sel.to,
					mode: vim?.insertMode ? "insert" : vim?.visualMode ? "visual" : "normal",
				};
			},
		});
	}

	it("wraps the selection directly from visual mode", async () => {
		const result = await run("$abc$", 1, 3, "(");
		expect(result.selected).toBe("abc");
		expect(result.doc).toBe("$(abc)$");
		// no tabstops: the whole replacement stays selected in select mode
		expect(result).toMatchObject({ from: 1, to: 6, mode: "insert" });
	}, 20_000);

	it("puts the cursor at $0", async () => {
		const result = await run("$abc$", 1, 3, ")");
		expect(result.doc).toBe("$(abc)$");
		expect(result).toMatchObject({ from: 1, to: 1, mode: "insert" });
	}, 20_000);

	it("keeps the visual selection when no snippet expands (outside math)", async () => {
		const result = await run("abc", 0, 3, "(");
		expect(result.doc).toBe("abc");
		expect(result.mode).toBe("visual");
	}, 20_000);
});
