/**
 * mpto.ts — builds the batched TeX job from scanned blocks (docs/05 §3.1, §4).
 *
 * `buildTexJob` reproduces byte for byte the file that upstream `mpx_mpto`
 * (texk/web2c/mplibdir/mpxout.w) writes for the same input. The string
 * tables below are copied verbatim from mpxout.w — including their printf
 * escapes, which `cfmt` interprets — so a future upstream change can be
 * diffed against them directly.
 */
import type { TexBlock } from './scanner.js';
export type MptoMode = 'tex' | 'troff';
/**
 * How the C library rendered the malformed conversion `%\n` that upstream's
 * `mpx_pretex1` contains twice (`\bgroup%\n` and `\bgroup}%\n` — a printf
 * format with `%` followed by a newline). The C standard leaves it undefined
 * and libcs differ, so `mpost` binaries differ too:
 *
 *  - `glibc` (Linux): `printf_unknown` prints the spec verbatim, so the `%`
 *    survives as the TeX comment the author intended. The default.
 *  - `bsd` (Apple libc, FreeBSD): "pretend it was %c with argument ch", so
 *    the `%` vanishes and only the newline is printed.
 *  - musl (Emscripten's libc) rejects the format and prints *nothing* for
 *    that fprintf — the whole prologue and the first `\mpxshipout% line`
 *    are missing — which is why the wasm build must not call the C mpto.
 *
 * TeX skips the end-of-line space after the control word `\bgroup`, so the
 * DVI and the .mpx are identical for both renderings.
 */
export type PrintfLibc = 'glibc' | 'bsd';
export interface BuildTexJobOptions {
    /** TeX (default) or troff output. Index 0 / 1 of the string tables. */
    mode?: MptoMode;
    /** Contents of the MPTEXPRE file (docs/05 §9); prepended as-is in TeX mode
     * only, exactly as upstream copies the file — no newline is added. */
    mptexpre?: string;
    /** Which libc's rendering of the `%\n` quirk to reproduce; default 'glibc'. */
    libc?: PrintfLibc;
}
/**
 * mpto's "put no % at end if it's only 1 line total, starting with %" rule
 * (the `%&format` special case): after trimming, a btex body gets a `%`
 * appended unless it is a single line that begins with `%`. An empty body
 * gets one too.
 */
export declare function needsPercent(body: string): boolean;
/**
 * Emit the TeX (or troff) job for `blocks`, in source order. Blocks may come
 * from several files (their `file` and `line` are used for the
 * `% line N file` wrapper comments); the "first btex" / "first verbatimtex"
 * bookkeeping is per job, as it is per mpto run upstream.
 */
export declare function buildTexJob(blocks: readonly TexBlock[], options?: BuildTexJobOptions): string;
/**
 * DVI page `pageIndex` (0-based) was produced by the `pageIndex`-th `btex`
 * block of the job: every btex block ships out exactly one page, in source
 * order, and verbatimtex blocks ship nothing (docs/05 §3.1). Blocks that
 * mpto flagged with an error still get a (blank) page. Returns undefined
 * when the DVI has more pages than the job has btex blocks.
 */
export declare function blockForPage(blocks: readonly TexBlock[], pageIndex: number): TexBlock | undefined;
