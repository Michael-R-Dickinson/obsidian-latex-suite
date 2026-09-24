import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DEFAULT_FORMATTER_OPTIONS,
	findDisplayMathBlocks,
	formatDocument,
	formatMath,
	tryFormatMath,
	type FormatterOptions,
} from "../../src/features/latex_formatter";
import { canonical } from "./meaning";

const FIXTURES = join(__dirname, "..", "fixtures", "latex_formatter");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");

const fmt = (src: string, opts: Partial<FormatterOptions> = {}) =>
	formatMath(src, { ...DEFAULT_FORMATTER_OPTIONS, ...opts });
const lines = (...l: string[]) => l.join("\n");

// A long align block reused by several layout / separator tests
const LONG_ALIGN =
	"\\begin{align} x &= aaaaaaaaaaaaaaaaaaaaaaa + bbbbbbbbbbbbbbbbbbbbbbbbbbb \\\\ &= c \\\\ " +
	"&= ddddddddddddddddddddddddd \\cdot eeeeeeeeeeeeeeeeeeeeeee \\end{align}";
const longAlign = (separator: string | null, ind = "  ") => {
	const deeper = ind + ind;
	const hang = deeper + "   "; // under the first term, i.e. after "&= "
	return lines(
		"\\begin{align}",
		ind + "x",
		deeper + "&= aaaaaaaaaaaaaaaaaaaaaaa",
		hang + "+ bbbbbbbbbbbbbbbbbbbbbbbbbbb \\\\",
		...(separator === null ? [] : [separator]),
		deeper + "&= c \\\\",
		deeper + "&= ddddddddddddddddddddddddd",
		hang + "\\cdot eeeeeeeeeeeeeeeeeeeeeee",
		"\\end{align}",
	);
};

describe("golden files", () => {
	const cases = [
		{ name: "obsidian-latex-example", changed: 4 },
		{ name: "obsidian-latex-example2", changed: 10 },
	];
	for (const { name, changed } of cases) {
		it(`${name}.md formats byte-identical to ${name}.formatted.md`, () => {
			const result = formatDocument(fixture(`${name}.md`));
			expect(result.text).toBe(fixture(`${name}.formatted.md`));
			expect(result.changed).toBe(changed);
			expect(result.skipped).toBe(0);
		});

		it(`${name}.formatted.md is a fixed point`, () => {
			const expected = fixture(`${name}.formatted.md`);
			const result = formatDocument(expected);
			expect(result.text).toBe(expected);
			expect(result.changed).toBe(0);
			expect(result.skipped).toBe(0);
		});
	}
});

