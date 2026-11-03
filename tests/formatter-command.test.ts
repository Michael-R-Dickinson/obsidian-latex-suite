import { beforeAll, describe, expect, it } from "vitest";
import { ContextId, evalInObsidian, registerLibResolver } from "obsidian-integration-testing";
import { getTemporaryVault } from "obsidian-integration-testing/vitest-global-setup-plugin";
import { type TFile } from "obsidian";

interface FileContext {
	file: TFile;
}

const doc = String.raw`$$
\begin{align} a &= b \\ &= c \\ d &= e \end{align}
$$`;

describe("format file command", () => {
	getTemporaryVault();
	const contextId = new ContextId<FileContext>();
	registerLibResolver(() => window.__latex_suite_test_library);
	beforeAll(async () => {
		await evalInObsidian({
			contextId,
			callback: async ({ app, context, lib: { createNote, plugin } }) => {
				context.file = app.vault.getFileByPath("format.md")
					?? await createNote({ content: "", path: "format.md" });
				await app.workspace.getLeaf(false).openFile(context.file);
				plugin.setLib();
				plugin.settings.formatterEnabled = true;
				await plugin.saveSettings(false, true);
			},
		});
	});

	async function format(lineBreakPosition: "start" | "end") {
		return evalInObsidian({
			input: { doc, lineBreakPosition },
			callback: async ({ app, doc, lineBreakPosition, lib: { view, plugin } }) => {
				plugin.settings.formatterLineBreakPosition = lineBreakPosition;
				await plugin.saveSettings(false, true);
				view.setDoc(doc, 0);
				app.commands.executeCommandById("obsidian-latex-suite:latex-suite-format-file");
				await new Promise((resolve) => setTimeout(resolve, 20));
				return view.state.doc.toString();
			},
		});
	}

	it("start: \\\\ opens the next line and carries its &=", async () => {
		expect(await format("start")).toBe(String.raw`$$
\begin{align}
  a &= b
  \\ &= c
  \\
  d &= e
\end{align}
$$`);
	});

	it("end: \\\\ ends the row", async () => {
		expect(await format("end")).toBe(String.raw`$$
\begin{align}
  a &= b \\
    &= c \\
  d &= e
\end{align}
$$`);
	});
});
