import type { BundleName, BundleSpec } from './types.js';
export declare const DEFAULT_BUNDLES: BundleName[];
export declare function resolveBundleSpecs(bundles: (BundleName | BundleSpec)[], base: string): BundleSpec[];
