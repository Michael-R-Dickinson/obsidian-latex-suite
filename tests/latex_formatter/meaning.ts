// "Same meaning" oracle for the formatter tests.
//
// Both the input and the formatted output are parsed with unified-latex (the same
// parser the formatter uses) and serialized to a canonical string that ignores
// everything the formatter is allowed to change:
// - whitespace / newlines / empty `%` comments in math mode (TeX ignores them there)
// - the brace style of arguments: `z_{0}` == `z_0`, `\frac12` == `\frac{1}{2}`
// - padding inside groups: `{ x }` == `{x}`
// - runs of whitespace in text mode (`\text{a  b}` == `\text{a b}`), since TeX collapses them
//
// Everything else is kept, so real meaning changes are caught:
// - macro + letter glued (`\Delta z` -> `\Deltaz`) parses as a *different macro*
// - brace removal that changes grouping (`^{10}` -> `^10`) changes the script argument
// - dropping `\\`, `&`, or text-mode spaces (`\text{a b}` -> `\text{ab}`)
import { parseMath } from "@unified-latex/unified-latex-util-parse";
import { printRaw } from "@unified-latex/unified-latex-util-print-raw";

type Node = ReturnType<typeof parseMath>[number];

function serialize(nodes: Node[], textMode: boolean): string {
	let out = "";
	for (const n of nodes) {
		switch (n.type) {
			case "whitespace":
			case "parbreak":
				// collapse runs of text-mode whitespace to one space
				if (textMode && !out.endsWith(" ")) out += " ";
				break;
			case "string":
				out += n.content;
				break;
			case "comment":
				if (n.content.trim() !== "") out += "%" + n.content + "\n";
				break;
			case "group":
				// group contents can come back unparsed (e.g. `z_{1}` inside `\overline{..}`), so reparse
				out += "{" + (textMode ? serialize(n.content, true) : canonical(printRaw(n.content))) + "}";
				break;
			case "macro": {
				const isText = n._renderInfo?.inMathMode === false;
				// terminate the macro name so `\Delta z` and `\Deltaz` differ
				out += (n.escapeToken ?? "\\") + n.content + ";";
				for (const a of n.args ?? []) {
					if (a.openMark === "" && a.content.length === 0) continue; // absent optional arg
					const open = a.openMark === "[" ? "[" : "{";
					const close = a.openMark === "[" ? "]" : "}";
					out += open + serialize(a.content, textMode || isText) + close;
				}
				break;
			}
			case "environment":
			case "mathenv": {
				const name = typeof n.env === "string" ? n.env : printRaw(n.env);
				out += `\\begin{${name}}`;
				for (const a of n.args ?? []) out += a.openMark + serialize(a.content, textMode) + a.closeMark;
				out += serialize(n.content, textMode) + `\\end{${name}}`;
				break;
			}
			default:
				out += printRaw(n);
		}
	}
	return out;
}

/** Canonical form of a math body: equal canonical forms mean the formatter didn't change the meaning. */
export function canonical(src: string): string {
	return serialize(parseMath(src), false);
}
