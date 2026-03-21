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

export interface NativeFileHash {
    path: string;
    hash: string;
}

export interface NativeTaskHashDetails {
    command: string;
    nodes: string[][];
    implicit_deps?: string[][];
    runtime?: string[][];
}

export interface NativeTaskGraph {
    task_ids: string[];
    edges: string[][];
}

export interface NativeCycleResult {
    has_cycle: boolean;
    cycle: string[];
}

export interface NativeBindings {
    // File hashing
    hashFile(filePath: string): string;
    collectFiles(dir: string): string[];
    hashFilesInDirectory(dir: string, workspaceRoot: string): NativeFileHash[];
    hashFilesBatch(filePaths: string[], workspaceRoot: string): NativeFileHash[];
    hashString(input: string): string;
    hashStrings(inputs: string[]): string;

    // Task hashing
    hashCommand(project: string, target: string, configuration: string | null, overridesJson: string): string;
    computeTaskHash(details: NativeTaskHashDetails): string;
    hashEnvVar(name: string, value: string): string;

    // Graph operations
    findCycle(graph: NativeTaskGraph): NativeCycleResult;
    findAllCycles(graph: NativeTaskGraph): string[][];
    topologicalSort(graph: NativeTaskGraph): string[];
    findBackEdges(graph: NativeTaskGraph): string[][];
    getTransitiveDeps(graph: NativeTaskGraph, taskId: string): string[];
    getDependentTasks(graph: NativeTaskGraph, taskId: string): string[];
}

let _nativeBindings: NativeBindings | null = null;
let _loadAttempted = false;

/**
 * Attempts to load the native addon. Returns null if unavailable.
 * The result is cached after the first attempt.
 *
 * napi v3 outputs the .node file to the package root as
 * `task-runner-native.<platform>.node`. The napi-generated binding.js
 * handles platform detection automatically.
 */
export const loadNativeBindings = (): NativeBindings | null => {
    if (_loadAttempted) {
        return _nativeBindings;
    }

    _loadAttempted = true;

    try {
        // Try napi v3 output location (package root, platform-specific name)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        _nativeBindings = require(`../task-runner-native.${process.platform}-${process.arch === "x64" ? "x86_64" : process.arch}.node`) as NativeBindings;
    } catch {
        try {
            // Fallback: try the napi-generated binding.js (handles platform detection)
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            _nativeBindings = require("../task-runner-native.js") as NativeBindings;
        } catch {
            // Native addon not available - will use TypeScript fallbacks
            _nativeBindings = null;
        }
    }

    return _nativeBindings;
};

/**
 * Returns true if the native addon is loaded and available.
 */
export const isNativeAvailable = (): boolean => {
    return loadNativeBindings() !== null;
};
