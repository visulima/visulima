/**
 * Optional native bindings for sort-package-json.
 *
 * The native addon (Rust via napi-rs) wraps the oxc-project/sort-package-json
 * crate, providing fast package.json sorting with 139 predefined field rules.
 *
 * Falls back to the pure JavaScript `sort-package-json` package when the native
 * addon is not available (not compiled, wrong platform, etc.).
 *
 * Build with: pnpm build:native
 * The napi v3 CLI outputs the .node file to the package root.
 */

import { createRequire } from "node:module";

export interface SortOptions {
    /** Enable formatted output with newlines (default: true) */
    pretty?: boolean;
    /** Alphabetize script commands (default: false) */
    sortScripts?: boolean;
}

interface NativeBindings {
    sortPackageJsonString: (contents: string) => string;
    sortPackageJsonStringWithOptions: (
        contents: string,
        options: { pretty?: boolean; sort_scripts?: boolean },
    ) => string;
}

let nativeBindings: NativeBindings | undefined;
let loadAttempted = false;

const esmRequire = createRequire(import.meta.url);

/**
 * Attempts to load the native addon. Returns undefined if unavailable.
 * The result is cached after the first attempt.
 *
 * napi v3 outputs the .node file to the package root as
 * `sort-package-json-native.<platform>.node`. The napi-generated index.js
 * handles platform detection automatically.
 *
 * Uses createRequire because the napi-generated index.js is CJS.
 */
const loadNativeBindings = (): NativeBindings | undefined => {
    if (loadAttempted) {
        return nativeBindings;
    }

    loadAttempted = true;

    try {
        const loaded = esmRequire("../index.js") as NativeBindings;

        // Validate that the loaded binding has the expected API surface.
        if (typeof loaded.sortPackageJsonString === "function" && typeof loaded.sortPackageJsonStringWithOptions === "function") {
            nativeBindings = loaded;
        }
    } catch {
        // Native addon not available - will use JavaScript fallback
        nativeBindings = undefined;
    }

    return nativeBindings;
};

/**
 * Returns true if the native addon is loaded and available.
 */
const isNativeAvailable = (): boolean => loadNativeBindings() !== undefined;

export type { NativeBindings };
export { isNativeAvailable, loadNativeBindings };
