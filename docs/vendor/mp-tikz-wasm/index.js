import { MetaPostCore } from './core.js';
import { Logger, DEFAULT_LOG_LEVEL, LOG_LEVELS, isLogLevel, consoleSink } from './logger.js';
import { BundleSet, browserIO } from './vfs/bundle.js';
import { resolveBundleSpecs, DEFAULT_BUNDLES } from './bundles-config.js';
import { isNode, nodeIO } from './node.js';
import { ghostscriptLoader, ghostscriptWanted } from './ghostscript.js';
export * from './types.js';
export { sanitizeSvg, postProcessSvg } from './render/svg.js';
export { scanTexBlocks, scanInputs } from './tex/scanner.js';
export { parseMetaPostLog } from './diagnostics.js';
export { splitMpx } from './tex/mpx.js';
export { LOG_LEVELS, formatRecord, consoleSink } from './logger.js';
// the opt-in bundles are added to this list, so callers need it: see README, "OpenType fonts"
export { DEFAULT_BUNDLES } from './bundles-config.js';
export { figureHash, figureName, figureDocument, extractFigures, renderFigure, wrapTikz, wrapMetaPost, makeZip, FIGURE_FILE } from './figures.js';
class InProcessBackend {
    options;
    emit;
    core;
    bundles;
    logger;
    constructor(options, emit) {
        this.options = options;
        this.emit = emit;
    }
    async init() {
        const o = this.options;
        const here = import.meta.url;
        this.logger = new Logger(o.logLevel ?? DEFAULT_LOG_LEVEL, (r) => this.emit('record', r));
        const io = o.bundleIO ?? (isNode ? await nodeIO() : browserIO());
        let texmfDir = o.texmfDir;
        if (!texmfDir) {
            this.bundles = new BundleSet(io);
            this.bundles.logger = this.logger;
            const base = o.bundleBaseUrl ?? new URL('./bundles/', here).href;
            await this.bundles.addAll(resolveBundleSpecs(o.bundles ?? DEFAULT_BUNDLES, base));
            await this.bundles.prefetchEager();
            await this.bundles.loadHot((base.endsWith('/') ? base : base + '/') + 'hot.json');
            if (!this.bundles.canFetchSync)
                await this.bundles.prefetchAll();
        }
        const mplibFactory = o.modules?.mplib ?? (await import(/* @vite-ignore */ new URL('./mplib.mjs', here).href)).default;
        let texFactory = o.modules?.tex;
        if (!texFactory && (o.tex ?? 'auto') !== 'none') {
            try {
                texFactory = (await import(/* @vite-ignore */ new URL('./tex.mjs', here).href)).default;
            }
            catch {
                texFactory = undefined;
            }
        }
        let dvisvgmFactory = o.modules?.dvisvgm;
        if (!dvisvgmFactory && texFactory) {
            try {
                dvisvgmFactory = (await import(/* @vite-ignore */ new URL('./dvisvgm.mjs', here).href)).default;
            }
            catch {
                dvisvgmFactory = undefined;
            }
        }
        // luatex.wasm: the factory is cheap to import; the 4 MB module is only fetched on the first lualatex run
        let luatexFactory = o.modules?.luatex;
        if (!luatexFactory && texFactory) {
            try {
                luatexFactory = (await import(/* @vite-ignore */ new URL('./luatex.mjs', here).href)).default;
            }
            catch {
                luatexFactory = undefined;
            }
        }
        const gsBase = o.ghostscriptBaseUrl ?? new URL('./ghostscript/', here).href;
        const ghostscript = dvisvgmFactory && ghostscriptWanted(o.ghostscript, o.bundles ?? DEFAULT_BUNDLES)
            ? ghostscriptLoader({ glueUrl: new URL('gs.mjs', gsBase).href, wasmUrl: new URL('gs.wasm', gsBase).href, fetch: (u) => io.fetch(u), factory: o.modules?.ghostscript, log: (m) => this.logger.info('host', m) })
            : undefined;
        this.core = new MetaPostCore({
            mplibFactory, texFactory, luatexFactory, dvisvgmFactory, ghostscript, bundles: this.bundles, texmfDir, options: o, logger: this.logger,
            onProgress: (e) => this.emit('progress', e),
            onLog: (l) => this.emit('log', l),
        });
        await this.core.init();
        return { version: this.core.version };
    }
    run(source, options) { return this.core.run(source, options); }
    latex(source, options) { return this.core.latex(source, options); }
    async addFiles(files) { this.core.addFiles(files); }
    async clearCache() { this.core.clearCache(); }
    async preload(bundles) {
        if (!this.bundles)
            return;
        const base = this.options.bundleBaseUrl ?? new URL('./bundles/', import.meta.url).href;
        for (const spec of resolveBundleSpecs(bundles, base))
            if (!this.bundles.manifests.some((m) => m.spec.name === spec.name))
                await this.bundles.add(spec);
        await this.bundles.prefetchAll((f) => bundles.includes(f.bundle));
    }
    async prefetch(kinds) { return this.bundles ? this.bundles.prefetchHot(kinds) : 0; }
    setLogLevel(level) { this.logger.level = level; }
    dispose() { }
}
class WorkerBackend {
    options;
    emit;
    worker;
    pending = new Map();
    nextId = 1;
    constructor(options, emit) {
        this.options = options;
        this.emit = emit;
    }
    onMessage(m) {
        if ('event' in m) {
            this.emit(m.event, m.data);
            return;
        }
        const p = this.pending.get(m.id);
        if (!p)
            return;
        this.pending.delete(m.id);
        if (!this.pending.size)
            this.worker.busy(false);
        if (m.ok)
            p.resolve(m.result);
        else
            p.reject(new Error(m.error));
    }
    onError(message) {
        for (const p of this.pending.values())
            p.reject(new Error(message));
        this.pending.clear();
        this.worker.busy(false);
    }
    /** Start the worker: a Web Worker in a browser, a worker_threads Worker in Node. */
    async start() {
        const url = new URL('./worker.js', import.meta.url);
        if (isNode) {
            const { Worker: NodeWorker } = await import('node:worker_threads');
            const w = new NodeWorker(url);
            w.on('message', (m) => this.onMessage(m));
            w.on('error', (e) => this.onError(String(e?.message ?? e)));
            w.on('exit', (code) => { if (this.pending.size)
                this.onError(`mp-tikz-wasm: worker exited (${code})`); });
            w.unref();
            this.worker = { postMessage: (m) => w.postMessage(m), terminate: () => { void w.terminate(); }, busy: (on) => (on ? w.ref() : w.unref()) };
        }
        else {
            const w = new Worker(url, { type: 'module' });
            w.onmessage = (ev) => this.onMessage(ev.data);
            w.onerror = (e) => this.onError(String(e.message ?? e));
            this.worker = { postMessage: (m) => w.postMessage(m), terminate: () => w.terminate(), busy: () => { } };
        }
    }
    call(op, payload = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            if (!this.pending.size)
                this.worker.busy(true);
            this.pending.set(id, { resolve, reject });
            this.worker.postMessage({ id, op, ...payload });
        });
    }
    async init() {
        await this.start();
        const { runScript, makeText, onFindFile, log, logger, ...cloneable } = this.options;
        return this.call('init', { options: cloneable, baseUrl: import.meta.url });
    }
    run(source, options) {
        const { signal, ...rest } = options;
        return this.call('run', { source, options: rest });
    }
    latex(source, options) {
        const { signal, ...rest } = options;
        return this.call('latex', { source, options: rest });
    }
    addFiles(files) { return this.call('addFiles', { files }); }
    clearCache() { return this.call('clearCache'); }
    preload(bundles) { return this.call('preload', { bundles }); }
    prefetch(kinds) { return this.call('prefetch', { kinds }); }
    setLogLevel(level) { void this.call('setLogLevel', { level }); }
    dispose() { this.worker.terminate(); }
}
export class MetaPost {
    backend;
    options;
    listeners = new Map();
    queue = Promise.resolve();
    t0 = now();
    version = { metapost: '', tex: '', build: '' };
    constructor(backend, options) {
        this.backend = backend;
        this.options = options;
    }
    static async create(options = {}) {
        options = { ...options };
        if (options.snapshot === undefined)
            options.snapshot = isNode ? 'auto' : 'none';
        if (options.logLevel !== undefined && !isLogLevel(options.logLevel))
            throw new Error(`mp-tikz-wasm: unknown logLevel "${options.logLevel}" (silent, error, warn, info, debug, trace)`);
        const hasCallbacks = !!(options.runScript || options.makeText || options.onFindFile || options.modules || options.bundleIO);
        // In Node the default is in-process; `worker: true` runs the engines in a worker_threads
        // thread, which is what lets the stall watchdog (timeoutMs) stop a runaway document.
        const useWorker = options.worker ?? (!isNode && typeof Worker !== 'undefined' && !hasCallbacks);
        if (!isNode && (options.runScript || options.makeText || options.onFindFile) && options.worker === undefined && typeof console !== 'undefined') {
            console.warn('mp-tikz-wasm: runScript/makeText/onFindFile callbacks require in-process mode; running on the main thread');
        }
        let mp;
        const emit = (ev, data) => mp.handleEvent(ev, data);
        const backend = useWorker ? new WorkerBackend(options, emit) : new InProcessBackend(options, emit);
        mp = new MetaPost(backend, options);
        const { version } = await backend.init();
        Object.assign(mp.version, version);
        if (options.prefetch?.length)
            await backend.prefetch(options.prefetch);
        return mp;
    }
    /**
     * The stall watchdog (worker only): the run is killed when `timeoutMs` pass without a progress
     * event or a line of engine output. Every engine phase and every on-demand file fetch is progress,
     * so a first run on a slow host that spends a minute fetching files one after another is left
     * alone, and so is a long TeX run that is still printing; a silent, hung engine is not.
     */
    watchdog(p, what, signal) {
        const timeout = this.options.timeoutMs ?? 20_000;
        if (!(this.backend instanceof WorkerBackend) || !timeout)
            return p;
        return new Promise((resolve, reject) => {
            let t;
            const off = this.on('progress', () => arm());
            const offLog = this.on('log', () => arm());
            const done = () => { if (t)
                clearTimeout(t); off(); offLog(); };
            const kill = (why) => { done(); this.backend.dispose(); reject(new Error(why)); };
            const arm = () => { if (t)
                clearTimeout(t); t = setTimeout(() => kill(`mp-tikz-wasm: ${what} made no progress for ${timeout} ms; worker terminated`), timeout); };
            arm();
            p.then((r) => { done(); resolve(r); }, (e) => { done(); reject(e); });
            signal?.addEventListener('abort', () => kill('aborted'));
        });
    }
    /** Events from either backend: log records reach the console (or the `logger` option), raw lines the `log` option, then any listeners. */
    handleEvent(event, data) {
        if (event === 'record')
            (this.options.logger ?? consoleSink)(data);
        else if (event === 'log')
            this.options.log?.(data);
        this.emit(event, data);
    }
    /** A record from this side of the worker boundary (a failed call, the watchdog), subject to the same level. */
    hostRecord(level, message) {
        if (LOG_LEVELS.indexOf(level) > LOG_LEVELS.indexOf(this.logLevel))
            return;
        this.handleEvent('record', { level, source: 'host', message, time: Math.round((now() - this.t0) * 10) / 10 });
    }
    failing(p, what) {
        return p.catch((e) => { this.hostRecord('error', `${what} failed: ${e?.message ?? e}`); throw e; });
    }
    /** How much reaches the console (see `MetaPostOptions.logLevel`); can be changed at any time, also mid-run. */
    get logLevel() { return this.options.logLevel ?? DEFAULT_LOG_LEVEL; }
    set logLevel(level) {
        if (!isLogLevel(level))
            throw new Error(`mp-tikz-wasm: unknown logLevel "${level}" (silent, error, warn, info, debug, trace)`);
        this.options.logLevel = level;
        this.backend.setLogLevel(level);
    }
    /** Compile MetaPost source. Calls are serialised on this instance. */
    run(source, options = {}) {
        const task = () => this.failing(this.watchdog(this.backend.run(source, options), 'run', options.signal), 'run');
        const next = this.queue.then(task, task);
        this.queue = next.catch(() => undefined);
        return next;
    }
    /** Typeset a whole LaTeX/TikZ (or plain TeX) document to one SVG per page. */
    latex(source, options = {}) {
        const task = () => this.failing(this.watchdog(this.backend.latex(source, options), 'latex'), 'latex');
        const next = this.queue.then(task, task);
        this.queue = next.catch(() => undefined);
        return next;
    }
    addFiles(files) { return this.backend.addFiles(files); }
    preload(bundles) { return this.backend.preload(bundles); }
    /** Fetch in parallel the files a first run of these kinds needs (see `MetaPostOptions.prefetch`). Resolves to the number fetched. */
    prefetch(kinds) { return this.backend.prefetch(kinds); }
    clearCache() { return this.backend.clearCache(); }
    on(event, fn) {
        let s = this.listeners.get(event);
        if (!s) {
            s = new Set();
            this.listeners.set(event, s);
        }
        s.add(fn);
        return () => s.delete(fn);
    }
    emit(event, data) { this.listeners.get(event)?.forEach((f) => f(data)); }
    dispose() { this.backend.dispose(); }
}
function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
/** A pool of independent instances for batch work (docs/10 §2.3). */
export class MetaPostPool {
    all;
    idle = [];
    waiters = [];
    constructor(all) {
        this.all = all;
        this.idle = [...all];
    }
    static async create(options = {}) {
        const size = options.size ?? (typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 2) : 2);
        const all = await Promise.all(Array.from({ length: Math.max(1, size) }, () => MetaPost.create(options)));
        return new MetaPostPool(all);
    }
    acquire() {
        const mp = this.idle.pop();
        return mp ? Promise.resolve(mp) : new Promise((r) => this.waiters.push(r));
    }
    release(mp) { const w = this.waiters.shift(); if (w)
        w(mp);
    else
        this.idle.push(mp); }
    async run(source, options) {
        const mp = await this.acquire();
        try {
            return await mp.run(source, options);
        }
        finally {
            this.release(mp);
        }
    }
    dispose() { for (const mp of this.all)
        mp.dispose(); }
}
//# sourceMappingURL=index.js.map