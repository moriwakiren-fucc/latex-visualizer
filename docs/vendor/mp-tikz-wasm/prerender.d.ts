import { MetaPost } from './index.js';
import type { MetaPostOptions } from './types.js';
import type { FigureKind, FigureRequest } from './figures.js';
export interface PrerenderOptions {
    /** Write every page's figures here instead of the directory each page names. */
    figuresDir?: string;
    /** Re-render figures whose file exists. */
    force?: boolean;
    /** Report what would be rendered and write nothing. */
    dryRun?: boolean;
    /** Resolve each page's data-figures against this directory instead of the page's own. */
    baseDir?: string;
    /** An engine to use for every page (disposed by the caller; the pages' data-bundles are then
     *  not applied); otherwise one is created per bundle list with `createOptions` and disposed. */
    mp?: MetaPost;
    /** `bundles` here overrides the pages' data-bundles for every page. */
    createOptions?: MetaPostOptions;
    /** Bundles added to every page's list (the CLI's --opentype). */
    addBundles?: string[];
    /** One line per figure as it is decided (default: nothing). */
    report?: (line: string) => void;
}
export type PrerenderStatus = 'rendered' | 'exists' | 'failed' | 'pending';
export interface PrerenderEntry {
    page: string;
    file: string;
    name: string;
    hash: string;
    kind: FigureKind;
    status: PrerenderStatus;
    ms?: number;
    diagnostics?: {
        severity: string;
        message: string;
        line?: number;
    }[];
}
export interface PrerenderSummary {
    entries: PrerenderEntry[];
    rendered: number;
    existing: number;
    failed: number;
}
/** The figures a page needs, with the directory they belong in. */
export declare function planPage(page: string, figuresDir?: string, baseDir?: string): {
    dir: string;
    bundles?: string[];
    figures: (FigureRequest & {
        hash: string;
        name: string;
    })[];
};
export declare function prerender(pages: string[], opts?: PrerenderOptions): Promise<PrerenderSummary>;
/** `figures/figure-abc123.svg  tikz      rendered  312 ms  (tags.html)`, diagnostics indented under a failure. */
export declare function line(e: PrerenderEntry): string;
