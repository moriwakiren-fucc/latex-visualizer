const FIXED_EPOCH = '1735689600'; // 2025-01-01T00:00:00Z, docs/04 §7 (4)
export async function runTex(factory, opts) {
    const lines = [];
    const t0 = now();
    let exitCode = -1;
    const M = await factory({
        print: (s) => { lines.push(s); opts.onLine?.(s); },
        printErr: (s) => { lines.push(s); opts.onLine?.(s); },
        noInitialRun: true,
        thisProgram: opts.program ?? '/bin/pdftex',
        preRun: [(m) => {
                m.ENV.TEXMFCNF = '/texmf/web2c';
                m.ENV.SOURCE_DATE_EPOCH = FIXED_EPOCH;
                m.ENV.FORCE_SOURCE_DATE = '1';
                m.ENV.HOME = '/home';
                for (const [k, v] of Object.entries(opts.env ?? {}))
                    m.ENV[k] = v;
            }],
        onExit: (code) => { exitCode = code; },
    });
    const t1 = now();
    try {
        M.FS.mkdir('/bin');
    }
    catch { /* exists */ }
    M.FS.writeFile(opts.program ?? '/bin/pdftex', ''); // kpathsea wants dirname(argv[0]) to exist
    opts.setup(M);
    const t2 = now();
    // in Node, Emscripten's runtime writes the program's status into process.exitCode,
    // which would make the host process exit with it; the status is ours to report
    const proc = globalThis.process;
    const savedExitCode = proc?.exitCode;
    try {
        const r = M.callMain(opts.args);
        if (typeof r === 'number')
            exitCode = r;
    }
    catch (e) {
        if (e && e.name === 'ExitStatus')
            exitCode = e.status;
        else
            throw e;
    }
    finally {
        if (proc)
            proc.exitCode = savedExitCode;
    }
    const t3 = now();
    opts.collect?.(M);
    return { exitCode, log: lines.join('\n'), ms: now() - t0, setupMs: t2 - t1, mainMs: t3 - t2 };
}
function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
//# sourceMappingURL=texengine.js.map