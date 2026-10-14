/**
 * bridge.ts — the TeX Bridge (docs/05): lift TeX out of the MetaPost run.
 *
 *   scan → keys → cache → batch TeX (tex.wasm) → dvitomp (mplib.wasm) → split
 *
 * The bridge never runs inside make_text; it fills the snippet cache before
 * a MetaPost run and again between fixpoint iterations.
 */
import type { TexBlock } from './scanner.js';
import { type TexFactory, type TexModule } from '../texengine.js';
import { type MplibModule } from '../mplib.js';
import type { Diagnostic, TexEngine } from '../types.js';
export interface Snippet {
    key: string;
    chain: string[];
    body: string;
    line?: number;
    file?: string;
}
export interface SnippetCache {
    get(key: string): string | undefined;
    set(key: string, chunk: string): void;
    clear(): void;
    readonly size: number;
}
export declare class MemorySnippetCache implements SnippetCache {
    private m;
    get(k: string): string | undefined;
    set(k: string, v: string): void;
    clear(): void;
    get size(): number;
}
/** Canonical form of a snippet body for cache keys: whitespace runs collapsed,
 *  trimmed. mplib hands make_text a trimmed, newline-to-space converted body
 *  (texscriptmode=1) while the pre-scan sees the raw text; both map here. */
export declare function canonicalBody(s: string): string;
export type ResolvedEngine = 'plain' | 'etex' | 'latex';
export interface EngineInfo {
    engine: ResolvedEngine;
    format: string;
    progname: string;
    formatId: string;
    engineId: string;
}
export declare function resolveEngine(engine: TexEngine, blocks: TexBlock[], source: string): ResolvedEngine | 'none';
export interface BridgeOptions {
    texFactory: TexFactory;
    mplib: MplibModule;
    /** prepare a fresh tex.wasm FS: mount/install /texmf, create /work */
    setupTexFS: (M: TexModule) => void;
    cache: SnippetCache;
    texPreamble?: string;
    workDir?: string;
    onLine?: (line: string) => void;
    engineId: string;
    formatIds: Record<ResolvedEngine, string>;
}
export interface TypesetResult {
    texLog: string;
    exitCode: number;
    ms: number;
    pages: number;
    diagnostics: Diagnostic[];
    resolved: number;
}
export declare class TexBridge {
    private o;
    constructor(o: BridgeOptions);
    key(engine: ResolvedEngine, chain: string[], body: string): string;
    /**
     * Given the ordered blocks of a document, return the snippets whose chunk is
     * not cached (with their verbatimtex chain), in source order.
     */
    misses(engine: ResolvedEngine, blocks: TexBlock[]): {
        hits: number;
        misses: Snippet[];
        chainFor: Map<number, string[]>;
    };
    /**
     * Typeset a list of snippets in ONE TeX run and store the resulting chunks.
     * Snippets must be in source order; chains are emitted incrementally.
     */
    typeset(engine: ResolvedEngine, snippets: Snippet[]): Promise<TypesetResult>;
}
/**
 * Map TeX errors back to btex blocks: the generated .tex has one
 * `\mpxshipout% line N file` wrapper line per block; a TeX `l.<n>` line number
 * inside [wrapper, \stopmpxshipout] belongs to that block.
 */
export declare function parseTexLog(log: string, tex: string, blocks: {
    block: TexBlock;
    snippet: Snippet;
}[]): Diagnostic[];
