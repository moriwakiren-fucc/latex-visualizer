/**
 * scanner.ts — a faithful TypeScript port of upstream mpto's lexer
 * (`mpx_getline`, `mpx_match_str`, `mpx_getbta`, `mpx_copy_mpto` and the
 * "Do a line" loop of `mpx_mpto` in texk/web2c/mplibdir/mpxout.w).
 *
 * The port exists so that the TeX bridge (docs/05 §3) can find `btex` /
 * `verbatimtex` blocks without writing temporaries, and so that
 * `buildTexJob(scanTexBlocks(src))` (src/ts/tex/mpto.ts) reproduces the .tex
 * file that C `mpx_mpto` writes byte for byte. Where the C and this file
 * disagree, the C is right; test/unit/scanner.test.ts diffs the two.
 *
 * Dependency-free and browser-safe: no Node imports.
 */
export interface TexBlock {
    kind: 'btex' | 'verbatimtex';
    /**
     * The block text exactly as mpto emits it between its wrapper lines:
     * for `btex` leading and trailing whitespace is stripped; for the first
     * `verbatimtex` block of a file only leading whitespace is stripped; later
     * `verbatimtex` blocks are untouched. Line ends are normalised to "\n".
     * The `%` that mpto appends to a `btex` body in TeX mode is NOT part of
     * `body` (see `needsPercent` in mpto.ts) so the same block can be rendered
     * in troff mode too.
     */
    body: string;
    /** 1-based line of the opening keyword, counted the way mpto counts. */
    line: number;
    /** The file name the block was scanned from (used in `% line N file`). */
    file: string;
    /** Position of this block in source order, 0-based, counting both kinds. */
    index: number;
    /**
     * The untrimmed text mpto accumulated for the block (its `res` buffer),
     * before whitespace handling. Kept for callers that need the raw form.
     */
    raw: string;
    /**
     * Set when mpto would report an error for this block ("btex in TeX mode",
     * "verbatimtex in TeX mode", "btex section does not end"). mpto still
     * writes the wrapper lines for such a block but no body at all — not even
     * the `%` — and `buildTexJob` reproduces that.
     */
    error?: string;
}
export interface ScanError {
    message: string;
    /** mpto's line counter at the time of the error (1-based). */
    line: number;
    file: string;
}
export interface ScanResult {
    blocks: TexBlock[];
    /** Every "makempx error:" mpto would print, in order. */
    errors: ScanError[];
}
/**
 * Scan MetaPost source for `btex ... etex` and `verbatimtex ... etex` blocks
 * exactly as upstream mpto does, and report the errors mpto would report.
 *
 * One deliberate deviation: on an unterminated string literal upstream
 * `mpx_mpto` loops forever printing "string does not end" (its do/while
 * never advances once `mpx_getbta` has reached the end of the line). This
 * port reports the error once and treats the rest of the line as the string.
 */
export declare function scanTex(source: string, fileName: string): ScanResult;
/** The blocks of `scanTex`, for callers that do not need the error list. */
export declare function scanTexBlocks(source: string, fileName: string): TexBlock[];
/**
 * Find the file names referenced by `input name` / `input "name"` statements
 * (docs/05 §3.2). Lexical only: comments, string literals and the inside of
 * btex/verbatimtex blocks are skipped, `input` must be a whole symbolic
 * token, and the name is delimited the way `mp_scan_file_name` delimits it —
 * it ends at a space, tab, `;`, `%` or end of line unless inside quotes, and
 * the quotes themselves are not part of the name. Names are returned as
 * written, in order, without deduplication; `scantokens`-built inputs are
 * invisible to this function by design.
 */
export declare function scanInputs(source: string): string[];
