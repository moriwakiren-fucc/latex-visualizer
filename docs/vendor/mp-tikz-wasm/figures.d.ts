/**
 * figures.ts — a diagram element's identity and rendering, shared by the
 * drop-in tags (auto.ts) and the Node pre-renderer (prerender.ts, behind
 * `mpost-wasm --prerender`). Nothing here touches the DOM or Node's APIs.
 *
 * A figure is identified by `figureHash()`: six lowercase base-36 characters
 * of the SHA-256 of its kind, the attributes that change the output and the
 * wrapped document. The hash names the saved file (`figure-HASH.svg`), the
 * IndexedDB entry and the SVG id prefix (`mpwHASH-`), so a saved figure is
 * self-contained and drops into any page. The engine build is deliberately
 * left out: the hash identifies the source, and a saved file survives a
 * library upgrade (the output is byte-identical to TeX Live, so an upgrade
 * that changes it is a rare, deliberate event — re-run the pre-renderer with
 * --force). Two figures collide only if six characters of their digests
 * agree, which for a page of figures is a chance of about one in a million.
 */
import type { MetaPost } from './index.js';
export type FigureKind = 'tikz' | 'metapost';
/** What a diagram element contributes: its kind, its text and its attributes (`data-` stripped). */
export interface FigureRequest {
    kind: FigureKind;
    source: string;
    attrs: Record<string, string>;
}
/** ms is the engine's own time for this figure (queueing and engine start-up excluded). */
export interface FigureResult {
    svg: string;
    log: string;
    diagnostics: {
        severity: string;
        message: string;
        line?: number;
    }[];
    ok: boolean;
    ms: number;
}
/** A rendered figure as the tags keep it for `saveFigures()`. */
export interface SavedFigure {
    name: string;
    hash: string;
    kind: FigureKind;
    source: string;
    svg: string;
}
/** Is this TikZ text a complete document (LaTeX with \documentclass, or plain TeX ending in \bye) rather than a body to wrap? */
export declare function isCompleteDocument(source: string): boolean;
/** Wrap a TikZ body in a standalone document unless it already is one. */
export declare function wrapTikz(source: string, attrs?: Record<string, string>): string;
/**
 * Wrap a MetaPost body in one figure unless it already has beginfig/endfig.
 * `input` statements are hoisted out of the figure: `input boxes` inside a
 * figure group makes MetaPost (native mpost too) recurse until its input stack
 * overflows, and macro packages are meant to be loaded at top level anyway.
 */
export declare function wrapMetaPost(source: string, attrs?: Record<string, string>): string;
/** The document the engines are given for an element. */
export declare function figureDocument(req: FigureRequest): string;
/** Six lowercase base-36 characters identifying a figure (see the header). */
export declare function figureHash(req: FigureRequest): string;
/** `figure-HASH.svg`. */
export declare function figureName(hash: string): string;
/** Matches a saved figure's file name; group 1 is the hash. */
export declare const FIGURE_FILE: RegExp;
/** Does this text start like an SVG document (a server that answers every path with its index page does not)? */
export declare function isSvg(text: string): boolean;
/** Typeset one figure with the engine; the ids are prefixed with its hash so the SVG stands alone. */
export declare function renderFigure(mp: MetaPost, req: FigureRequest, hash?: string): Promise<FigureResult>;
/** A diagram element found in a page, with the tag it came from and its offset in the HTML. */
export interface FoundFigure extends FigureRequest {
    tag: string;
    offset: number;
}
/** Decode the entities an HTML parser would in text and attribute values. */
export declare function decodeEntities(s: string): string;
/** Attributes of an opening tag, `data-` stripped, as the tags see them (`attrsOf` in auto.ts). */
export declare function parseAttributes(s: string): Record<string, string>;
/** Every diagram element in a page, in document order. */
export declare function extractFigures(html: string): FoundFigure[];
/** The `data-*` attributes of the page's auto.js loader tag (`data-figures` → `figures`), or {} if there is none. */
/**
 * A loader's data-bundles as a bundle list: names prefixed with + are added to the
 * defaults (`+opentype`), a bare list replaces them; mixing the two is a replace
 * with the +names appended. undefined when the attribute is absent or empty. The
 * one parser for auto.js and the pre-renderer, so they can never load different sets.
 */
export declare function bundleList(spec: string | undefined, defaults: readonly string[]): string[] | undefined;
export declare function loaderAttributes(html: string): Record<string, string>;
export declare function crc32(data: Uint8Array): number;
export declare function makeZip(files: {
    name: string;
    data: string | Uint8Array;
}[]): Uint8Array<ArrayBuffer>;
