// Formats LaTeX inside Obsidian $$ display blocks using unified-latex's parser.
// Pure module: no Obsidian/CodeMirror imports so it can be unit tested directly.
import { parseMath } from "@unified-latex/unified-latex-util-parse";
import { printRaw } from "@unified-latex/unified-latex-util-print-raw";
import { DEFAULT_FORMATTER_OPTIONS, type FormatterOptions } from "./options";

type Node = ReturnType<typeof parseMath>[number];
type Macro = Extract<Node, { type: "macro" }>;
type Environment = Extract<Node, { type: "environment" | "mathenv" }>;

// ---- Token classes -----------------------------------------------------------
const REL_STR = new Set(["=", "<", ">"]);
const BIN_STR = new Set(["+", "-"]);
const REL_MACRO = new Set([
	"to", "le", "leq", "ge", "geq", "neq", "approx", "equiv", "sim", "simeq",
	"cong", "in", "notin", "subset", "subseteq", "supset", "implies", "iff",
	"Rightarrow", "Leftarrow", "rightarrow", "mapsto", "coloneqq", "propto",
]);
const BIN_MACRO = new Set([
	"cdot", "times", "pm", "mp", "setminus", "cup", "cap", "circ", "oplus",
	"otimes", "wedge", "vee",
]);
// Operators (BIN_*) split a piece when a neighbouring term is long
// Relations that start a new line when a row is broken
const BREAK_REL_MACRO = new Set(["le", "leq", "ge", "geq", "neq", "approx", "equiv"]);
// "Big" constructs: always get a space before them
const BIG_MACRO = new Set([
	"frac", "dfrac", "tfrac", "lim", "sum", "prod", "int", "iint", "oint",
	"sup", "inf", "max", "min",
]);
const SPACING_MACRO = new Set(["quad", "qquad"]);
// Environments whose & separates cells: never an annotation or break point, one line per row
const MATRIX_ENVS = new Set<string>();
for (const name of ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "smallmatrix", "cases", "array"]) {
	MATRIX_ENVS.add(name).add(name + "*");
}
const OPEN = new Set(["(", "[", "\\{", "\\langle"]);
const CLOSE = new Set([")", "]", "\\}", "\\rangle"]);
// \lvert z \rvert: always padded inside
const BAR_OPEN = new Set(["\\lvert", "\\lVert"]);
const BAR_CLOSE = new Set(["\\rvert", "\\rVert"]);

// "cell": & inside a matrix-like env
type AtomKind = "align" | "cell" | "rel" | "bin" | "big" | "spacing" | "unary" | "other";

/** One top-level token of a row, already printed to a string. */
interface Atom {
	text: string;
	kind: AtomKind;
	/** whitespace preceded this atom in the source */
	space: boolean;
	node?: Node;
	bigLimits?: boolean;
	inNote?: boolean;
	depth?: number;
}

const last = <T>(arr: T[]): T | undefined => arr[arr.length - 1];

const isMacro = (n: Node | undefined): n is Macro => n?.type === "macro";

// ^ and _ are parsed as macros with an empty escape token
const isScript = (n: Node | undefined): boolean =>
	isMacro(n) && n.escapeToken === "" && (n.content === "^" || n.content === "_");

// ---- Inline printing ---------------------------------------------------------
function kindOf(n: Node): AtomKind {
	if (n.type === "string") {
		if (n.content === "&") return "align";
		if (REL_STR.has(n.content)) return "rel";
		if (BIN_STR.has(n.content)) return "bin";
	}
	if (n.type === "macro") {
		if (REL_MACRO.has(n.content)) return "rel";
		if (BIN_MACRO.has(n.content)) return "bin";
		if (BIG_MACRO.has(n.content)) return "big";
		if (SPACING_MACRO.has(n.content)) return "spacing";
	}
	return "other";
}

