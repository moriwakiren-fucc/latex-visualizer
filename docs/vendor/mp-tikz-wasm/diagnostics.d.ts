/**
 * diagnostics.ts — parses MetaPost's Knuthian error format (docs/08 §3.1)
 * out of terminal or transcript output into structured diagnostics.
 *
 * What MetaPost prints (mp.w: `mp_print_err`, `mp_show_context`, `mp_error`,
 * `mp_warn`), verified against MetaPost 2.11:
 *
 *   >> x1                                  <- optional "diagnostic" values
 *   ! Undefined x coordinate has been replaced by 0.
 *   <to be read again>                     <- context: pairs of lines. The
 *                      ;                      first names the input level and
 *   --->{                                     shows the text read so far; the
 *        curl1}..{curl1}                      second is indented to the error
 *   l.4 draw z1--                             point and shows what follows.
 *                 z2;
 *   I need a `known' x value for this part of the path.   <- help, only in
 *   ...                                                      the transcript
 *                                          <- blank line ends the help
 *
 * With `file_line_error_style` the first line is `./job.mp:4: message`
 * instead. Fatal errors are `! Emergency stop.` whose help holds the
 * `*** (job aborted, ...)` reason. Warnings are `Warning: message`.
 *
 * The current file is tracked from MetaPost's `(path` / `)` open-file
 * tokens on ordinary output lines (an approximation, since user `message`
 * output can contain parentheses too).
 *
 * Dependency-free and browser-safe.
 */
export interface Diagnostic {
    severity: 'error' | 'warning';
    source: 'metapost' | 'tex' | 'bundle' | 'host';
    message: string;
    /** MetaPost's help paragraph, when present (transcript output has it). */
    help?: string[];
    file?: string;
    /** 1-based line from the `l.N` context line. */
    line?: number;
    /** 0-based column of the error point on that line, when it can be
     * recovered exactly (MetaPost truncates long context with `...`). */
    column?: number;
    /** For TeX errors: the btex block. */
    snippet?: string;
    /** The raw context lines MetaPost printed under the message, in order,
     * preceded by any `>> value` lines that introduced the error. */
    context?: string[];
}
/**
 * Parse MetaPost terminal (or transcript) output into diagnostics, in the
 * order they were printed. Works on `term_out` (no help text) and on the
 * `.log` (with help text) alike.
 */
export declare function parseMetaPostLog(termOut: string): Diagnostic[];
