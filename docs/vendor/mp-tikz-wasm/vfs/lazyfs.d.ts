/**
 * lazyfs.ts — lazily-loaded files in the Emscripten MEMFS (docs/06 §4.3).
 *
 * A lazy file is a real MEMFS node whose size is known up front (so that
 * stat(), readdir() and kpathsea's ls-R walks work) and whose bytes are
 * fetched synchronously the first time anything reads it. The loader must be
 * synchronous: a sync XMLHttpRequest inside a Web Worker, or fs.readFileSync
 * in Node. On the browser main thread there is no synchronous loader, so the
 * caller must prefetch (see bundle.ts).
 */
export interface EmscriptenFS {
    mkdir(path: string, mode?: number): void;
    writeFile(path: string, data: Uint8Array | string, opts?: {
        encoding?: string;
    }): void;
    readFile(path: string, opts?: {
        encoding?: 'binary' | 'utf8';
    }): Uint8Array | string;
    analyzePath(path: string): {
        exists: boolean;
        object?: any;
        isRoot?: boolean;
    };
    createFile(parent: string, name: string, properties: object, canRead: boolean, canWrite: boolean): any;
    lookupPath(path: string, opts?: object): {
        node: any;
    };
    unlink(path: string): void;
    readdir(path: string): string[];
    stat(path: string): {
        size: number;
        mode: number;
        mtime: Date;
    };
    isDir(mode: number): boolean;
    isFile(mode: number): boolean;
    chdir(path: string): void;
    cwd(): string;
    mount(type: unknown, opts: object, mountpoint: string): void;
    utime?(path: string, atime: number, mtime: number): void;
    [k: string]: any;
}
export type LazyLoader = (path: string) => Uint8Array;
/** mkdir -p */
export declare function mkdirp(FS: EmscriptenFS, dir: string): void;
/** Create a lazy node at `path` with the given size. Returns false if a file already exists there. */
export declare function createLazyFile(FS: EmscriptenFS, path: string, size: number, load: LazyLoader): boolean;
/** True if `path` is a lazy node that has not been fetched yet. */
export declare function isUnloadedLazy(FS: EmscriptenFS, path: string): boolean;
/** Force-load a lazy node (no-op for ordinary files). */
export declare function ensureLoaded(FS: EmscriptenFS, path: string): void;
/** Write a text or binary file, creating directories as needed. */
export declare function writeFileDeep(FS: EmscriptenFS, path: string, data: Uint8Array | string): void;
/** Recursively collect regular files under `dir` (used to harvest artifacts). */
export declare function listFiles(FS: EmscriptenFS, dir: string): string[];