function toAtoms(nodes: Node[], opts: FormatterOptions, matrix = false): Atom[] {
	const atoms: Atom[] = [];
	let space = false;
	for (const n of nodes) {
		if (n.type === "comment" && n.content.trim() === "") continue; // our row separator
		if (n.type === "whitespace" || n.type === "parbreak") {
			space = true;
			continue;
		}
		const kind = kindOf(n);
		atoms.push({ text: printNode(n, opts), kind: matrix && kind === "align" ? "cell" : kind, space, node: n });
		space = false;
	}
	// limits of \lim, \sup, \sum: "\sup_{w \in D} |f|", not "\sup_{w \in D}|f|"
	atoms.forEach((a, i) => {
		if (/^[_^]/.test(a.text) && atoms[i - 1]?.kind === "big") a.bigLimits = true;
	});
	// "\quad \text{...}" is a note: nothing after the \quad is a break point
	atoms.forEach((a, i) => (a.inNote = atoms[i - 1]?.kind === "spacing" || !!atoms[i - 1]?.inNote));
	// nesting depth of ( ) [ ] | |: only depth-0 operators are break points
	const stack: string[] = [];
	for (const a of atoms) {
		const bar = a.text === "|" || a.text === "\\|";
		if (bar && last(stack) === a.text) {
			stack.pop();
			a.depth = stack.length;
			continue;
		}
		if (CLOSE.has(a.text) || BAR_CLOSE.has(a.text)) stack.pop();
		a.depth = stack.length;
		if (OPEN.has(a.text) || BAR_OPEN.has(a.text) || bar) stack.push(a.text);
	}
	// +/- with nothing to its left is a sign, not a binary operator: -z, (-1
	atoms.forEach((a, i) => {
		if (a.kind !== "bin" || !BIN_STR.has(a.text)) return;
		const p = atoms[i - 1];
		if (!p || ["rel", "bin", "align", "cell", "unary"].includes(p.kind) || OPEN.has(p.text)) {
			a.kind = "unary";
		}
	});
	return atoms;
}

// Spacing between two adjacent atoms
function gap(a: Atom, b: Atom): string {
	// \Delta z must not become \Deltaz -- checked first, it changes meaning
	if (/\\[a-zA-Z]+$/.test(a.text) && /^[a-zA-Z]/.test(b.text)) return " ";
	if (a.kind === "cell" || b.kind === "cell") return " "; // matrix cells: "a & b"
	if (a.kind === "align" && b.kind === "align") return ""; // "&&"
	if (b.kind === "align") return " ";
	if (a.kind === "align") return b.kind === "rel" ? "" : " "; // "&=" stays glued
	if (a.kind === "unary") return "";
	if (/^[_^]/.test(b.text) && isMacro(b.node) && b.node.escapeToken === "") return ""; // \rvert ^2 -> \rvert^2
	const spaced: AtomKind[] = ["rel", "bin", "spacing"];
	if (spaced.includes(a.kind) || spaced.includes(b.kind)) return " ";
	if (BAR_OPEN.has(a.text) || BAR_CLOSE.has(b.text)) return " ";
	if (OPEN.has(a.text) || CLOSE.has(b.text)) return "";
	// parser swallows whitespace after a braced macro argument, so never emit one:
	// `\mathrm d x` -> `\mathrm{d}x` (a space there would vanish on the next pass)
	if (isMacro(a.node) && !isScript(a.node) && a.node.args?.at(-1)?.closeMark === "}" && b.kind !== "big") return "";
	// big operators always get breathing room: e^z \lim, \lim_{..} \frac
	if (b.space || b.kind === "big") return " ";
	// parser swallows whitespace after ^{..}/_{..}, so decide deterministically
	if (isScript(a.node) && /^[a-zA-Z\\]/.test(b.text)) return " ";
	if (a.bigLimits && !/^[_^]/.test(b.text)) return " ";
	return "";
}

function join(atoms: Atom[]): string {
	let s = "";
	atoms.forEach((a, i) => (s += (i ? gap(atoms[i - 1], a) : "") + a.text));
	return s;
}

function printArgs(n: Macro | Environment, opts: FormatterOptions): string {
	return (n.args ?? [])
		.map((a) => a.openMark + join(toAtoms(a.content, opts)) + a.closeMark)
		.join("");
}

