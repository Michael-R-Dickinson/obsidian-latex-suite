# LaTeX formatter

Pure formatter for `$$` display blocks — no `obsidian` / CodeMirror imports, so it's unit-testable in plain Node. User-facing rules and settings: [DOCS.md#formatter](../../../DOCS.md#formatter).

## Layout
- `options.ts` — `FormatterOptions` + `DEFAULT_FORMATTER_OPTIONS` (single source of defaults; settings read from it)
- `formatter.ts` — everything else. Public: `formatMath` (throws), `tryFormatMath` (null on throw or non-idempotent), `findDisplayMathBlocks`, `formatDocument`
- Plugin glue lives outside: `../format_latex.ts` (editor edits, cursor mapping, format-on-save), `../editor_commands.ts` (commands), `src/settings/settings.ts` (`getFormatterOptions` maps settings → options)

## Pipeline (formatter.ts)
1. `parseMath` (unified-latex) → nodes
2. `toAtoms`: each top-level node printed to a string + `kind` (rel/bin/big/align/cell/…), `depth` (inside `( ) [ ] | | \lvert\rvert`), `inNote` (after `\quad`)
3. `gap(a, b)`: all spacing decisions between two atoms — rule order matters (macro+letter check must stay first: `\lvert z` ≠ `\lvertz`)
4. `chunk` splits a row at `&`-groups and depth-0 break relations; `layoutPiece` splits chunks at depth-0 operators by `termWidth`; `layoutRow` decides whether to break at all
5. `printRows` splits at `\\`, adds indentation and the row separator; matrix-like envs (`MATRIX_ENVS`) take a separate path where `&` is a plain cell separator

## Invariants (enforced by tests)
- **Idempotent**: `format(format(x)) === format(x)`. `tryFormatMath` skips the block otherwise.
- **Meaning-preserving**: only whitespace and script/argument braces change. Tests compare normalized parse trees (`tests/latex_formatter/meaning.ts`).
- Never emits a separator before `\end{..}` or the closing `$$`.
- Unparseable blocks / non-empty `%` comments → block untouched.

## unified-latex quirks (main source of idempotence bugs)
- Whitespace after a braced argument (`^{..}`, `_{..}`, `\mathrm{d}`) is swallowed by the parser, so the printer can't know if it was there. Spacing after these is decided deterministically in `gap` — never from the source.
- `{..}` following an unknown macro (`\overline`, `\bar`) is parsed as text (`z_{1}` → string `"z_"` + group); groups are re-parsed with `parseMath`.
- `\text{..}` args (`_renderInfo.inMathMode === false`) are printed with `printRaw`; runs of spaces inside collapse to one.

## Testing
- `npm run test:formatter` — plain Node, uses `vitest.formatter.config.mts`. (`npm test` needs a live Obsidian for the other suites.)
- Golden files: `tests/fixtures/latex_formatter/*.md` → `*.formatted.md`. When a rule change intentionally alters output, regenerate the `.formatted.md` and review the diff.
- New rule → add a focused case in `tests/latex_formatter/formatter.test.ts`; the option-matrix test catches idempotence/meaning regressions across settings.