describe("spacing", () => {
	it("strips padding inside braces", () => {
		expect(fmt("{ x }")).toBe("{x}");
		expect(fmt("\\lim_{ \\Delta z \\to 0 } f")).toBe("\\lim_{\\Delta z \\to 0} f");
	});

	it("puts single spaces around relations and binary operators", () => {
		expect(fmt("a=b+c-d\\cdot e")).toBe("a = b + c - d \\cdot e");
		expect(fmt("a  =   b")).toBe("a = b");
		expect(fmt("x \\le y")).toBe("x \\le y");
	});

	it("leaves unary minus unspaced", () => {
		expect(fmt("e^{-z}+(-1)")).toBe("e^{-z} + (-1)");
		expect(fmt("a = -b")).toBe("a = -b");
		expect(fmt("-a")).toBe("-a");
	});

	it("keeps \\text{...} content as written", () => {
		expect(fmt("\\text{a=b+c}")).toBe("\\text{a=b+c}");
		expect(fmt("x=1\\quad\\text{complex identity for }x")).toBe("x = 1 \\quad \\text{complex identity for }x");
	});

	it("PINNED: runs of spaces inside \\text{} collapse to one (the parser merges them; same output in TeX)", () => {
		expect(fmt("\\text{a  b}")).toBe("\\text{a b}");
	});

	it("does not put a space before ^ or _", () => {
		expect(fmt("x ^2")).toBe("x^2");
		expect(fmt("\\lvert z \\rvert ^2")).toBe("\\lvert z \\rvert^2");
	});

	it("pads \\lvert ... \\rvert", () => {
		expect(fmt("\\lvert z\\rvert")).toBe("\\lvert z \\rvert");
		expect(fmt("\\lvert z_{1}+z_{2} \\rvert")).toBe("\\lvert z_1 + z_2 \\rvert");
	});

	it("never glues a macro to a following letter", () => {
		expect(fmt("\\Delta z")).toBe("\\Delta z");
		expect(fmt("\\lvert z \\rvert")).toBe("\\lvert z \\rvert");
		expect(fmt("\\cos\\phi \\Delta x \\alpha\\beta")).toBe("\\cos\\phi \\Delta x \\alpha\\beta");
		expect(fmt("r\\cdot\\sin \\phi = y")).toBe("r \\cdot \\sin \\phi = y");
		for (const src of ["\\lvert z\\rvert", "\\Delta z", "e^\\Delta z", "\\sin x", "\\lim_{\\Delta z\\to 0}"]) {
			expect(fmt(src)).not.toMatch(/\\(lvert|Delta|sin)[a-z]/);
		}
	});

	it("reformats args of unknown macros (\\overline)", () => {
		expect(fmt("\\overline{z_{1}}")).toBe("\\overline{z_1}");
		expect(fmt("\\overline{x+yi}=x-yi")).toBe("\\overline{x + yi} = x - yi");
	});
});

describe("script braces", () => {
	it("minimal: drops braces around single characters only", () => {
		expect(fmt("z_{0}")).toBe("z_0");
		expect(fmt("x^{10}")).toBe("x^{10}");
		expect(fmt("x_{\\alpha}")).toBe("x_{\\alpha}");
		expect(fmt("x^{a}_{b}")).toBe("x^a_b");
		expect(fmt("\\sum_{i=1}^{n} i")).toBe("\\sum_{i = 1}^n i");
	});

	it("minimal: adds braces around a bare macro script", () => {
		expect(fmt("e^\\Delta z")).toBe("e^{\\Delta} z");
		expect(fmt("x^\\alpha y")).toBe("x^{\\alpha} y");
	});

	it("always: braces every script", () => {
		expect(fmt("x_1 + e^z", { scriptBraces: "always" })).toBe("x_{1} + e^{z}");
		expect(fmt("z_{0}", { scriptBraces: "always" })).toBe("z_{0}");
		expect(fmt("x^{10}", { scriptBraces: "always" })).toBe("x^{10}");
	});
});

