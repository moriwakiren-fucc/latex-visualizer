/**
 * bundle.ts — texmf bundles: manifest + files (docs/06 §3–§4).
 *
 * A bundle is a directory (or URL prefix) holding `manifest.json` and the
 * files themselves under `files/<relative path>`. The BundleSet merges any
 * number of bundles into one virtual texmf tree rooted at /texmf.
 *
 * Loading strategies:
 *   - Node:   files are read with fs.readFileSync on demand (always sync).
 *   - Worker: files are fetched with a synchronous XMLHttpRequest on demand.
 *   - Main thread: no sync I/O; everything reachable is prefetched with
 *     fetch() by `prefetchAll()` before the engine runs.
 */
import type { BundleManifest, BundleSpec } from '../types.js';
import { type EmscriptenFS } from './lazyfs.js';
import { Logger } from '../logger.js';
export interface BundleFile {
    bundle: string;
    path: string;
    size: number;
    sha?: string;
    url: string;
}
export interface BundleIO {
    /** async fetch of bytes */
    fetch(url: string): Promise<Uint8Array>;
    /** sync fetch of bytes, or undefined if this environment cannot do sync I/O */
    fetchSync?: (url: string) => Uint8Array;
    /** fetch + parse JSON */
    fetchJson(url: string): Promise<unknown>;
}
export declare const TEXMF_ROOT = "/texmf";
export declare class BundleSet {
    private io;
    readonly files: Map<string, BundleFile>;
    readonly byName: Map<string, BundleFile[]>;
    readonly manifests: {
        spec: BundleSpec;
        manifest: BundleManifest;
        base: string;
    }[];
    private cache;
    private negative;
    /** The files a first run of each kind touches (`bundles/hot.json`, written by scripts/make-hotlists.mjs). */
    hot: Record<string, string[]>;
    /** Where fetches are reported: prefetch summaries at info, on-demand loads at debug, every file at trace. */
    logger: Logger;
    constructor(io: BundleIO);
    /** Load a manifest; `spec.manifestUrl` is the bundle directory/URL (containing manifest.json). */
    add(spec: BundleSpec): Promise<void>;
    private addLoaded;
    /** Add several bundles: the manifests are fetched in parallel, then merged in the given order (first bundle wins). */
    addAll(specs: BundleSpec[]): Promise<void>;
    /** Load the hot lists; optional, so a missing file is not an error. */
    loadHot(url: string): Promise<void>;
    /** Fetch, in parallel, every file the hot lists name for these kinds that is not in memory yet. Returns how many. */
    prefetchHot(kinds: string[], concurrency?: number): Promise<number>;
    /** Every manifest's `eager` list, fetched into memory. */
    prefetchEager(): Promise<void>;
    /** Fetch every file in the set (for environments without sync I/O). */
    prefetchAll(filter?: (f: BundleFile) => boolean): Promise<void>;
    fetchAsync(f: BundleFile): Promise<Uint8Array>;
    /** Synchronous bytes for a file: from memory, else via fetchSync. Throws if impossible. */
    fetchSyncFile(f: BundleFile): Uint8Array;
    get canFetchSync(): boolean;
    has(path: string): boolean;
    /**
     * Materialise the tree in the Emscripten FS under /texmf, plus an ls-R
     * database so kpathsea never has to walk directories. Directories are
     * created on demand: the root gets a lookup hook that creates a child
     * directory or a lazy file the first time anything asks for it, so a run
     * pays for the handful of files it touches, not for the whole tree
     * (installing every node eagerly cost ~60 ms per TeX run).
     */
    install(FS: EmscriptenFS, root?: string): void;
    private lsRText?;
    private indexCache?;
    /** directory -> immediate children, for the on-demand tree */
    private index;
    /** kpathsea ls-R database text for the merged tree. */
    lsR(): string;
    /** Find bundle files by bare name (e.g. "cmr10.tfm"), optionally restricted to a directory prefix. */
    lookup(name: string, prefixes?: string[]): BundleFile | undefined;
    noteMiss(key: string): void;
    isMiss(key: string): boolean;
}
/** Browser I/O: fetch() plus a synchronous XHR that only works inside a Worker. */
export declare function browserIO(): BundleIO;
