/**
 * mp-tikz-wasm — public API (docs/08). `MetaPost.create()` starts a Web
 * Worker in browsers and runs in-process in Node (or when `worker: false`).
 */
import type { MetaPostOptions, RunOptions, RunResult, ProgressEvent, BundleName, LatexRunOptions, LatexResult, PrefetchKind, LogLevel, LogRecord } from './types.js';
export * from './types.js';
export { sanitizeSvg, postProcessSvg } from './render/svg.js';
export { scanTexBlocks, scanInputs } from './tex/scanner.js';
export { parseMetaPostLog } from './diagnostics.js';
export { splitMpx } from './tex/mpx.js';
export { LOG_LEVELS, formatRecord, consoleSink } from './logger.js';
export { DEFAULT_BUNDLES } from './bundles-config.js';
export { figureHash, figureName, figureDocument, extractFigures, renderFigure, wrapTikz, wrapMetaPost, makeZip, FIGURE_FILE } from './figures.js';
export type { FigureKind, FigureRequest, FigureResult, SavedFigure, FoundFigure } from './figures.js';
export declare class MetaPost {
    private backend;
    private options;
    private listeners;
    private queue;
    private readonly t0;
    readonly version: {
        metapost: string;
        tex: string;
        build: string;
    };
    private constructor();
    static create(options?: MetaPostOptions): Promise<MetaPost>;
    /**
     * The stall watchdog (worker only): the run is killed when `timeoutMs` pass without a progress
     * event or a line of engine output. Every engine phase and every on-demand file fetch is progress,
     * so a first run on a slow host that spends a minute fetching files one after another is left
     * alone, and so is a long TeX run that is still printing; a silent, hung engine is not.
     */
    private watchdog;
    /** Events from either backend: log records reach the console (or the `logger` option), raw lines the `log` option, then any listeners. */
    private handleEvent;
    /** A record from this side of the worker boundary (a failed call, the watchdog), subject to the same level. */
    private hostRecord;
    private failing;
    /** How much reaches the console (see `MetaPostOptions.logLevel`); can be changed at any time, also mid-run. */
    get logLevel(): LogLevel;
    set logLevel(level: LogLevel);
    /** Compile MetaPost source. Calls are serialised on this instance. */
    run(source: string, options?: RunOptions): Promise<RunResult>;
    /** Typeset a whole LaTeX/TikZ (or plain TeX) document to one SVG per page. */
    latex(source: string, options?: LatexRunOptions): Promise<LatexResult>;
    addFiles(files: Record<string, string | Uint8Array>): Promise<void>;
    preload(bundles: BundleName[]): Promise<void>;
    /** Fetch in parallel the files a first run of these kinds needs (see `MetaPostOptions.prefetch`). Resolves to the number fetched. */
    prefetch(kinds: PrefetchKind[]): Promise<number>;
    clearCache(): Promise<void>;
    on(event: 'progress', fn: (e: ProgressEvent) => void): () => void;
    on(event: 'log', fn: (line: string) => void): () => void;
    on(event: 'record', fn: (r: LogRecord) => void): () => void;
    private emit;
    dispose(): void;
}
/** A pool of independent instances for batch work (docs/10 §2.3). */
export declare class MetaPostPool {
    private all;
    private idle;
    private waiters;
    private constructor();
    static create(options?: MetaPostOptions & {
        size?: number;
    }): Promise<MetaPostPool>;
    private acquire;
    private release;
    run(source: string, options?: RunOptions): Promise<RunResult>;
    dispose(): void;
}
