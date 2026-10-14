export interface WorkerRequest {
    id: number;
    op: 'init' | 'run' | 'latex' | 'addFiles' | 'clearCache' | 'preload' | 'prefetch' | 'setLogLevel' | 'dispose';
    [k: string]: unknown;
}
export interface WorkerResponse {
    id: number;
    ok: boolean;
    result?: unknown;
    error?: string;
}
export interface WorkerEvent {
    event: 'progress' | 'log' | 'record';
    data: unknown;
}
