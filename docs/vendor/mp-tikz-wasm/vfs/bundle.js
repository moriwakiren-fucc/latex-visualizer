import { createLazyFile, mkdirp } from './lazyfs.js';
import { silentLogger, plural } from '../logger.js';
export const TEXMF_ROOT = '/texmf';
const inWorker = typeof globalThis.WorkerGlobalScope !== 'undefined' && typeof globalThis.importScripts === 'function';
/** Inside a Worker, post a `fetching` progress event; the main thread's stall watchdog and status text listen for them. */
function fetchingEvent(name, current, total) {
    if (!inWorker)
        return;
    try {
        globalThis.postMessage({ event: 'progress', data: { phase: 'fetching', detail: name, current, total } });
    }
    catch { /* ignore */ }
}
function joinUrl(base, rel) {
    if (!base.endsWith('/'))
        base += '/';
    return base + rel;
}
export class BundleSet {
    io;
    files = new Map(); // relative texmf path -> file
    byName = new Map(); // basename -> files
    manifests = [];
    cache = new Map(); // in-memory copy of fetched files
    negative = new Set();
    /** The files a first run of each kind touches (`bundles/hot.json`, written by scripts/make-hotlists.mjs). */
    hot = {};
    /** Where fetches are reported: prefetch summaries at info, on-demand loads at debug, every file at trace. */
    logger = silentLogger;
    constructor(io) {
        this.io = io;
    }
    /** Load a manifest; `spec.manifestUrl` is the bundle directory/URL (containing manifest.json). */
    async add(spec) {
        const base = spec.manifestUrl.replace(/\/manifest\.json$/, '');
        const manifest = (await this.io.fetchJson(joinUrl(base, 'manifest.json')));
        this.addLoaded(spec, base, manifest);
    }
    addLoaded(spec, base, manifest) {
        this.manifests.push({ spec, manifest, base });
        const blobBase = spec.blobBaseUrl ?? joinUrl(base, 'files');
        for (const [path, info] of Object.entries(manifest.files)) {
            if (this.files.has(path))
                continue; // first bundle wins
            // The file's hash in its URL: a rebuilt file gets a new URL, so an HTTP cache can
            // never hand back a stale copy (a server that sends no Cache-Control lets the
            // browser reuse files heuristically; a new font with an old font map then drew
            // nothing), and an unchanged one may be cached for good.
            const url = joinUrl(blobBase, path) + (info.sha ? `?v=${info.sha}` : '');
            const f = { bundle: manifest.name, path, size: info.size, sha: info.sha, url };
            this.files.set(path, f);
            const name = path.slice(path.lastIndexOf('/') + 1);
            const list = this.byName.get(name);
            if (list)
                list.push(f);
            else
                this.byName.set(name, [f]);
        }
    }
    /** Add several bundles: the manifests are fetched in parallel, then merged in the given order (first bundle wins). */
    async addAll(specs) {
        const manifests = await Promise.all(specs.map(async (spec) => {
            const base = spec.manifestUrl.replace(/\/manifest\.json$/, '');
            return { spec, base, manifest: (await this.io.fetchJson(joinUrl(base, 'manifest.json'))) };
        }));
        for (const m of manifests)
            this.addLoaded(m.spec, m.base, m.manifest);
    }
    /** Load the hot lists; optional, so a missing file is not an error. */
    async loadHot(url) {
        try {
            const h = (await this.io.fetchJson(url));
            if (h && h.kinds)
                this.hot = h.kinds;
        }
        catch { /* no hot.json: prefetch() is a no-op */ }
    }
    /** Fetch, in parallel, every file the hot lists name for these kinds that is not in memory yet. Returns how many. */
    async prefetchHot(kinds, concurrency = 16) {
        const paths = new Set();
        for (const k of kinds)
            for (const p of this.hot[k] ?? [])
                paths.add(p);
        const wanted = [];
        for (const p of paths) {
            const f = this.files.get(p);
            if (f && !this.cache.has(f.path))
                wanted.push(f);
        }
        let i = 0, done = 0;
        await Promise.all(Array.from({ length: Math.min(concurrency, wanted.length) }, async () => {
            while (i < wanted.length) {
                const f = wanted[i++];
                try {
                    await this.fetchAsync(f);
                }
                catch (e) {
                    this.logger.warn('bundle', `prefetch ${f.path}: ${e?.message ?? e}`);
                } // the run reports it too
                fetchingEvent(f.path.slice(f.path.lastIndexOf('/') + 1), ++done, wanted.length);
            }
        }));
        this.logger.info('bundle', `prefetch ${kinds.join(', ')}: ${wanted.length ? `${plural(wanted.length, 'file')} fetched` : 'nothing to fetch'}`);
        return wanted.length;
    }
    /** Every manifest's `eager` list, fetched into memory. */
    async prefetchEager() {
        const wanted = [];
        for (const { manifest } of this.manifests)
            for (const p of manifest.eager ?? []) {
                const f = this.files.get(p);
                if (f)
                    wanted.push(f);
            }
        await Promise.all(wanted.map((f) => this.fetchAsync(f)));
    }
    /** Fetch every file in the set (for environments without sync I/O). */
    async prefetchAll(filter) {
        const wanted = [...this.files.values()].filter((f) => !this.cache.has(f.path) && (!filter || filter(f)));
        // modest concurrency
        let i = 0;
        const workers = Array.from({ length: 8 }, async () => {
            while (i < wanted.length) {
                const f = wanted[i++];
                await this.fetchAsync(f);
            }
        });
        await Promise.all(workers);
    }
    async fetchAsync(f) {
        const hit = this.cache.get(f.path);
        if (hit)
            return hit;
        const data = await this.io.fetch(f.url);
        this.cache.set(f.path, data);
        this.logger.trace('bundle', `fetched ${f.path} (${data.length} bytes)`);
        return data;
    }
    /** Synchronous bytes for a file: from memory, else via fetchSync. Throws if impossible. */
    fetchSyncFile(f) {
        const hit = this.cache.get(f.path);
        if (hit)
            return hit;
        if (!this.io.fetchSync)
            throw new Error(`mp-tikz-wasm: ${f.path} was not prefetched and this environment cannot load files synchronously (run in a Worker, or call preload())`);
        let data;
        try {
            data = this.io.fetchSync(f.url);
        }
        catch (e) {
            this.logger.error('bundle', `${f.path}: ${e?.message ?? e}`);
            throw e;
        }
        this.cache.set(f.path, data);
        this.logger.debug('bundle', `loaded ${f.path} (${data.length} bytes)`); // a sync XHR in the Worker, a disk read in Node
        return data;
    }
    get canFetchSync() { return !!this.io.fetchSync; }
    has(path) { return this.cache.has(path); }
    /**
     * Materialise the tree in the Emscripten FS under /texmf, plus an ls-R
     * database so kpathsea never has to walk directories. Directories are
     * created on demand: the root gets a lookup hook that creates a child
     * directory or a lazy file the first time anything asks for it, so a run
     * pays for the handful of files it touches, not for the whole tree
     * (installing every node eagerly cost ~60 ms per TeX run).
     */
    install(FS, root = TEXMF_ROOT) {
        mkdirp(FS, root);
        const index = this.index();
        const lazyDir = (dirPath, rel) => {
            const node = FS.lookupPath(dirPath).node;
            const origOps = node.node_ops;
            const children = index.dirs.get(rel);
            const materialised = new Set();
            const create = (name) => {
                if (materialised.has(name))
                    return false;
                materialised.add(name);
                const childRel = rel ? `${rel}/${name}` : name;
                const full = `${dirPath}/${name}`;
                if (index.dirs.has(childRel)) {
                    FS.mkdir(full);
                    lazyDir(full, childRel);
                    return true;
                }
                const f = this.files.get(childRel);
                if (!f)
                    return false;
                const data = this.cache.get(childRel);
                if (data)
                    FS.writeFile(full, data);
                else
                    createLazyFile(FS, full, f.size, () => this.fetchSyncFile(f));
                return true;
            };
            node.node_ops = {
                ...origOps,
                lookup: (parent, name) => {
                    if (children?.has(name) && create(name))
                        return FS.lookupNode(parent, name);
                    return origOps.lookup(parent, name);
                },
                readdir: (n) => { if (children)
                    for (const name of children)
                        create(name); return origOps.readdir(n); },
            };
        };
        lazyDir(root, '');
        FS.writeFile(`${root}/ls-R`, this.lsRText ??= this.lsR());
    }
    lsRText;
    indexCache;
    /** directory -> immediate children, for the on-demand tree */
    index() {
        if (this.indexCache)
            return this.indexCache;
        const dirs = new Map();
        const ensure = (d) => { let s = dirs.get(d); if (!s) {
            s = new Set();
            dirs.set(d, s);
        } return s; };
        ensure('');
        for (const path of this.files.keys()) {
            const parts = path.split('/');
            let d = '';
            for (let i = 0; i < parts.length - 1; i++) {
                ensure(d).add(parts[i]);
                d = d ? `${d}/${parts[i]}` : parts[i];
                ensure(d);
            }
            ensure(d).add(parts[parts.length - 1]);
        }
        for (const { manifest } of this.manifests)
            for (const d of manifest.dirs ?? []) {
                const parts = d.split('/');
                let p = '';
                for (const x of parts) {
                    ensure(p).add(x);
                    p = p ? `${p}/${x}` : x;
                    ensure(p);
                }
            }
        return (this.indexCache = { dirs });
    }
    /** kpathsea ls-R database text for the merged tree. */
    lsR() {
        const dirs = new Map();
        const ensure = (d) => { let l = dirs.get(d); if (!l) {
            l = [];
            dirs.set(d, l);
        } return l; };
        ensure('.');
        for (const path of this.files.keys()) {
            const parts = path.split('/');
            let d = '.';
            for (let i = 0; i < parts.length - 1; i++) {
                const sub = parts[i];
                const list = ensure(d);
                if (!list.includes(sub))
                    list.push(sub);
                d = d + '/' + sub;
                ensure(d);
            }
            ensure(d).push(parts[parts.length - 1]);
        }
        let out = '% ls-R -- filename database for kpathsea; do not change this line.\n';
        for (const d of [...dirs.keys()].sort()) {
            out += `\n${d}:\n`;
            for (const e of dirs.get(d).sort())
                out += e + '\n';
        }
        return out;
    }
    /** Find bundle files by bare name (e.g. "cmr10.tfm"), optionally restricted to a directory prefix. */
    lookup(name, prefixes) {
        const list = this.byName.get(name);
        if (!list)
            return undefined;
        if (!prefixes)
            return list[0];
        for (const p of prefixes) {
            const f = list.find((x) => x.path.startsWith(p));
            if (f)
                return f;
        }
        return undefined;
    }
    noteMiss(key) { this.negative.add(key); }
    isMiss(key) { return this.negative.has(key); }
}
/** Browser I/O: fetch() plus a synchronous XHR that only works inside a Worker. */
export function browserIO() {
    const io = {
        async fetch(url) { const r = await fetch(url); if (!r.ok)
            throw new Error(`fetch ${url}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); },
        // manifests and hot lists name the current files: always revalidated (a 304 when unchanged)
        async fetchJson(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok)
            throw new Error(`fetch ${url}: ${r.status}`); return r.json(); },
    };
    if (inWorker && typeof XMLHttpRequest !== 'undefined') {
        io.fetchSync = (url) => {
            fetchingEvent(url.slice(url.lastIndexOf('/') + 1)); // the stall watchdog sees a slow host at work
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.responseType = 'arraybuffer';
            xhr.send(null);
            if (xhr.status < 200 || xhr.status >= 300)
                throw new Error(`sync fetch ${url}: ${xhr.status}`);
            return new Uint8Array(xhr.response);
        };
    }
    return io;
}
//# sourceMappingURL=bundle.js.map