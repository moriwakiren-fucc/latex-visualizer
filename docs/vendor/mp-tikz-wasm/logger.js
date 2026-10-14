export const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug', 'trace'];
export const DEFAULT_LOG_LEVEL = 'warn';
export function isLogLevel(x) { return typeof x === 'string' && LOG_LEVELS.includes(x); }
export class Logger {
    level;
    sink;
    t0 = now();
    constructor(level = DEFAULT_LOG_LEVEL, sink = consoleSink) {
        this.level = level;
        this.sink = sink;
    }
    enabled(level) { return LOG_LEVELS.indexOf(level) <= LOG_LEVELS.indexOf(this.level); }
    log(level, source, message) {
        if (!this.enabled(level))
            return;
        this.sink({ level, source, message, time: Math.round((now() - this.t0) * 10) / 10 });
    }
    error(source, message) { this.log('error', source, message); }
    warn(source, message) { this.log('warn', source, message); }
    info(source, message) { this.log('info', source, message); }
    debug(source, message) { this.log('debug', source, message); }
    trace(source, message) { this.log('trace', source, message); }
}
/** A logger that drops everything (for parts of the pipeline created without one). */
export const silentLogger = new Logger('silent', () => { });
/** `mp-tikz-wasm tex: ...` for an engine's line, `mp-tikz-wasm: ...` for the library's own. */
export function formatRecord(r) {
    return r.source === 'host' ? `mp-tikz-wasm: ${r.message}` : `mp-tikz-wasm ${r.source}: ${r.message}`;
}
/** The default sink. Errors and warnings use the console's own levels; the two
 *  verbose levels use console.log rather than console.debug, which Chrome
 *  hides under "Verbose" by default — someone who asked for the engines'
 *  output should see it without changing a DevTools filter. */
export function consoleSink(r) {
    if (typeof console === 'undefined')
        return;
    const line = formatRecord(r);
    switch (r.level) {
        case 'error':
            console.error(line);
            break;
        case 'warn':
            console.warn(line);
            break;
        case 'info':
            console.info(line);
            break;
        default: console.log(line);
    }
}
/** `ok in 123 ms`-style helpers shared by the summaries. */
export function ms(x) { return `${x < 10 ? x.toFixed(1) : Math.round(x)} ms`; }
export function plural(n, noun) { return `${n} ${noun}${n === 1 ? '' : 's'}`; }
function now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
//# sourceMappingURL=logger.js.map