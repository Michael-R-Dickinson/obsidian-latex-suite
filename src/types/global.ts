import { EditorView } from "@codemirror/view";
import type { Command } from "obsidian";
import { CodeMirrorEditor, type Vim } from "./vim_types";

declare global {
	interface Window {
		CodeMirrorAdapter?: {
			Vim?: Vim;
		}
	}
	interface Set<T> {
		difference?: (this: Set<T>, other: Set<T>) => Set<T>;
		intersection?: (this: Set<T>, other: Set<T>) => Set<T>;
	}
}

declare module "obsidian" {
	interface App {
		isVimEnabled?: () => boolean;
		/** internal command registry, used to wrap "editor:save-file" for format on save */
		commands?: {
			commands?: Record<string, Command>;
		};
	}
	interface Editor {
		cm: EditorView
	}
}

declare module "@codemirror/view" {
	interface EditorView {
		cm?: CodeMirrorEditor
	}
}

declare module "@lezer/common" {
	interface Tree {
		toString(): string
	}	
}
