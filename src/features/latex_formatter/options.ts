export interface FormatterOptions {
	/** Soft max line length. Rows longer than this are broken at top-level relations. */
	width: number;
	/** Indent unit used for environment content and continuation lines. */
	indent: string;
	/** "minimal": e^z, e^{10}   "always": e^{z} */
	scriptBraces: "minimal" | "always";
	/** Break around + - \cdot ... when a neighbouring term is longer than this. */
	termWidth: number;
	/** "whenLong": only break at relations if the row is longer than `width`. "always": every relation. */
	breakAtRelations: "whenLong" | "always";
	/** Printed after a row that spans several lines (never after the last row of a block). */
	rowSeparator: "blankLine" | "comment" | "none";
	/** Put "&& \text{...}" annotations on their own line even if the row would fit. */
	annotationOwnLine: boolean;
}

export const DEFAULT_FORMATTER_OPTIONS: FormatterOptions = {
	width: 60,
	indent: "  ",
	scriptBraces: "minimal",
	termWidth: 20,
	breakAtRelations: "whenLong",
	rowSeparator: "blankLine",
	annotationOwnLine: true,
};
