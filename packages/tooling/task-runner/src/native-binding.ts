/**
 * Optional native bindings for performance-critical operations.
 *
 * The native addon (Rust via napi-rs) provides:
 * - Parallel file hashing using rayon + xxHash xxh3-128
 * - Optimized task hash computation
 * - Fast graph operations (cycle detection, topological sort)
 *
 * Falls back to pure TypeScript implementations when the native
 * addon is not available (not compiled, wrong platform, etc.).
 *
 * Build with: pnpm build:native
 * The napi v3 CLI outputs the .node file to the package root.
 */

import { createRequire } from "node:module";

interface NativeFileHash {
    hash: string;
    path: string;
}

interface NativeTaskHashDetails {
    command: string;
    implicit_deps?: string[][];
    nodes: string[][];
    runtime?: string[][];
}

interface NativeTaskGraph {
    edges: string[][];
    task_ids: string[];
}

interface NativeCycleResult {
    cycle: string[];
    has_cycle: boolean;
}

interface NativeBindings {
    collectFiles: (directory: string) => string[];
    computeTaskHash: (details: NativeTaskHashDetails) => string;
    findAllCycles: (graph: NativeTaskGraph) => string[][];
    findBackEdges: (graph: NativeTaskGraph) => string[][];
    // Graph operations
    findCycle: (graph: NativeTaskGraph) => NativeCycleResult;
    getDependentTasks: (graph: NativeTaskGraph, taskId: string) => string[];

    getTransitiveDeps: (graph: NativeTaskGraph, taskId: string) => string[];
    // Task hashing
    hashCommand: (project: string, target: string, configuration: string | undefined, overridesJson: string) => string;
    hashEnvVar: (name: string, value: string) => string;

    // File hashing
    hashFile: (filePath: string) => string;
    hashFilesBatch: (filePaths: string[], workspaceRoot: string) => NativeFileHash[];
    hashFilesInDirectory: (directory: string, workspaceRoot: string) => NativeFileHash[];
    hashString: (input: string) => string;
    hashStrings: (inputs: string[]) => string;
    topologicalSort: (graph: NativeTaskGraph) => string[];
}

let nativeBindings: NativeBindings | undefined;
let loadAttempted = false;

const esmRequire = createRequire(import.meta.url);

/**
 * Attempts to load the native addon. Returns undefined if unavailable.
 * The result is cached after the first attempt.
 *
 * napi v3 outputs the .node file to the package root as
 * `task-runner-native.<platform>.node`. The napi-generated index.js
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
        // A stale .node binary may load successfully but be missing functions.
        if (typeof loaded.hashCommand === "function" && typeof loaded.hashFile === "function") {
            nativeBindings = loaded;
        }
    } catch {
        // Native addon not available - will use TypeScript fallbacks
        nativeBindings = undefined;
    }

    return nativeBindings;
};

/**
 * Returns true if the native addon is loaded and available.
 */
const isNativeAvailable = (): boolean => loadNativeBindings() !== undefined;

export type { NativeBindings, NativeCycleResult, NativeFileHash, NativeTaskGraph, NativeTaskHashDetails };
export { isNativeAvailable, loadNativeBindings };
