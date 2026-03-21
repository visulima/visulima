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

/**
 * Attempts to load the native addon. Returns undefined if unavailable.
 * The result is cached after the first attempt.
 *
 * napi v3 outputs the .node file to the package root as
 * `task-runner-native.&lt;platform>.node`. The napi-generated binding.js
 * handles platform detection automatically.
 */
const loadNativeBindings = (): NativeBindings | undefined => {
    if (loadAttempted) {
        return nativeBindings;
    }

    loadAttempted = true;

    try {
        // Try napi v3 output location (package root, platform-specific name)
        // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require,import/no-dynamic-require
        nativeBindings = require(`../task-runner-native.${process.platform}-${process.arch === "x64" ? "x86_64" : process.arch}.node`) as NativeBindings;
    } catch {
        try {
            // Fallback: try the napi-generated binding.js (handles platform detection)
            // eslint-disable-next-line @typescript-eslint/no-require-imports,global-require
            nativeBindings = require("../task-runner-native.js") as NativeBindings;
        } catch {
            // Native addon not available - will use TypeScript fallbacks
            nativeBindings = undefined;
        }
    }

    return nativeBindings;
};

/**
 * Returns true if the native addon is loaded and available.
 */
const isNativeAvailable = (): boolean => loadNativeBindings() !== undefined;

export type { NativeBindings, NativeCycleResult, NativeFileHash, NativeTaskGraph, NativeTaskHashDetails };
export { isNativeAvailable, loadNativeBindings };
