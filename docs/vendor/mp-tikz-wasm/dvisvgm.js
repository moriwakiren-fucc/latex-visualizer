export async function runDvisvgm(factory, opts) {
    const lines = [];
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let exitCode = -1;
    const M = await factory({
        ...opts.module,
        print: (s) => { lines.push(s); opts.onLine?.(s); },
        printErr: (s) => { lines.push(s); opts.onLine?.(s); },
        noInitialRun: true,
        thisProgram: '/bin/dvisvgm',
        preRun: [(m) => {
                m.ENV.TEXMFCNF = '/texmf/web2c';
                m.ENV.SOURCE_DATE_EPOCH = '1735689600';
                m.ENV.HOME = '/home';
            }],
        onExit: (code) => { exitCode = code; },
    });
    try {
        M.FS.mkdir('/bin');
    }
    catch { /* exists */ }
    M.FS.writeFile('/bin/dvisvgm', '');
    opts.setup(M);
    // in Node, Emscripten's runtime writes dvisvgm's status into process.exitCode,
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
    opts.collect?.(M);
    return { exitCode, log: lines.join('\n'), ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
}
//# sourceMappingURL=dvisvgm.js.map