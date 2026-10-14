/**
 * svg.ts — post-processing of MetaPost's SVG output (docs/07 §3.1). The C
 * output is left byte-identical to upstream; everything here is optional
 * polish applied on the string.
 */
import type { SvgPostOptions } from '../types.js';
export declare function postProcessSvg(svg: string, opts?: SvgPostOptions, figureIndex?: number): string;
/**
 * A regular-expression allow-list over the markup: keeps the SVG elements
 * MetaPost emits and drops everything else (scripts, event handlers,
 * foreignObject, external references).
 *
 * @deprecated Not a security boundary, and too narrow for what the engines
 * produce: it drops gradients (every PGF shading), patterns, `<style>` (the
 * faces of `fonts: 'woff2'`) and the geometry of circles, ellipses and lines.
 * Sanitise untrusted output with DOMPurify instead — the README's
 * "Untrusted sources" has the configuration. Kept, unchanged, so existing
 * callers do not break; to be removed at 1.0.
 */
export declare function sanitizeSvg(svg: string): string;
