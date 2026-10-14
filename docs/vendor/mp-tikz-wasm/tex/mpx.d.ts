/**
 * mpx.ts — splits a `.mpx` file (dvitomp output) into one MetaPost primary
 * per typeset block (docs/05 §4.1).
 *
 * The format, as written by `mpx_run_dvitomp`:
 *
 *   % Written by metapost version 2.11        <- banner
 *   begingroup save _p,_r,_s,_n; ...          <- chunk 0
 *   _p endgroup
 *   mpxbreak
 *   begingroup ...                            <- chunk 1
 *   _p endgroup
 *   mpxbreak
 *
 * Chunk k corresponds to btex block k; each chunk is self-contained and is a
 * valid MetaPost primary, so it can be returned from `make_text` verbatim.
 */
/**
 * Drop the leading `%` banner, split on lines equal to `mpxbreak`, and return
 * the chunks. Leading and trailing empty lines of a chunk are removed (so a
 * chunk ends with `_p endgroup`, not a newline); a trailing chunk that is
 * empty or whitespace-only — the normal remainder after the final `mpxbreak`
 * — is ignored. CRLF line ends are accepted.
 */
export declare function splitMpx(mpx: string): string[];
