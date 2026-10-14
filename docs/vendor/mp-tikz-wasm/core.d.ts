/**
 * core.ts — the orchestrator (docs/01 §3). Runs in a Worker (browser) or on
 * the main thread (Node). Owns one mplib.wasm instance for its lifetime and
 * creates one tex.wasm instance per TeX invocation.
 */
import { type MplibModule, type MplibFactory } from './mplib.js';
import { type TexFactory } from './texengine.js';
import { type DvisvgmFactory } from './dvisvgm.js';
import type { Ghostscript } from './ghostscript.js';
import { BundleSet } from './vfs/bundle.js';
import { Logger } from './logger.js';
import type { MetaPostOptions, RunOptions, RunResult, Diagnostic, ProgressEvent, LatexRunOptions, LatexResult } from './types.js';
/** The local references (href="#id") in an SVG that name no element in it. */
export declare function danglingRefs(svg: string): string[];
/** Where MetaPost looks for each file type (docs/06 §2). */
export declare const SEARCH_PATHS: Record<number, string[]>;
export interface CoreEnv {
    mplibFactory: MplibFactory;
    texFactory?: TexFactory;
    /** luatex.wasm, same module interface as tex.wasm; needed for engine 'lualatex' / 'luatex' */
    luatexFactory?: TexFactory;
    dvisvgmFactory?: DvisvgmFactory;
    /** the Ghostscript module for dvisvgm's PostScript (ghostscript.ts), when enabled; null if it cannot be loaded */
    ghostscript?: () => Promise<Ghostscript | null>;
    /** bundles merged into /texmf (browser, or Node without texmfDir) */
    bundles?: BundleSet;
    /** Node: real directory mounted at /texmf with NODEFS */
    texmfDir?: string;
    options: MetaPostOptions;
    onProgress?: (e: ProgressEvent) => void;
    onLog?: (line: string) => void;
    /** where every part of a run reports (docs/08 §4); silent if absent */
    logger?: Logger;
}
export declare class MetaPostCore {
    private env;
    M: MplibModule;
    private cache;
    private bridge?;
    readonly version: {
        metapost: string;
        tex: string;
        build: string;
    };
    private userFiles;
    /**
     * luaotfload's font cache (TEXMF_VAR), carried from one LuaTeX run to the
     * next. Parsing an OpenType face costs about a second, and every TeX run
     * gets a fresh filesystem, so without this each render pays that again.
     */
    private texmfVar;
    private get logger();
    constructor(env: CoreEnv);
    init(): Promise<void>;
    private progress;
    /** The errors and warnings of a finished run, one record each; a MetaPost help paragraph is indented under its error. */
    private report;
    private formatId;
    private installTexmf;
    /** Restore the font cache this instance has accumulated (LuaTeX runs only). */
    private installTexmfVar;
    /**
     * Start the font cache from the prebuilt name database, if the tree has one
     * (the `opentype` bundle, or a mounted texmfDir built by make-fontdb). Its
     * paths are the /texmf ones every instance sees; luaotfload checks only the
     * index version, and rescans by itself when a lookup misses.
     */
    private seedFontDb;
    /** Keep whatever luaotfload wrote, so the next run starts warm. */
    private collectTexmfVar;
    private copyUserFiles;
    /** Last-chance file resolution when the C search failed: consult bundles, then the user hook. */
    private findFile;
    private findFileImpl;
    private chain;
    private misses;
    private stats;
    private engine;
    private texDiagnostics;
    private makeText;
    private runScript;
    addFiles(files: Record<string, string | Uint8Array>): void;
    clearCache(): void;
    run(source: string, ro?: RunOptions): Promise<RunResult>;
    private lastTexLog;
    private recentOutput;
    /**
     * Typeset a complete LaTeX (or plain TeX) document with tex.wasm and convert
     * every page to SVG with dvisvgm.wasm — the TikZ/PGF pipeline. Text becomes
     * glyph outlines unless fonts: 'woff2' is requested.
     */
    latex(source: string, lo?: LatexRunOptions): Promise<LatexResult>;
    private hasSnapshot;
    private typeset;
    private runMetaPost;
    /**
     * Scan the job and every `input`-ed file reachable from it (lexically),
     * splicing each input file's blocks in at the line of the `input` statement
     * so the verbatimtex chain seen by the pre-scan matches the run's order.
     */
    private scanAll;
    private resolveInput;
}
/** Errors (`! ...` + `l.N`) and package warnings from a TeX transcript, attributed to the document. */
export declare function parseTexLogDocument(log: string, file: string): Diagnostic[];
/** Does a LaTeX source need LuaTeX? (TikZ graphdrawing, \directlua, luacode.) Used by engine 'auto'. */
export declare function needsLuaTeX(source: string): boolean;
