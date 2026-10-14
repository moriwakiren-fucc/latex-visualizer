import type { MetaPostOptions, LogLevel } from './types.js';
import { figureHash, figureName, wrapTikz, wrapMetaPost } from './figures.js';
import type { FigureRequest, FigureResult, SavedFigure } from './figures.js';
export { wrapTikz, wrapMetaPost, figureHash, figureName };
export type { FigureRequest as RenderRequest, SavedFigure };
/** Where the SVG came from: the IndexedDB result cache, a saved figure file, or the engines. */
export type RenderSource = 'cache' | 'file' | 'engine';
/** ms is the engine's own time for this diagram (queueing and engine start-up excluded). */
export interface RenderOutput extends FigureResult {
    cached: boolean;
    from: RenderSource;
    hash: string;
    name: string;
}
export interface AutoOptions extends MetaPostOptions {
    /** false: neither read nor write the IndexedDB result cache (data-cache="off" on the loader). */
    cacheResults?: boolean;
    /** Base URL of the saved figures (`figure-HASH.svg`), looked up before the engines start (data-figures on the loader). */
    figuresBaseUrl?: string;
}
export declare class AutoRenderer {
    private options;
    private engine;
    private readonly log;
    private readonly rendered;
    private readonly inFlight;
    /** Files handed over before the engine existed; applied when it starts (see addFiles). */
    private readonly pendingFiles;
    constructor(options?: AutoOptions);
    /** Has an engine been started? A page whose figures all came from the cache or the saved files never starts one. */
    get started(): boolean;
    /**
     * Put files where this page's TeX runs will find them: a font the host wants to
     * typeset in (`\setmainfont{X.ttf}[Path=./]` — the run's working directory leads
     * OPENTYPEFONTS and TTFONTS), an image, a .sty. They stay for the life of the page.
     *
     * Deliberately does NOT start the engine: files handed over before the first
     * render are held and applied when one is created, so a page whose figures all
     * come from the cache or from saved files still starts nothing. Call it before
     * the figures that need the font, and with the `opentype` bundle loaded
     * (`data-bundles="+opentype"`) if the font is for fontspec.
     */
    addFiles(files: Record<string, string | Uint8Array>): Promise<void>;
    private get mp();
    /** How much reaches the console (see `MetaPostOptions.logLevel`), for the engine now and later. */
    setLogLevel(level: LogLevel): void;
    render(req: FigureRequest): Promise<RenderOutput>;
    private renderFrom;
    private done;
    /** Drop a figure from figures() (and so from saveFigures()): a live element has replaced it. */
    forget(nameOrHash: string): void;
    /** Resolves when no render is in flight. */
    idle(): Promise<void>;
    /** Every figure that has rendered successfully so far (from any source), in the order it finished. */
    figures(): SavedFigure[];
    /**
     * Write every figure on the page as figure-HASH.svg: into a folder chosen with the
     * directory picker where the browser has one (Chrome, Edge), otherwise as a zip
     * download. Waits for figures still rendering. Returns the file names written.
     */
    saveFigures(opts?: {
        zip?: boolean;
        name?: string;
    }): Promise<string[]>;
}
export declare function renderElement(el: Element): Promise<void>;
/** Render every diagram element currently in the document (and later ones, unless observe is off). */
export declare function autoRender(root?: ParentNode): void;