// env is typed as string, but guard against a node list like the prototype did
const envName = (n: Environment): string =>
	typeof n.env === "string" ? n.env : printRaw(n.env);

function printNode(n: Node, opts: FormatterOptions): string {
	switch (n.type) {
		case "string":
			return n.content;
		case "group":
			// args of unknown macros (\overline{z_{1}}) arrive unparsed: reparse as math
			return "{" + join(toAtoms(parseMath(printRaw(n.content)), opts)) + "}";
		case "comment":
			throw new Error("% comments not supported yet");
		case "mathenv":
		case "environment": {
			// nested env inside a row: print inline (top-level envs go through printRows).
			// Unlike the original prototype, keep the env's args (e.g. array's {cc}).
			const name = envName(n);
			const body = MATRIX_ENVS.has(name)
				? rows(n.content, opts, true).map((r) => join(r.atoms) + (r.lineBreak === null ? "" : " " + r.lineBreak)).join(" ")
				: join(toAtoms(n.content, opts));
			return `\\begin{${name}}` + printArgs(n, opts) + body + `\\end{${name}}`;
		}
		case "macro": {
			const head = (n.escapeToken ?? "\\") + n.content;
			// ^ and _ : normalize braces
			if (isScript(n)) {
				const inner = join(toAtoms(n.args?.[0]?.content ?? [], opts));
				const bare = opts.scriptBraces === "minimal" && inner.length === 1;
				return head + (bare ? inner : `{${inner}}`);
			}
			// \text{...}, \mathrm{...}: leave content exactly as written
			if (n._renderInfo?.inMathMode === false) {
				return head + (n.args ?? []).map((a) => a.openMark + printRaw(a.content) + a.closeMark).join("");
			}
			return head + printArgs(n, opts);
		}
		default:
			return printRaw(n);
	}
}

// ---- Line breaking -----------------------------------------------------------
// Only (in)equalities are break points; everything else stays on its line.
const isBreakRel = (a: Atom): boolean =>
	a.kind === "rel" && (REL_STR.has(a.text) || BREAK_REL_MACRO.has(a.text.slice(1)));

// "&& \text{...}" (or any & not followed by a relation): always its own line
function isAnnotation(c: Atom[]): boolean {
	const rel = c.find((a) => a.kind !== "align");
	return c[0].kind === "align" && !(rel && isBreakRel(rel));
}

// Split a row into "a", "= b", "<= c", "&= d" pieces
function chunk(atoms: Atom[]): Atom[][] {
	const chunks: Atom[][] = [];
	atoms.forEach((a, i) => {
		const prev = atoms[i - 1];
		const breakHere =
			(a.kind === "align" && prev?.kind !== "align") || // "&=", "&&", "&"
			(isBreakRel(a) && a.depth === 0 && !a.inNote && prev?.kind !== "align");
		const current = last(chunks);
		// everything after "&&" is annotation text: never break inside it
		if (breakHere && current && isAnnotation(current) && a.kind !== "align") {
			current.push(a);
			return;
		}
		if (!current || breakHere) chunks.push([a]);
		else current.push(a);
	});
	return chunks;
}

// Split one relation piece ("&= a + b - c") at top-level operators when the
// term on either side of the operator is long (> opts.termWidth chars)
function layoutPiece(c: Atom[], ind: string, opts: FormatterOptions): string[] {
	let prefixLen = 0;
	while (c[prefixLen]?.kind === "align") prefixLen++;
	if (c[prefixLen] && isBreakRel(c[prefixLen])) prefixLen++;
	const prefix = c.slice(0, prefixLen);
	const annotation = isAnnotation(c);
	const terms: { op: Atom | null; atoms: Atom[] }[] = [{ op: null, atoms: [] }];
	for (const a of c.slice(prefixLen)) {
		if (a.kind === "bin" && a.depth === 0 && !a.inNote && !annotation) terms.push({ op: a, atoms: [] });
		else terms[terms.length - 1].atoms.push(a);
	}
	const len = (t: { atoms: Atom[] }) => join(t.atoms).length;
	// operator lines sit under the first term, i.e. after "&= "
	const hang = ind + " ".repeat(prefixLen ? join(prefix).length + 1 : opts.indent.length);

	const lines = [ind + join([...prefix, ...terms[0].atoms])];
	terms.slice(1).forEach((t, i) => {
		const text = join(t.op ? [t.op, ...t.atoms] : t.atoms);
		const long = len(terms[i]) > opts.termWidth || len(t) > opts.termWidth;
		if (long) lines.push(hang + text);
		else lines[lines.length - 1] += " " + text;
	});
	return lines;
}

