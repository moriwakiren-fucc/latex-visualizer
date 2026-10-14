export const MP_FTYPE_NAMES = ['terminal', 'error', 'program', 'log', 'postscript', 'bitmap', 'memfile', 'metrics', 'fontmap', 'font', 'encoding', 'text'];
/** pseudo file types used by the dvitomp finder (mpwasm_mpx.c) */
export const MPX_FTYPE_TFM = 100;
export const MPX_FTYPE_VF = 101;
export class MpJob {
    M;
    ctx;
    freed = false;
    history = -1;
    constructor(M, opts = {}) {
        this.M = M;
        this.ctx = M.ccall('mpwasm_new', 'number', [], []);
        const setInt = (k, v) => M.ccall('mpwasm_set_int', 'number', ['number', 'string', 'number'], [this.ctx, k, v]);
        const setStr = (k, v) => M.ccall('mpwasm_set_str', 'number', ['number', 'string', 'string'], [this.ctx, k, v]);
        setInt('math_mode', opts.mathMode ?? 0);
        setInt('extensions', opts.extensions === false ? 0 : 1);
        setInt('interaction', opts.interaction ?? 2);
        setInt('halt_on_error', opts.haltOnError ? 1 : 0);
        setInt('random_seed', opts.randomSeed ?? 42);
        setInt('recorder', opts.recorder ? 1 : 0);
        setInt('troff_mode', opts.troff ? 1 : 0);
        setInt('file_line_error_style', opts.fileLineErrorStyle ? 1 : 0);
        setStr('mem_name', opts.memName ?? 'plain');
        setStr('job_name', opts.jobName ?? 'job');
        if (opts.banner)
            setStr('banner', opts.banner);
        for (const [t, dirs] of Object.entries(opts.searchPaths ?? {})) {
            for (const d of dirs ?? [])
                M.ccall('mpwasm_add_path', null, ['number', 'number', 'string'], [this.ctx, Number(t), d]);
        }
    }
    /** Run ONE line of MetaPost (normally "input job"). Returns history 0..4. */
    run(commands) {
        if (this.freed)
            throw new Error('MpJob already freed');
        this.history = this.M.ccall('mpwasm_run', 'number', ['number', 'string'], [this.ctx, commands]);
        return this.history;
    }
    get termOut() { return this.M.ccall('mpwasm_term_out', 'string', ['number'], [this.ctx]); }
    get logOut() { return this.M.ccall('mpwasm_log_out', 'string', ['number'], [this.ctx]); }
    get errorOut() { return this.M.ccall('mpwasm_error_out', 'string', ['number'], [this.ctx]); }
    get lastError() { return this.M.ccall('mpwasm_last_error', 'string', ['number'], [this.ctx]); }
    get openedFiles() {
        return JSON.parse(this.M.ccall('mpwasm_opened_files_json', 'string', ['number'], [this.ctx]) || '[]');
    }
    get figureCount() { return this.M.ccall('mpwasm_figure_count', 'number', ['number'], [this.ctx]); }
    charcode(i) { return this.M.ccall('mpwasm_figure_charcode', 'number', ['number', 'number'], [this.ctx, i]); }
    dims(i) {
        const d = (k) => this.M.ccall('mpwasm_figure_dim', 'number', ['number', 'number', 'number'], [this.ctx, i, k]);
        return { bbox: [d(0), d(1), d(2), d(3)], width: d(4), height: d(5), depth: d(6), italicCorrection: d(7), prologues: d(8), procset: d(9) };
    }
    /** CONTRACT: each call re-renders and copies out immediately (drain rule). */
    /** prologues -1 = the document's value at shipout time (patch 0009) */
    svg(i, prologues = -1) {
        return this.M.ccall('mpwasm_figure_svg', 'string', ['number', 'number', 'number'], [this.ctx, i, prologues]);
    }
    ps(i, prologues = -1, procset = -1) {
        return this.M.ccall('mpwasm_figure_ps', 'string', ['number', 'number', 'number', 'number'], [this.ctx, i, prologues, procset]);
    }
    json(i) {
        return this.M.ccall('mpwasm_figure_json', 'string', ['number', 'number'], [this.ctx, i]);
    }
    /** Evaluate a numeric expression in the finished job's state (e.g. an internal like "prologues"). */
    numeric(expr) { return this.M.ccall('mpwasm_get_numeric', 'number', ['number', 'string'], [this.ctx, expr]); }
    string(expr) { return this.M.ccall('mpwasm_get_string', 'string', ['number', 'string'], [this.ctx, expr]); }
    free() {
        if (!this.freed) {
            this.freed = true;
            this.M.ccall('mpwasm_free', null, ['number'], [this.ctx]);
        }
    }
}
export function mplibVersion(M) { return M.ccall('mpwasm_version', 'string', [], []); }
export function mplibBuildId(M) { return M.ccall('mpwasm_build_id', 'string', [], []); }
/** Run mpto (btex extraction) inside mplib.wasm: returns 0 on success. */
export function mpto(M, mpPath, texPath, mptexpre = null, troff = false) {
    return M.ccall('mpwasm_mpto', 'number', ['number', 'number', 'number', 'number'], [M.stringToNewUTF8(mpPath), M.stringToNewUTF8(texPath), mptexpre ? M.stringToNewUTF8(mptexpre) : 0, troff ? 1 : 0]);
}
/** Run dvitomp inside mplib.wasm: returns 0 on success. */
export function dvitomp(M, dviPath, mpxPath, banner) {
    return M.ccall('mpwasm_dvitomp', 'number', ['string', 'string', 'number'], [dviPath, mpxPath, banner ? M.stringToNewUTF8(banner) : 0]);
}
export function mpxAddPath(M, dir) { M.ccall('mpwasm_mpx_add_path', null, ['string'], [dir]); }
export function mpxLastError(M) { return M.ccall('mpwasm_mpx_last_error', 'string', [], []); }
//# sourceMappingURL=mplib.js.map