/**
 * cache-key.ts — content-addressed keys for the two TeX-bridge caches
 * (docs/05 §6): L2 snippet keys and L1 document keys.
 *
 * Both are SHA-256 over a canonical, length-prefixed encoding, so no two
 * distinct inputs can collide by concatenation ("ab"+"c" vs "a"+"bc"), and a
 * snippet key can never equal a document key (each kind carries its own tag).
 *
 * The digest is computed by a small pure-TypeScript SHA-256 rather than
 * `crypto.subtle.digest`, because the `make_text` hook that consults the
 * snippet cache must answer synchronously and Web Crypto is Promise-only.
 * Dependency-free and browser-safe.
 */
export interface SnippetKeyParts {
    /** Build id of tex.wasm. */
    engineId: string;
    /** Hash of the format file (plain.fmt / latex.fmt). */
    formatId: string;
    /** The verbatimtex blocks that precede the snippet, in source order. */
    chain: readonly string[];
    /** The btex text as handed to make_text. */
    body: string;
    /** MetaPost's `texscriptmode` internal; defaults to 1 like MetaPost. */
    texscriptmode?: number;
}
/** L2 key: H(engineId, formatId, verbatimtex chain, body, texscriptmode). */
export declare function snippetKey(parts: SnippetKeyParts): string;
/** L1 key: H(full generated .tex, engineId, formatId). */
export declare function documentKey(texSource: string, engineId: string, formatId: string): string;
/** SHA-256 of `data` (a string is UTF-8 encoded first) as lowercase hex. */
export declare function sha256Hex(data: Uint8Array | string): string;
/** SHA-256 of `msg`, as 32 bytes. */
export declare function sha256(msg: Uint8Array): Uint8Array;