function layoutRow(atoms: Atom[], ind: string, opts: FormatterOptions): string[] {
	const whole = join(atoms);
	const chunks = chunk(atoms);
	// First piece at the row's indent, every relation piece one level deeper
	const rest = atoms[0].kind === "align" ? ind : ind + opts.indent;
	const pieces = chunks.map((c, i) => layoutPiece(c, i ? rest : ind, opts));
	const termSplit = pieces.some((p) => p.length > 1);
	const fits = ind.length + whole.length <= opts.width;
	const annotated = opts.annotationOwnLine && chunks.some(isAnnotation);
	if (!termSplit && !annotated && (chunks.length === 1 || (fits && opts.breakAtRelations === "whenLong"))) {
		return [ind + whole];
	}
	return ([] as string[]).concat(...pieces);
}

// ---- Block level -------------------------------------------------------------
const isNewline = (n: Node) => n.type === "macro" && n.content === "\\";

// Split nodes into rows at \\ ; `lineBreak` is the printed \\ (keeps e.g. \\[4pt])
function rows(nodes: Node[], opts: FormatterOptions, matrix = false): { atoms: Atom[]; lineBreak: string | null }[] {
	const out: { nodes: Node[]; lineBreak: string | null }[] = [{ nodes: [], lineBreak: null }];
	for (const n of nodes) {
		if (isNewline(n)) {
			out[out.length - 1].lineBreak = printNode(n, opts);
			out.push({ nodes: [], lineBreak: null });
		} else out[out.length - 1].nodes.push(n);
	}
	return out
		.map((r) => ({ atoms: toAtoms(r.nodes, opts, matrix), lineBreak: r.lineBreak }))
		.filter((r) => r.atoms.length || r.lineBreak !== null);
}

function rowSeparatorLine(opts: FormatterOptions): string | null {
	switch (opts.rowSeparator) {
		case "blankLine":
			return "";
		case "comment":
			return "%";
		case "none":
			return null;
	}
}

function printRows(nodes: Node[], ind: string, opts: FormatterOptions, matrix = false): string[] {
	const lines: string[] = [];
	const all = rows(nodes, opts, matrix);
	const separator = rowSeparatorLine(opts);
	all.forEach((r, i) => {
		// rows that start with "&=" sit one level deeper than the LHS
		const rowInd = r.atoms[0]?.kind === "align" ? ind + opts.indent : ind;
		// a bare "\\" row has no atoms: print just the line break
		// (the prototype crashed here and skipped the whole block)
		// matrix rows are never broken: one line per row
		const rowLines = !r.atoms.length ? [] : matrix ? [rowInd + join(r.atoms)] : layoutRow(r.atoms, rowInd, opts);
		if (r.lineBreak !== null) {
			if (rowLines.length) rowLines[rowLines.length - 1] += " " + r.lineBreak;
			else rowLines.push(rowInd + r.lineBreak);
		}
		lines.push(...rowLines);
		const isLast = i === all.length - 1;
		if (rowLines.length > 1 && !isLast && separator !== null) lines.push(separator);
	});
	return lines;
}

/**
 * Format the body of one display math block (the text between the `$$` lines).
 * Throws if the body can't be formatted safely (parse error, non-empty `%` comment).
 */
