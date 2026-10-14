/**
 * logger.ts — levelled logging for the engines (docs/08 §4). Every part of
 * the pipeline reports through one Logger; records at or below the chosen
 * level reach the sink (the console by default, or the `logger` option) and
 * the rest cost nothing. Each level includes the ones before it:
 *
 *   silent   nothing
 *   error    the errors of every run (MetaPost, TeX, dvisvgm, bundles, the host)
 *   warn     plus warnings                                        (the default)
 *   info     plus one line per run and per engine pass, with timings
 *   debug    plus the engines' own terminal output, line by line, as it is written
 *   trace    plus every file looked up or fetched, cache hits, progress events
 *
 * The level is checked at call time, so `mp.logLevel = 'debug'` takes effect
 * for the next line an engine prints.
 */
import type { LogLevel, LogRecord, LogSource } from './types.js';
export declare const LOG_LEVELS: readonly LogLevel[];
export declare const DEFAULT_LOG_LEVEL: LogLevel;
export type LogSink = (record: LogRecord) => void;
type Level = Exclude<LogLevel, 'silent'>;
export declare function isLogLevel(x: unknown): x is LogLevel;
export declare class Logger {
    level: LogLevel;
    sink: LogSink;
    private readonly t0;
    constructor(level?: LogLevel, sink?: LogSink);
    enabled(level: Level): boolean;
    log(level: Level, source: LogSource, message: string): void;
    error(source: LogSource, message: string): void;
    warn(source: LogSource, message: string): void;
    info(source: LogSource, message: string): void;
    debug(source: LogSource, message: string): void;
    trace(source: LogSource, message: string): void;
}
/** A logger that drops everything (for parts of the pipeline created without one). */
export declare const silentLogger: Logger;
/** `mp-tikz-wasm tex: ...` for an engine's line, `mp-tikz-wasm: ...` for the library's own. */
export declare function formatRecord(r: LogRecord): string;
/** The default sink. Errors and warnings use the console's own levels; the two
 *  verbose levels use console.log rather than console.debug, which Chrome
 *  hides under "Verbose" by default — someone who asked for the engines'
 *  output should see it without changing a DevTools filter. */
export declare function consoleSink(r: LogRecord): void;
/** `ok in 123 ms`-style helpers shared by the summaries. */
export declare function ms(x: number): string;
export declare function plural(n: number, noun: string): string;
export {};
