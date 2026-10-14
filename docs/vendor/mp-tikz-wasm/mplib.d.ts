/**
 * mplib.ts — thin, typed wrapper over the Emscripten module built from
 * src/c (mpwasm_api.h). One `MpJob` = one MP instance = one compilation
 * (docs/04 §8). Everything here is synchronous.
 */
import type { EmscriptenFS } from './vfs/lazyfs.js';
export interface MplibHooks {
    findFile?: (name: string, ftype: number, mode: string) => string | null | undefined;
    makeText?: (text: string, mode: number) => string | null | undefined;
    runScript?: (script: string) => string | null | undefined;
    /** one line of MetaPost's terminal output, as it is written (the same text `termOut` holds at the end) */
    termLine?: (line: string) => void;
}
export interface MplibModule {
    FS: EmscriptenFS;
    NODEFS?: unknown;
    MEMFS?: unknown;
    ccall(name: string, ret: string | null, argTypes: string[], args: unknown[]): any;
    cwrap(name: string, ret: string | null, argTypes: string[]): (...args: any[]) => any;
    UTF8ToString(ptr: number, max?: number): string;
    stringToNewUTF8(s: string): number;
    HEAPU8: Uint8Array;
    _malloc(n: number): number;
    _free(p: number): void;
    mpwasmHooks?: MplibHooks;
}
export type MplibFactory = (opts?: Record<string, unknown>) => Promise<MplibModule>;
/** mp_filetype enum (mplib.h) */
export declare const enum MpFtype {
    terminal = 0,
    error = 1,
    program = 2,
    log = 3,
    postscript = 4,
    bitmap = 5,
    memfile = 6,
    metrics = 7,
    fontmap = 8,
    font = 9,
    encoding = 10,
    text = 11
}
export declare const MP_FTYPE_NAMES: readonly ["terminal", "error", "program", "log", "postscript", "bitmap", "memfile", "metrics", "fontmap", "font", "encoding", "text"];
/** pseudo file types used by the dvitomp finder (mpwasm_mpx.c) */
export declare const MPX_FTYPE_TFM = 100;
export declare const MPX_FTYPE_VF = 101;
export interface MpJobOptions {
    mathMode?: 0 | 1 | 3;
    extensions?: boolean;
    interaction?: 1 | 2 | 3;
    haltOnError?: boolean;
    randomSeed?: number;
    memName?: string;
    jobName?: string;
    banner?: string;
    recorder?: boolean;
    troff?: boolean;
    fileLineErrorStyle?: boolean;
    searchPaths?: Partial<Record<number, string[]>>;
}
export declare class MpJob {
    readonly M: MplibModule;
    private ctx;
    private freed;
    history: number;
    constructor(M: MplibModule, opts?: MpJobOptions);
    /** Run ONE line of MetaPost (normally "input job"). Returns history 0..4. */
    run(commands: string): number;
    get termOut(): string;
    get logOut(): string;
    get errorOut(): string;
    get lastError(): string;
    get openedFiles(): {
        name: string;
        type: number;
        path: string;
    }[];
    get figureCount(): number;
    charcode(i: number): number;
    dims(i: number): {
        bbox: [number, number, number, number];
        width: number;
        height: number;
        depth: number;
        italicCorrection: number;
        prologues: number;
        procset: number;
    };
    /** CONTRACT: each call re-renders and copies out immediately (drain rule). */
    /** prologues -1 = the document's value at shipout time (patch 0009) */
    svg(i: number, prologues?: number): string | null;
    ps(i: number, prologues?: number, procset?: number): string | null;
    json(i: number): string | null;
    /** Evaluate a numeric expression in the finished job's state (e.g. an internal like "prologues"). */
    numeric(expr: string): number;
    string(expr: string): string | null;
    free(): void;
}
export declare function mplibVersion(M: MplibModule): string;
export declare function mplibBuildId(M: MplibModule): string;
/** Run mpto (btex extraction) inside mplib.wasm: returns 0 on success. */
export declare function mpto(M: MplibModule, mpPath: string, texPath: string, mptexpre?: string | null, troff?: boolean): number;
/** Run dvitomp inside mplib.wasm: returns 0 on success. */
export declare function dvitomp(M: MplibModule, dviPath: string, mpxPath: string, banner?: string): number;
export declare function mpxAddPath(M: MplibModule, dir: string): void;
export declare function mpxLastError(M: MplibModule): string;