export function formatMath(src: string, opts: FormatterOptions = DEFAULT_FORMATTER_OPTIONS): string {
	const nodes = parseMath(src);
	const lines: string[] = [];
	let run: Node[] = [];
	const flush = () => {
		if (run.some((n) => n.type !== "whitespace")) lines.push(...printRows(run, "", opts));
		run = [];
	};
	for (const n of nodes) {
		if (n.type === "mathenv" || n.type === "environment") {
			flush();
			const name = envName(n);
			lines.push(`\\begin{${name}}` + printArgs(n, opts));
			lines.push(...printRows(n.content, opts.indent, opts, MATRIX_ENVS.has(name)));
			lines.push(`\\end{${name}}`);
		} else run.push(n);
	}
	flush();
	return lines.map((l) => l.trimEnd()).join("\n");
}

/**
 * Like formatMath, but returns null instead of throwing, and also when the
 * result isn't stable (formatting it again would change it). On any doubt the
 * block should be left untouched.
 */
export function tryFormatMath(src: string, opts: FormatterOptions = DEFAULT_FORMATTER_OPTIONS): string | null {
	try {
		const formatted = formatMath(src, opts);
		if (formatMath(formatted, opts) !== formatted) return null;
		return formatted;
	} catch {
		return null;
	}
}

// ---- Document level ----------------------------------------------------------
export interface DisplayMathBlock {
	/** start of the opening `$$` line */
	from: number;
	/** end of the closing `$$` line */
	to: number;
	/** the text between the `$$` lines (without the surrounding newlines) */
	body: string;
	bodyFrom: number;
	bodyTo: number;
}

// Ranges of fenced code blocks (``` or ~~~), whose content must never be touched
function codeFenceRanges(markdown: string): [number, number][] {
	const ranges: [number, number][] = [];
	let open: { start: number; marker: string } | null = null;
	let pos = 0;
	for (const line of markdown.split("\n")) {
		const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
		if (fence) {
			if (!open) open = { start: pos, marker: fence[1] };
			else if (fence[1][0] === open.marker[0] && fence[1].length >= open.marker.length && line.trim() === fence[1]) {
				ranges.push([open.start, pos + line.length]);
				open = null;
			}
		}
		pos += line.length + 1;
	}
	if (open) ranges.push([open.start, markdown.length]);
	return ranges;
}

/** Find `$$ ... $$` blocks where both `$$` are on their own line. Inline math is ignored. */
export function findDisplayMathBlocks(markdown: string): DisplayMathBlock[] {
	const fences = codeFenceRanges(markdown);
	const blocks: DisplayMathBlock[] = [];
	const re = /^\$\$\n([\s\S]*?)\n\$\$$/gm;
	let m: RegExpExecArray | null;
	while ((m = re.exec(markdown)) !== null) {
		const from = m.index;
		const to = from + m[0].length;
		const fence = fences.find(([start, end]) => from <= end && to >= start);
		if (fence) {
			// skip blocks overlapping a code fence, resume after the fence if we started inside it
			re.lastIndex = from >= fence[0] ? Math.max(fence[1], from + 1) : from + 1;
			continue;
		}
		const bodyFrom = from + 3;
		blocks.push({ from, to, body: m[1], bodyFrom, bodyTo: bodyFrom + m[1].length });
	}
	return blocks;
}

/**
 * Format every `$$` display block of a markdown document.
 * `changed`: blocks whose text changed, `skipped`: blocks left untouched because they couldn't be formatted safely.
 */
export function formatDocument(
	markdown: string,
	opts: FormatterOptions = DEFAULT_FORMATTER_OPTIONS,
): { text: string; changed: number; skipped: number } {
	let text = "";
	let pos = 0;
	let changed = 0;
	let skipped = 0;
	for (const block of findDisplayMathBlocks(markdown)) {
		const formatted = tryFormatMath(block.body, opts);
		if (formatted === null) {
			skipped++;
			continue;
		}
		if (formatted === block.body) continue;
		changed++;
		text += markdown.slice(pos, block.bodyFrom) + formatted;
		pos = block.bodyTo;
	}
	text += markdown.slice(pos);
	return { text, changed, skipped };
}
