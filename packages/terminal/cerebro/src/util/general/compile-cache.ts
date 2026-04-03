/**
 * V8 compile cache helper for faster CLI startup.
 *
 * Enables the V8 compile cache so that subsequent runs of the CLI skip
 * re-parsing and re-compiling JavaScript/TypeScript source files. This
 * can reduce startup time by 30-70% for large CLI tools.
 *
 * ## When to use
 *
 * Call `enableCompileCache()` early in your CLI entry point, after heap
 * tuning but before importing heavy modules:
 *
 * ```typescript
 * // bin.ts
 * import { applyHeapTuning } from "@visulima/cerebro/heap-tuning";
 * import { enableCompileCache } from "@visulima/cerebro/compile-cache";
 *
 * applyHeapTuning();
 * enableCompileCache();
 *
 * import { createCerebro } from "@visulima/cerebro";
 * // ... rest of your CLI setup
 * ```
 *
 * ## How it works
 *
 * 1. Tries `module.enableCompileCache()` (Node.js 22.8+ native API) which
 *    stores compiled bytecode alongside source files for instant reuse.
 * 2. If that's unavailable, falls back to the `v8-compile-cache` npm package
 *    which achieves a similar effect on older Node.js versions.
 * 3. If neither is available, silently does nothing — startup is just slower.
 * @module
 */

/**
 * Enable V8 compile cache for faster subsequent CLI startups.
 *
 * Safe to call unconditionally — silently no-ops if the runtime doesn't
 * support compile caching or the fallback package isn't installed.
 */
const enableCompileCache = (): void => {
    try {
        // Node.js 22.8+ exposes enableCompileCache on the Module built-in
        // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
        const nodeModule = require("node:module") as { enableCompileCache?: () => void };

        if (typeof nodeModule.enableCompileCache === "function") {
            nodeModule.enableCompileCache();

            return;
        }
    } catch {
        // Not available in this runtime
    }

    try {
        // Fallback for older Node.js versions
        // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
        require("v8-compile-cache");
    } catch {
        // v8-compile-cache not installed — that's fine
    }
};

export default enableCompileCache;
