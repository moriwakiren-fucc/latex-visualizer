/**
 * ghostscript.ts — Ghostscript for dvisvgm, as a module of its own.
 *
 * dvisvgm interprets PostScript specials (PSTricks, EPS images, `ps:` code,
 * graphicx's rotation and scaling under its dvips driver) through Ghostscript's
 * C API. dvisvgm.wasm asks for "libgs" with dlopen, and src/c/gs-bridge.c
 * answers with gsapi_* proxies that call Module.gsBridge, the object built
 * here. It forwards each call to a separate Ghostscript wasm module
 * (vendor/GHOSTSCRIPT.lock, served from dist/ghostscript/), copying buffers
 * between the two heaps. Ghostscript is never linked into dvisvgm.wasm, and it
 * is loaded only by a document whose DVI carries PostScript worth running
 * (postscript.ts), only when the `ghostscript` bundle is enabled.
 *
 * Ghostscript opens files itself (an EPS goes in as `(fig.eps) run`), so for
 * each dvisvgm run its /work and /texmf are mounted into the Ghostscript
 * module with Emscripten's PROXYFS. One module serves every document in turn:
 * gsapi_new_instance ... gsapi_delete_instance per dvisvgm run, never two at
 * once (a non-threaded Ghostscript refuses a second live instance).
 */
