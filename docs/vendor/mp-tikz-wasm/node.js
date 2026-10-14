export async function nodeIO() {
    const fs = await import('node:fs');
    // file:// URLs or plain paths; the ?v=<sha> on bundle file URLs is for HTTP caches, not the disk
    const strip = (u) => (u.startsWith('file://') ? decodeURIComponent(new URL(u).pathname) : u.replace(/\?v=[0-9a-f]+$/, ''));
    return {
        async fetch(url) { return new Uint8Array(fs.readFileSync(strip(url))); },
        fetchSync(url) { return new Uint8Array(fs.readFileSync(strip(url))); },
        async fetchJson(url) { return JSON.parse(fs.readFileSync(strip(url), 'utf8')); },
    };
}
export const isNode = typeof process !== 'undefined' && !!process.versions?.node && typeof globalThis.window === 'undefined';
//# sourceMappingURL=node.js.map