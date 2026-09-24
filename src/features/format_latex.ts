import { MarkdownView, type Command } from "obsidian";
import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { isolateHistory } from "@codemirror/commands";
import { findDisplayMathBlocks, tryFormatMath, type DisplayMathBlock, type FormatterOptions } from "./latex_formatter";
import { getFormatterOptions } from "src/settings/settings";
import type LatexSuitePlugin from "src/main";


// Formatting only changes whitespace and script braces (z_{0} -> z_0)
const isIgnorable = (c: string) => /[\s{}]/.test(c);

/**
 * Map an offset in `oldText` to `newText` by counting the characters before it
 * that formatting doesn't touch. Keeps the cursor next to the same token.
 */
function mapOffsetIgnoringFormatting(oldText: string, newText: string, offset: number): number {
	let count = 0;
	for (let i = 0; i < offset; i++) {
		if (!isIgnorable(oldText[i])) count++;
	}
	let i = 0;
	while (i < newText.length && count > 0) {
		if (!isIgnorable(newText[i])) count--;
		i++;
	}
	// cursor was after a space ("= |b"): keep it after the space
	if (offset > 0 && /\s/.test(oldText[offset - 1])) {
		while (i < newText.length && newText[i] === " ") i++;
	}
	return i;
}

// Only replace the part of the block that actually differs
function minimalChange(oldText: string, newText: string, offset: number) {
	let start = 0;
	while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) start++;
	let end = 0;
	while (
		end < oldText.length - start &&
		end < newText.length - start &&
		oldText[oldText.length - 1 - end] === newText[newText.length - 1 - end]
	) end++;
	return {
		from: offset + start,
		to: offset + oldText.length - end,
		insert: newText.slice(start, newText.length - end),
	};
}

/**
 * Format the `$$` display blocks of an editor in a single undoable transaction.
 * If `pos` is given, only the block containing it is formatted.
 */
export function formatLatexInView(view: EditorView, opts: FormatterOptions, pos?: number) {
	let blocks = findDisplayMathBlocks(view.state.doc.toString());
	if (pos !== undefined) blocks = blocks.filter((b) => b.from <= pos && pos <= b.to);

	let skipped = 0;
	const edits: { block: DisplayMathBlock; formatted: string }[] = [];
	for (const block of blocks) {
		const formatted = tryFormatMath(block.body, opts);
		if (formatted === null) skipped++;
		else if (formatted !== block.body) edits.push({ block, formatted });
	}
	const result = { found: blocks.length, changed: edits.length, skipped };
	if (!edits.length) return result;

	const changes = view.state.changes(
		edits.map(({ block, formatted }) => minimalChange(block.body, formatted, block.bodyFrom)),
	);
	// Cursors inside a reformatted block stay next to the same token, others are mapped normally
	const mapPos = (p: number) => {
		const edit = edits.find(({ block }) => block.bodyFrom <= p && p <= block.bodyTo);
		if (!edit) return changes.mapPos(p);
		const { block, formatted } = edit;
		return changes.mapPos(block.bodyFrom, -1) + mapOffsetIgnoringFormatting(block.body, formatted, p - block.bodyFrom);
	};
	const selection = view.state.selection;

	view.dispatch({
		changes,
		selection: EditorSelection.create(
			selection.ranges.map((r) => EditorSelection.range(mapPos(r.anchor), mapPos(r.head))),
			selection.mainIndex,
		),
		annotations: isolateHistory.of("full"),
	});
	return result;
}

/** Whether `pos` is inside (or on the delimiters of) a `$$` display block. */
export function isInDisplayMathBlock(view: EditorView, pos: number) {
	return findDisplayMathBlocks(view.state.doc.toString()).some((b) => b.from <= pos && pos <= b.to);
}

/**
 * Format on save.
 *
 * Obsidian has no "on save" event. Listening to vault "modify" is not an option:
 * it also fires for Obsidian's continuous background autosaves (we'd reformat
 * while the user is typing), for external/sync changes, and for our own writes
 * (needs re-entrancy guards to not loop). Instead, like obsidian-linter's
 * "lint on save", we wrap the callback of Obsidian's own "editor:save-file"
 * command, i.e. an explicit Ctrl/Cmd+S. We format the active markdown editor
 * before the original save runs, so the edit is undoable and the formatted
 * text is what gets written. Editing the editor never invokes the save
 * command, so this can't loop. The settings are read on every save, so
 * toggling them applies immediately.
 */
export function registerFormatOnSave(plugin: LatexSuitePlugin) {
	const formatBeforeSave = () => {
		const settings = plugin.settings;
		if (!settings.formatterEnabled || !settings.formatterFormatOnSave) return;
		const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || view.file?.extension !== "md") return;
		try {
			formatLatexInView(view.editor.cm, getFormatterOptions(settings));
		} catch (e) {
			// never block saving
			console.error("Latex Suite: failed to format on save", e);
		}
	};

	plugin.app.workspace.onLayoutReady(() => {
		const saveCommand: Command | undefined = plugin.app.commands?.commands?.["editor:save-file"];
		if (!saveCommand) return;
		let disposed = false;

		const { checkCallback, callback } = saveCommand;
		if (checkCallback) {
			const wrapper = (checking: boolean) => {
				if (!checking && !disposed) formatBeforeSave();
				return checkCallback.call(saveCommand, checking);
			};
			saveCommand.checkCallback = wrapper;
			plugin.register(() => {
				disposed = true;
				// don't clobber another plugin that wrapped the command after us
				if (saveCommand.checkCallback === wrapper) saveCommand.checkCallback = checkCallback;
			});
		} else if (callback) {
			const wrapper = () => {
				if (!disposed) formatBeforeSave();
				return callback.call(saveCommand) as unknown;
			};
			saveCommand.callback = wrapper;
			plugin.register(() => {
				disposed = true;
				if (saveCommand.callback === wrapper) saveCommand.callback = callback;
			});
		}
	});
}