/** gs_error_Fatal: what the proxies report when the module itself failed. */
const FATAL = -100;
export class Ghostscript {
    M;
    instance = 0;
    out = [[], [], []]; // index 1 stdout, 2 stderr
    cell; // 16 scratch bytes: instance pointer, exit code, revision
    buf = 0;
    bufSize = 0;
    fns;
    mounted = [];
    /** set when the module trapped: it is not used again, and the engine loads a fresh one */
    broken = false;
    constructor(M) {
        this.M = M;
        this.cell = M._malloc(16);
        const collect = (stream) => (_caller, ptr, len) => {
            if (len > 0)
                this.out[stream].push(this.M.HEAPU8.slice(ptr, ptr + len));
            return len;
        };
        this.fns = [M.addFunction(() => 0, 'iiii'), M.addFunction(collect(1), 'iiii'), M.addFunction(collect(2), 'iiii')];
    }
    /** Instantiate the module from a compiled gs.wasm. */
    static async create(factory, wasm) {
        const M = await factory({
            print: () => { }, printErr: () => { },
            instantiateWasm(imports, receive) {
                WebAssembly.instantiate(wasm, imports).then((inst) => receive(inst, wasm));
                return {};
            },
        });
        return new Ghostscript(M);
    }
    view() { return new DataView(this.M.HEAPU8.buffer); }
    /** Give Ghostscript dvisvgm's files: its /work (the cwd) and its /texmf. */
    mount(dvisvgmFS, dirs) {
        const FS = this.M.FS;
        for (const dir of dirs) {
            if (!dvisvgmFS.analyzePath(dir).exists)
                continue;
            try {
                FS.mkdirTree(dir);
            }
            catch { /* exists */ }
            FS.mount(this.M.PROXYFS, { root: dir, fs: dvisvgmFS }, dir);
            this.mounted.push(dir);
        }
        if (this.mounted.includes('/work'))
            FS.chdir('/work');
    }
    unmount() {
        const FS = this.M.FS;
        try {
            FS.chdir('/');
        }
        catch { /* ignore */ }
        for (const dir of this.mounted.splice(0)) {
            try {
                FS.unmount(dir);
            }
            catch { /* ignore */ }
        }
    }
    /** Run fn against the module; a trap marks it broken and becomes a Ghostscript fatal error. */
    guard(fallback, fn) {
        if (this.broken)
            return fallback;
        try {
            return fn();
        }
        catch {
            this.broken = true;
            return fallback;
        }
    }
    bridge() {
        const M = this.M;
        return {
            available: () => !this.broken,
            revision: () => this.guard([0, 0], () => {
                M._gsapi_revision(this.cell, 16); // wasm32: product, copyright (pointers), revision, revisiondate (longs)
                const v = this.view();
                return [v.getInt32(this.cell + 8, true), v.getInt32(this.cell + 12, true)];
            }),
            newInstance: () => this.guard(FATAL, () => {
                this.out[1] = [];
                this.out[2] = [];
                // *pinstance must be null: a non-null value asks to share that (existing) instance
                this.view().setUint32(this.cell, 0, true);
                const code = M._gsapi_new_instance(this.cell, 0);
                if (code < 0)
                    return code;
                this.instance = this.view().getUint32(this.cell, true);
                return M._gsapi_set_stdio(this.instance, ...this.fns);
            }),
            init: (args) => this.guard(FATAL, () => {
                const enc = new TextEncoder();
                const strs = args.map((a) => enc.encode(a));
                const block = M._malloc(4 * strs.length + strs.reduce((n, s) => n + s.length + 1, 0));
                let p = block + 4 * strs.length;
                strs.forEach((s, i) => {
                    this.view().setUint32(block + 4 * i, p, true);
                    M.HEAPU8.set(s, p);
                    M.HEAPU8[p + s.length] = 0;
                    p += s.length + 1;
                });
                try {
                    return M._gsapi_init_with_args(this.instance, strs.length, block);
                }
                finally {
                    M._free(block);
                }
            }),
            run: (op, bytes, userErrors) => this.guard([FATAL, FATAL], () => {
                const exit = this.cell + 4;
                let code;
                if (op === 0)
                    code = M._gsapi_run_string_begin(this.instance, userErrors, exit);
                else if (op === 2)
                    code = M._gsapi_run_string_end(this.instance, userErrors, exit);
                else {
                    const n = bytes.length;
                    if (n > this.bufSize) {
                        if (this.buf)
                            M._free(this.buf);
                        this.buf = M._malloc(n);
                        this.bufSize = n;
                    }
                    M.HEAPU8.set(bytes, this.buf);
                    code = M._gsapi_run_string_continue(this.instance, this.buf, n, userErrors, exit);
                }
                return [code, this.view().getInt32(exit, true)];
            }),
            exit: () => this.guard(FATAL, () => M._gsapi_exit(this.instance)),
            deleteInstance: () => this.guard(undefined, () => {
                if (this.instance)
                    M._gsapi_delete_instance(this.instance);
                this.instance = 0;
            }),
            take: (stream, max) => {
                const q = this.out[stream];
                if (!q.length)
                    return null;
                const head = q[0];
                if (head.length <= max) {
                    q.shift();
                    return head;
                }
                q[0] = head.subarray(max);
                return head.subarray(0, max);
            },
        };
    }
}
/** One compile of gs.wasm per process, whoever asks. */
const compiled = new Map();
export function compileGhostscript(key, bytes) {
    let p = compiled.get(key);
    if (!p) {
        p = bytes().then((b) => WebAssembly.compile(b));
        p.catch(() => compiled.delete(key));
        compiled.set(key, p);
    }
    return p;
}
/**
 * A lazy loader for one engine: nothing is fetched until a document needs
 * Ghostscript; then the glue is imported, gs.wasm compiled (once per process)
 * and a module instantiated, which serves later documents too. A module that
 * trapped is replaced. If loading fails, it says so once and returns null, so
 * documents still render, with a warning, as without Ghostscript.
 */
export function ghostscriptLoader(o) {
    let current = null;
    let failed = false;
    return async () => {
        if (failed)
            return null;
        if (current && !current.broken)
            return current;
        try {
            const factory = o.factory ?? (await import(/* @vite-ignore */ o.glueUrl)).default;
            const wasm = await compileGhostscript(o.wasmUrl, () => o.fetch(o.wasmUrl));
            current = await Ghostscript.create(factory, wasm);
            return current;
        }
        catch (e) {
            failed = true;
            o.log?.(`Ghostscript could not be loaded from ${o.wasmUrl}: ${e?.message ?? e}`);
            return null;
        }
    };
}
/** Whether these options turn Ghostscript on: the option itself, or the `ghostscript` bundle in the list. */
export function ghostscriptWanted(ghostscript, bundles) {
    return ghostscript ?? bundles.some((b) => (typeof b === 'string' ? b : b.name) === 'ghostscript');
}
//# sourceMappingURL=ghostscript.js.map