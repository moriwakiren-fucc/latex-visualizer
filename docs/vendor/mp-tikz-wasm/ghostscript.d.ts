/**
 * ghostscript.ts — Ghostscript for dvisvgm, as a module of its own.
 *
 * dvisvgm interprets PostScript specials (PSTricks, EPS images, `ps:` code,
 * graphicx's rotation and scaling under its dvips driver) through Ghostscript's
 * C API. dvisvgm.wasm asks for "libgs" with dlopen, and src/c/gs-bridge.c
 * answers with gsapi_* proxies that call Module.gsBridge, the object built
 * here. It forwards each call to a separate Ghostscript wasm module
 * (vendor/GHOSTSCRIPT.lock, served from dist/ghostscript/), copying buffers
 * between the two heaps. Ghostscript is never linked into dvisvgm.wasm, and it
 * is loaded only by a document whose DVI carries PostScript worth running
 * (postscript.ts), only when the `ghostscript` bundle is enabled.
 *
 * Ghostscript opens files itself (an EPS goes in as `(fig.eps) run`), so for
 * each dvisvgm run its /work and /texmf are mounted into the Ghostscript
 * module with Emscripten's PROXYFS. One module serves every document in turn:
 * gsapi_new_instance ... gsapi_delete_instance per dvisvgm run, never two at
 * once (a non-threaded Ghostscript refuses a second live instance).
 */
/** The Emscripten module of the Ghostscript port (its gs.js), as far as it is used here. */
export interface GhostscriptModule {
    HEAPU8: Uint8Array;
    FS: any;
    PROXYFS: any;
    _malloc(n: number): number;
    _free(p: number): void;
    addFunction(fn: (...args: number[]) => number, sig: string): number;
    stringToUTF8(s: string, ptr: number, max: number): void;
    lengthBytesUTF8(s: string): number;
    _gsapi_revision(p: number, len: number): number;
    _gsapi_new_instance(pinstance: number, caller: number): number;
    _gsapi_delete_instance(instance: number): void;
    _gsapi_set_stdio(instance: number, stdin: number, stdout: number, stderr: number): number;
    _gsapi_init_with_args(instance: number, argc: number, argv: number): number;
    _gsapi_run_string_begin(instance: number, userErrors: number, pexit: number): number;
    _gsapi_run_string_continue(instance: number, str: number, length: number, userErrors: number, pexit: number): number;
    _gsapi_run_string_end(instance: number, userErrors: number, pexit: number): number;
    _gsapi_exit(instance: number): number;
}
export type GhostscriptFactory = (moduleArg: Record<string, unknown>) => Promise<GhostscriptModule>;
/** What gs-bridge.js calls, on Module.gsBridge of a dvisvgm instance. */
export interface GsBridge {
    available(): boolean;
    revision(): [number, number];
    newInstance(): number;
    init(args: string[]): number;
    run(op: 0 | 1 | 2, bytes: Uint8Array | null, userErrors: number): [number, number];
    exit(): number;
    deleteInstance(): void;
    take(stream: 1 | 2, max: number): Uint8Array | null;
}
export declare class Ghostscript {
    private readonly M;
    private instance;
    private readonly out;
    private readonly cell;
    private buf;
    private bufSize;
    private readonly fns;
    private mounted;
    /** set when the module trapped: it is not used again, and the engine loads a fresh one */
    broken: boolean;
    private constructor();
    /** Instantiate the module from a compiled gs.wasm. */
    static create(factory: GhostscriptFactory, wasm: WebAssembly.Module): Promise<Ghostscript>;
    private view;
    /** Give Ghostscript dvisvgm's files: its /work (the cwd) and its /texmf. */
    mount(dvisvgmFS: any, dirs: string[]): void;
    unmount(): void;
    /** Run fn against the module; a trap marks it broken and becomes a Ghostscript fatal error. */
    private guard;
    bridge(): GsBridge;
}
export declare function compileGhostscript(key: string, bytes: () => Promise<Uint8Array>): Promise<WebAssembly.Module>;
/**
 * A lazy loader for one engine: nothing is fetched until a document needs
 * Ghostscript; then the glue is imported, gs.wasm compiled (once per process)
 * and a module instantiated, which serves later documents too. A module that
 * trapped is replaced. If loading fails, it says so once and returns null, so
 * documents still render, with a warning, as without Ghostscript.
 */
export declare function ghostscriptLoader(o: {
    glueUrl: string;
    wasmUrl: string;
    fetch: (url: string) => Promise<Uint8Array>;
    factory?: GhostscriptFactory;
    log?: (message: string) => void;
}): () => Promise<Ghostscript | null>;
/** Whether these options turn Ghostscript on: the option itself, or the `ghostscript` bundle in the list. */
export declare function ghostscriptWanted(ghostscript: boolean | undefined, bundles: (string | {
    name: string;
})[]): boolean;
