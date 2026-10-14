/**
 * node.ts — Node-specific glue: synchronous bundle I/O from the local
 * filesystem and module loading relative to this package.
 */
import type { BundleIO } from './vfs/bundle.js';
export declare function nodeIO(): Promise<BundleIO>;
export declare const isNode: boolean;