describe("line breaking", () => {
	it("leaves short lines untouched", () => {
		expect(fmt("a = b = c")).toBe("a = b = c");
		expect(fmt("a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s")).toBe(
			"a + b + c + d + e + f + g + h + i + j + k + l + m + n + o + p + q + r + s",
		);
	});

	it("breaks long rows at top-level relations", () => {
		expect(fmt("aaaaaaaaaa + bbbbbbbbbb = cccccccccc + dddddddddd = eeeeeeeeee + ffff")).toBe(
			lines("aaaaaaaaaa + bbbbbbbbbb", "  = cccccccccc + dddddddddd", "  = eeeeeeeeee + ffff"),
		);
	});

	it("breaks at every breaking relation (= < > \\le \\leq \\ge \\geq \\neq \\approx \\equiv)", () => {
		expect(
			fmt("a \\le bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \\leq cccccccccccccccccccccc \\neq d \\approx e \\equiv f \\geq g \\ge h < i > j"),
		).toBe(
			lines(
				"a",
				"  \\le bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
				"  \\leq cccccccccccccccccccccc",
				"  \\neq d",
				"  \\approx e",
				"  \\equiv f",
				"  \\geq g",
				"  \\ge h",
				"  < i",
				"  > j",
			),
		);
	});

	it("breakAtRelations 'always' breaks short rows too", () => {
		expect(fmt("a = b = c", { breakAtRelations: "always" })).toBe(lines("a", "  = b", "  = c"));
	});

	it("never breaks at \\to or \\in", () => {
		const src = "aaaaaaaaaaaaaaaaaaaaaaaaaa \\to bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \\in cccccccccccccccc";
		expect(fmt(src)).toBe(src);
	});

	it.each([
		["( )", "f(aaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb = ccccccccccccccccccccccc)"],
		["[ ]", "[aaaaaaaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb = cc]"],
		["| |", "|aaaaaaaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb = cc|"],
		["\\lvert \\rvert", "\\lvert aaaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbb = ccccccccccccccccccc \\rvert"],
		["{ }", "{aaaaaaaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb = cc}"],
	])("never breaks inside %s", (_, src) => {
		expect(fmt(src)).toBe(src);
	});

	it("splits at binary operators only when a neighbouring term exceeds termWidth", () => {
		expect(fmt("aaaaaaaaaaaaaaaaaaaaaaa + bbbbbbbbbbbbbbbbbbbbbbbbbbbbb = c")).toBe(
			lines("aaaaaaaaaaaaaaaaaaaaaaa", "  + bbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "  = c"),
		);
		expect(fmt("aaaa + bbbb = c", { termWidth: 5 })).toBe("aaaa + bbbb = c");
		expect(fmt("aaaaaa + bbbbbb = c", { termWidth: 5 })).toBe(lines("aaaaaa", "  + bbbbbb", "  = c"));
	});

	it("puts && annotations on their own line", () => {
		expect(fmt("a &= b && \\text{n}")).toBe(lines("a", "  &= b", "  && \\text{n}"));
	});

	it("annotationOwnLine false keeps short annotated rows on one line", () => {
		expect(fmt("a &= b && \\text{n}", { annotationOwnLine: false })).toBe("a &= b && \\text{n}");
	});

	it("never splits inside an annotation", () => {
		expect(fmt("a &= b && x = y + zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toBe(
			lines("a", "  &= b", "  && x = y + zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"),
		);
		expect(fmt("\\begin{align} a &= b && \\text{note = with relation} \\\\ c &= d \\end{align}")).toBe(
			lines("\\begin{align}", "  a", "    &= b", "    && \\text{note = with relation} \\\\", "", "  c &= d", "\\end{align}"),
		);
	});

	it("never breaks after \\quad / \\qquad", () => {
		for (const q of ["\\quad", "\\qquad"]) {
			const src = `x ${q} \\text{where }aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`;
			expect(fmt(src)).toBe(src);
		}
	});
});

describe("layout", () => {
	it("indents environment contents", () => {
		expect(fmt("\\begin{gather} a \\\\ b \\end{gather}")).toBe(lines("\\begin{gather}", "  a \\\\", "  b", "\\end{gather}"));
		expect(fmt("\\begin{align*} a &= b \\end{align*}")).toBe(lines("\\begin{align*}", "  a &= b", "\\end{align*}"));
	});

	it("puts rows starting with &= one level deeper than the LHS", () => {
		expect(fmt("\\begin{align} a &= b \\\\ &= c \\end{align}")).toBe(
			lines("\\begin{align}", "  a &= b \\\\", "    &= c", "\\end{align}"),
		);
	});

	it("hangs operator continuation lines under the first term after '&= '", () => {
		expect(fmt(LONG_ALIGN)).toBe(longAlign(""));
	});

	it("uses the configured indent unit", () => {
		expect(fmt(LONG_ALIGN, { indent: "\t" })).toBe(longAlign("", "\t"));
	});
});

describe("row separator", () => {
	it("blankLine", () => expect(fmt(LONG_ALIGN, { rowSeparator: "blankLine" })).toBe(longAlign("")));
	it("comment", () => expect(fmt(LONG_ALIGN, { rowSeparator: "comment" })).toBe(longAlign("%")));
	it("none", () => expect(fmt(LONG_ALIGN, { rowSeparator: "none" })).toBe(longAlign(null)));

	it("is never printed after the last row of a block", () => {
		const env = "\\begin{align} x &= aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa + bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \\end{align}";
		const expected = lines(
			"\\begin{align}",
			"  x",
			"    &= aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"       + bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			"\\end{align}",
		);
		for (const rowSeparator of ["blankLine", "comment"] as const) {
			expect(fmt(env, { rowSeparator })).toBe(expected);
			// no environment: nothing after the last line either
			expect(fmt("aaaaaaaaaaaaaaaaaaaaaaa + bbbbbbbbbbbbbbbbbbbbbbbbbbbbb = c", { rowSeparator })).toBe(
				lines("aaaaaaaaaaaaaaaaaaaaaaa", "  + bbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "  = c"),
			);
		}
	});
});

// The user decided matrix-like environments keep each row (split at \\) on one
// line with cells joined by " & " -- a lone & there is a column separator, not
// an annotation.
describe("matrix-like environments", () => {
	const envs = ["matrix", "pmatrix", "bmatrix", "Bmatrix", "vmatrix", "Vmatrix", "smallmatrix", "cases"];
	const starred = ["pmatrix*", "bmatrix*", "cases*"];

	it.each([...envs, ...starred])("%s: one row per line, cells joined by ' & '", (env) => {
		expect(fmt(`\\begin{${env}} a&b \\\\ c&d \\end{${env}}`)).toBe(
			lines(`\\begin{${env}}`, "  a & b \\\\", "  c & d", `\\end{${env}}`),
		);
	});

	it("array keeps its column spec", () => {
		expect(fmt("\\begin{array}{cc} a&b \\\\ c&d \\end{array}")).toBe(
			lines("\\begin{array}{cc}", "  a & b \\\\", "  c & d", "\\end{array}"),
		);
	});

	it("cases with relations in the cells stays one row per line", () => {
		expect(fmt("\\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}")).toBe(
			lines("\\begin{cases}", "  1 & x > 0 \\\\", "  0 & x \\le 0", "\\end{cases}"),
		);
	});

	it("align/gather are unaffected: lone & in align is still an annotation", () => {
		expect(fmt("\\begin{align} x & \\text{foo} \\\\ y \\end{align}")).toBe(
			lines("\\begin{align}", "  x", "    & \\text{foo} \\\\", "", "  y", "\\end{align}"),
		);
	});
});

describe("known behaviors (pinned, flagged by implementer)", () => {
	// KNOWN BEHAVIOR: a top-level \left( ... \right) around an environment is split into
	// three blocks: "\left(" and "\right)" on their own lines, the environment at column 0.
	it("PINNED: \\left( \\begin{array}..\\end{array} \\right) layout", () => {
		const src = "\\left( \\begin{array}{cc} a & b \\\\ c & d \\end{array} \\right)";
		const out = fmt(src);
		expect(out).toBe(lines("\\left(", "\\begin{array}{cc}", "  a & b \\\\", "  c & d", "\\end{array}", "\\right)"));
		expect(fmt(out)).toBe(out);
		expect(canonical(out)).toBe(canonical(src));
	});

	// KNOWN BEHAVIOR (found while testing, cosmetic only): \left( is treated like "(" so no space
	// follows it, but \right) is not, so a space precedes it.
	it("PINNED: \\left( x \\right) -> \\left(x \\right)", () => {
		expect(fmt("\\left( x \\right)")).toBe("\\left(x \\right)");
	});
});

describe("safety", () => {
	it("throws on a non-empty % comment; tryFormatMath returns null", () => {
		expect(() => formatMath("a % hi")).toThrow();
		expect(tryFormatMath("a % hi")).toBeNull();
	});

	it("drops empty % comments (the 'comment' row separator)", () => {
		expect(fmt("a %")).toBe("a");
	});

	it("returns null for input that can't be formatted stably (unbalanced braces)", () => {
		expect(tryFormatMath("\\frac{1}{2")).toBeNull();
	});

	it("formatDocument leaves unformattable blocks untouched and counts them as skipped", () => {
		const doc = lines("$$", "a % a real comment", "$$", "", "$$", "\\frac{1}{2", "$$", "", "$$", "a=b", "$$");
		const result = formatDocument(doc);
		expect(result.text).toBe(lines("$$", "a % a real comment", "$$", "", "$$", "\\frac{1}{2", "$$", "", "$$", "a = b", "$$"));
		expect(result.skipped).toBe(2);
		expect(result.changed).toBe(1);
	});

	// the parser swallows whitespace after a braced argument, so unbraced args followed
	// by a space must format to a stable, space-free form
	it.each([
		["\\int f(x) \\mathrm d x", "\\int f(x) \\mathrm{d}x"],
		["\\sqrt x y", "\\sqrt{x}y"],
		["\\mathbb R x", "\\mathbb{R}x"],
		["\\frac a b c", "\\frac{a}{b}c"],
	])("unbraced argument %s formats stably", (src, expected) => {
		expect(tryFormatMath(src)).toBe(expected);
	});
});

describe("findDisplayMathBlocks", () => {
	it("returns correct offsets", () => {
		const md = lines("intro $x$", "$$", "a=b", "$$", "text", "$$", "\\begin{align}", "x", "\\end{align}", "$$", "");
		const blocks = findDisplayMathBlocks(md);
		expect(blocks.map((b) => b.body)).toEqual(["a=b", "\\begin{align}\nx\n\\end{align}"]);
		for (const b of blocks) {
			expect(md.slice(b.from, b.to)).toBe("$$\n" + b.body + "\n$$");
			expect(md.slice(b.bodyFrom, b.bodyTo)).toBe(b.body);
		}
		expect(blocks[0].from).toBe("intro $x$\n".length);
		expect(blocks[0].bodyFrom).toBe(blocks[0].from + 3);
	});

	it("ignores inline math and $$ not on their own line", () => {
		expect(findDisplayMathBlocks("inline $a=b$ and $$a=b$$ here")).toEqual([]);
		expect(findDisplayMathBlocks("text $$\na=b\n$$")).toEqual([]);
	});

	it("ignores $$ inside ``` and ~~~ code fences, but finds blocks after them", () => {
		const md = lines("```", "$$", "a=b", "$$", "```", "~~~md", "$$", "c=d", "$$", "~~~", "$$", "e=f", "$$");
		const blocks = findDisplayMathBlocks(md);
		expect(blocks.map((b) => b.body)).toEqual(["e=f"]);
		expect(md.slice(blocks[0].from, blocks[0].to)).toBe("$$\ne=f\n$$");
	});

	it("an unclosed code fence hides everything after it", () => {
		expect(findDisplayMathBlocks(lines("```", "$$", "a=b", "$$"))).toEqual([]);
	});
});

describe("formatDocument", () => {
	it("only touches $$ blocks; inline math and code fences are untouched", () => {
		const md = lines("inline $a=b$ and $$a=b$$", "```", "$$", "a=b", "$$", "```", "$$", "a=b", "$$", "");
		const result = formatDocument(md);
		expect(result.text).toBe(lines("inline $a=b$ and $$a=b$$", "```", "$$", "a=b", "$$", "```", "$$", "a = b", "$$", ""));
		expect(result.changed).toBe(1);
		expect(result.skipped).toBe(0);
	});

	it("does not count already-formatted blocks as changed", () => {
		expect(formatDocument(lines("$$", "a = b", "$$"))).toEqual({ text: lines("$$", "a = b", "$$"), changed: 0, skipped: 0 });
	});
});

describe("meaning oracle (self-check)", () => {
	it("accepts formatting-only changes", () => {
		for (const [a, b] of [
			["z_{0}", "z_0"],
			["{ x }", "{x}"],
			["\\frac12", "\\frac{1}{2}"],
			["a=b", "a\n  = b"],
			["\\text{a  b}", "\\text{a b}"],
			["\\overline{z_{1}}", "\\overline{z_1}"],
			["a \\\\ b", "a \\\\\n%\nb"],
		]) {
			expect(canonical(b), `${a} vs ${b}`).toBe(canonical(a));
		}
	});

	it("rejects meaning changes", () => {
		for (const [a, b] of [
			["\\Delta z", "\\Deltaz"],
			["x^{10}", "x^10"],
			["\\text{a b}", "\\text{ab}"],
			["a \\\\ b", "a b"],
			["a & b", "a b"],
			["a % c", "a"],
		]) {
			expect(canonical(b), `${a} vs ${b}`).not.toBe(canonical(a));
		}
	});
});

describe("option matrix: idempotent and meaning-preserving", () => {
	// Full cross product of every option except indent (which only changes the
	// leading whitespace), alternated across combos to keep the run time down.
	const combos: FormatterOptions[] = [];
	for (const width of [20, 60])
		for (const scriptBraces of ["minimal", "always"] as const)
			for (const termWidth of [5, 1000])
				for (const breakAtRelations of ["whenLong", "always"] as const)
					for (const rowSeparator of ["blankLine", "comment", "none"] as const)
						for (const annotationOwnLine of [true, false]) {
							const indent = combos.length % 2 ? "\t" : "  ";
							combos.push({ width, indent, scriptBraces, termWidth, breakAtRelations, rowSeparator, annotationOwnLine });
						}
	combos.push(DEFAULT_FORMATTER_OPTIONS);
	const TIMEOUT = 60_000;

	const docs = ["obsidian-latex-example.md", "obsidian-latex-example2.md"];
	const bodies = [
		...docs.flatMap((d) => findDisplayMathBlocks(fixture(d)).map((b) => b.body)),
		"aaaaaaaaaa + bbbbbbbbbb = cccccccccc + dddddddddd = eeeeeeeeee + ffff",
		"a \\le bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \\leq cccccccccccccccccccccc \\neq d \\approx e \\equiv f",
		"x \\quad \\text{where } aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"\\begin{align} a &= b && \\text{note = with relation} \\\\ c &= d \\end{align}",
		"f(aaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb = ccccccccccccccccccccccc)",
		"\\lvert aaaaaaaaaaaaaaaaaaaaa = bbbbbbbbbbbbbbbbbbbbbbbbb = ccccccccccccccccccc \\rvert",
		"e^\\Delta z + \\lvert z\\rvert^{2} - \\overline{z_{1}} + x^{10}_{i}",
		LONG_ALIGN,
		"\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}",
		"f(x) = \\begin{cases} 1 & x > 0 \\\\ 0 & x \\le 0 \\end{cases}",
		"\\left( \\begin{array}{cc} a & b \\\\ c & d \\end{array} \\right)",
		"a \\\\[4pt] b \\\\ \\\\ c",
		"\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} \\qquad \\text{Gauss}",
	];

	it.each(bodies.map((b, i) => [i, b]))("block %i", (_, body) => {
		for (const opts of combos) {
			const label = JSON.stringify(opts);
			const once = formatMath(body, opts);
			expect(formatMath(once, opts), `idempotence ${label}`).toBe(once);
			expect(canonical(once), `meaning ${label}`).toBe(canonical(body));
			expect(tryFormatMath(body, opts), `skipped ${label}`).toBe(once);
			// no separator after the last row of a block/environment
			const out = once.split("\n");
			out.forEach((l, i) => {
				if (l === "" || l === "%") {
					const next = out[i + 1];
					expect(next !== undefined && !next.startsWith("\\end{"), `separator before end ${label}`).toBe(true);
				}
			});
		}
	}, TIMEOUT);

	it("formatDocument is idempotent on the fixtures for every option combo", () => {
		for (const opts of combos) {
			for (const d of docs) {
				const first = formatDocument(fixture(d), opts);
				expect(first.skipped).toBe(0);
				const second = formatDocument(first.text, opts);
				expect(second.text).toBe(first.text);
				expect(second.changed).toBe(0);
			}
		}
	}, TIMEOUT);
});
