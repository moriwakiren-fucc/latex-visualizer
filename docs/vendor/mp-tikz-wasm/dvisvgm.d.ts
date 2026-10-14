/**
 * dvisvgm.ts — one invocation of dvisvgm.wasm (DVI → SVG, with PGF/TikZ
 * special support). A fresh instance per run, like tex.wasm.
 */
import type { TexModule, TexFactory } from './texengine.js';
export type DvisvgmModule = TexModule;
export type DvisvgmFactory = TexFactory;
export interface DvisvgmRunOptions {
    args: string[];
    setup: (M: DvisvgmModule) => void;
    collect?: (M: DvisvgmModule) => void;
    onLine?: (line: string) => void;
    /** extra properties for the module object, e.g. gsBridge (ghostscript.ts) */
    module?: Record<string, unknown>;
}
export declare function runDvisvgm(factory: DvisvgmFactory, opts: DvisvgmRunOptions): Promise<{
    exitCode: number;
    log: string;
    ms: number;
}>;
