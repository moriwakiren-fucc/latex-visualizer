/**
 * worker.ts — the Web Worker entry point (docs/01 §2). Hosts one MetaPostCore
 * and speaks a tiny request/response protocol with index.ts. The same file runs
 * as a Node worker_threads worker (MetaPost.create({ worker: true }) in Node),
 * so that a runaway engine can be terminated there too: a synchronous wasm loop
 * cannot be interrupted from the thread it runs on.
 */
import { MetaPostCore } from './core.js';
import { BundleSet, browserIO } from './vfs/bundle.js';
import { resolveBundleSpecs, DEFAULT_BUNDLES } from './bundles-config.js';
import { Logger, DEFAULT_LOG_LEVEL } from './logger.js';
import { isNode, nodeIO } from './node.js';
import { ghostscriptLoader, ghostscriptWanted } from './ghostscript.js';
// Node worker_threads: give the rest of this file the Web Worker surface it uses
// (self.onmessage, postMessage, close), backed by parentPort.
if (isNode) {
    const { parentPort } = await import('node:worker_threads');
    if (parentPort) {
        const g = globalThis;
        g.self = g;
        g.postMessage = (m, transfer) => parentPort.postMessage(m, transfer);
        g.close = () => parentPort.close();
        parentPort.on('message', (data) => g.onmessage?.({ data }));
    }
}
let core = null;
let bundles = null;
let logger = null;
let baseUrl = '';
const post = (m, transfer) => self.postMessage(m, transfer ?? []);
self.onmessage = async (ev) => {
    const req = ev.data;
    try {
        switch (req.op) {
            case 'init': {
                const options = req.options;
                baseUrl = String(req.baseUrl);
                const io = isNode ? await nodeIO() : browserIO();
                bundles = new BundleSet(io);
                // records cross to the main thread, which writes them to the console (or the `logger` option)
                logger = new Logger(options.logLevel ?? DEFAULT_LOG_LEVEL, (r) => post({ event: 'record', data: r }));
                bundles.logger = logger;
                // Node can mount a real texmf tree instead of loading bundles
                const texmfDir = isNode ? options.texmfDir : undefined;
                // manifests, hot lists and engine glue all at once: a slow host charges per round trip
                const bundleBase = options.bundleBaseUrl ?? new URL('./bundles/', baseUrl).href;
                const wantTex = (options.tex ?? 'auto') !== 'none';
                const glue = (name) => import(/* @vite-ignore */ new URL(name, baseUrl).href).then((m) => m.default, () => undefined);
                const [mplibFactory, texFactory, dvisvgmFactory, luatexFactory] = await Promise.all([
                    import(/* @vite-ignore */ new URL('./mplib.mjs', baseUrl).href).then((m) => m.default),
                    wantTex ? glue('./tex.mjs') : undefined,
                    wantTex ? glue('./dvisvgm.mjs') : undefined,
                    wantTex ? glue('./luatex.mjs') : undefined,
                    texmfDir ? undefined : bundles.addAll(resolveBundleSpecs(options.bundles ?? DEFAULT_BUNDLES, bundleBase)),
                    texmfDir ? undefined : bundles.loadHot((bundleBase.endsWith('/') ? bundleBase : bundleBase + '/') + 'hot.json'),
                ]);
                if (!texmfDir) {
                    await bundles.prefetchEager();
                    if (!bundles.canFetchSync)
                        await bundles.prefetchAll();
                }
                const gsBase = options.ghostscriptBaseUrl ?? new URL('./ghostscript/', baseUrl).href;
                const ghostscript = dvisvgmFactory && ghostscriptWanted(options.ghostscript, options.bundles ?? DEFAULT_BUNDLES)
                    ? ghostscriptLoader({ glueUrl: new URL('gs.mjs', gsBase).href, wasmUrl: new URL('gs.wasm', gsBase).href, fetch: (u) => io.fetch(u), log: (m) => logger?.info('host', m) })
                    : undefined;
                core = new MetaPostCore({
                    mplibFactory, texFactory, luatexFactory, dvisvgmFactory, ghostscript, bundles: texmfDir ? undefined : bundles, texmfDir, options, logger,
                    onProgress: (e) => post({ event: 'progress', data: e }),
                    onLog: (line) => post({ event: 'log', data: line }),
                });
                await core.init();
                post({ id: req.id, ok: true, result: { version: core.version } });
                break;
            }
            case 'run': {
                const r = await core.run(req.source, req.options);
                post({ id: req.id, ok: true, result: r });
                break;
            }
            case 'latex': {
                const r = await core.latex(req.source, req.options);
                post({ id: req.id, ok: true, result: r });
                break;
            }
            case 'addFiles':
                core.addFiles(req.files);
                post({ id: req.id, ok: true });
                break;
            case 'clearCache':
                core.clearCache();
                post({ id: req.id, ok: true });
                break;
            case 'preload': {
                const names = req.bundles;
                for (const spec of resolveBundleSpecs(names, new URL('./bundles/', baseUrl).href)) {
                    if (!bundles.manifests.some((m) => m.spec.name === spec.name))
                        await bundles.add(spec);
                }
                await bundles.prefetchAll((f) => names.includes(f.bundle));
                post({ id: req.id, ok: true });
                break;
            }
            case 'prefetch': {
                const n = await bundles.prefetchHot(req.kinds);
                post({ id: req.id, ok: true, result: n });
                break;
            }
            case 'setLogLevel':
                if (logger)
                    logger.level = req.level;
                post({ id: req.id, ok: true });
                break;
            case 'dispose':
                post({ id: req.id, ok: true });
                self.close();
                break;
        }
    }
    catch (e) {
        const msg = typeof e === 'string' ? e : e?.stack ?? e?.message ?? (() => { try {
            return JSON.stringify(e);
        }
        catch {
            return String(e);
        } })();
        post({ id: req.id, ok: false, error: msg });
    }
};
//# sourceMappingURL=worker.js.map