/**
 * Optional native bindings for performance-critical operations.
 *
 * The native addon (Rust via napi-rs) provides:
 * - Parallel file hashing using rayon
 * - Optimized task hash computation
 * - Fast graph operations (cycle detection, topological sort)
 *
 * Falls back to pure TypeScript implementations when the native
 * addon is not available (not compiled, wrong platform, etc.).
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
 */
export const loadNativeBindings = (): NativeBindings | null => {
    if (_loadAttempted) {
        return _nativeBindings;
    }

    _loadAttempted = true;

    try {
        // Try to load the compiled native addon
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        _nativeBindings = require("../native/index.node") as NativeBindings;
    } catch {
        // Native addon not available - will use TypeScript fallbacks
        _nativeBindings = null;
    }

    return _nativeBindings;
};

/**
 * Returns true if the native addon is loaded and available.
 */
export const isNativeAvailable = (): boolean => {
    return loadNativeBindings() !== null;
};
