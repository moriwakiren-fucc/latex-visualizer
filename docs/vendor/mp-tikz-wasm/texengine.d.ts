/**
 * texengine.ts — one invocation of tex.wasm (pdfTeX in DVI mode). A fresh
 * module instance per run (docs/01 §1.2): web2c TeX is not reentrant.
 */
import type { EmscriptenFS } from './vfs/lazyfs.js';
export interface TexModule {
    FS: EmscriptenFS;
    NODEFS?: unknown;
    ENV: Record<string, string>;
    callMain(args: string[]): number | undefined;
}
export type TexFactory = (opts?: Record<string, unknown>) => Promise<TexModule>;
export interface TexRunOptions {
    /** e.g. ['-ini', '-etex', '-jobname=latex', 'latex.ini'] */
    args: string[];
    /** called after the FS exists and before main(): mount/install the texmf tree, write inputs */
    setup: (M: TexModule) => void;
    /** called after main() returned, while the FS is still alive: read outputs */
    collect?: (M: TexModule) => void;
    env?: Record<string, string>;
    onLine?: (line: string) => void;
    /** argv[0] as the engine sees it; default '/bin/pdftex' (luatex.wasm: '/bin/luatex') */
    program?: string;
}
export interface TexRunResult {
    exitCode: number;
    log: string;
    ms: number;
    setupMs: number;
    mainMs: number;
}
export declare function runTex(factory: TexFactory, opts: TexRunOptions): Promise<TexRunResult>;
