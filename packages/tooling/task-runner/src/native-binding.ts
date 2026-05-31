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

interface NativeConcurrentCommandConfig {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    name?: string;
    shell?: boolean;
    stdin?: string;
}

interface NativeConcurrentRunnerOptions {
    killOthers?: string[];
    killSignal?: string;
    killTimeout?: number;
    maxProcesses?: number;
    shellPath?: string;
    successCondition?: string;
}

interface NativeProcessEvent {
    commandName?: string;
    durationMs?: number;
    exitCode?: number;
    index: number;
    killed?: boolean;
    kind: string;
    message?: string;
    pid?: number;
    text?: string;
}

interface NativeConcurrentCloseEvent {
    command: string;
    durationMs: number;
    exitCode: number;
    index: number;
    killed: boolean;
    name?: string;
}

interface NativeConcurrentRunResult {
    closeEvents: NativeConcurrentCloseEvent[];
    success: boolean;
}

interface NativeBindings {
    collectFiles: (directory: string) => string[];
    computeTaskHash: (details: NativeTaskHashDetails) => string;
    findAllCycles: (graph: NativeTaskGraph) => string[][];
    findBackEdges: (graph: NativeTaskGraph) => string[][];
    // Graph operations
    findCycle: (graph: NativeTaskGraph) => NativeCycleResult;
    getDependentTasks: (graph: NativeTaskGraph, taskId: string) => string[];

    // Worktree detection (returns the main worktree root for a linked git
    // worktree, or undefined for primary checkouts / non-git directories).
    getMainWorktreeRoot: (workspaceRoot: string) => string | undefined | null;
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
    isLinkedWorktree: (workspaceRoot: string) => boolean;

    resetWorktreeCache: () => void;
    // Concurrent process runner
    runConcurrent: (
        commands: NativeConcurrentCommandConfig[],
        options: NativeConcurrentRunnerOptions,
        onEvent: (event: NativeProcessEvent) => void,
    ) => Promise<NativeConcurrentRunResult>;
    runConcurrentBatch: (
        commands: NativeConcurrentCommandConfig[],
        options: NativeConcurrentRunnerOptions,
        onLifecycle?: ((event: NativeProcessEvent) => void) | null,
    ) => Promise<NativeConcurrentRunResult>;
    topologicalSort: (graph: NativeTaskGraph) => string[];

    /**
     * Linux-only: spawn `argv` under seccomp_unotify tracking via
     * the helper binary at `helperPath`. Resolves once the child
     * exits with the gathered file accesses.
     *
     * `onStarted` (when supplied) fires once with the helper PID
     * as soon as the spawn succeeds. The PID survives the
     * helper→target execve, so callers can SIGTERM it via
     * `process.kill(pid)` to abort the traced command.
     *
     * Undefined when the addon was built on a non-Linux target.
     */
    trackWithSeccomp?: (
        argv: string[],
        helperPath: string,
        options?: NativeSeccompSpawnOptions,
        onStarted?: (pid: number) => void,
    ) => Promise<NativeSeccompTrackingResult>;
}

interface NativeSeccompSpawnOptions {
    cwd?: string;
    /** Extra env vars merged on top of the parent's. */
    env?: Record<string, string>;
}

interface NativeSeccompFileAccess {
    kind: "missing" | "read" | "readdir" | "stat" | "write";
    path: string;
}

interface NativeSeccompTrackingResult {
    accesses: NativeSeccompFileAccess[];
    exitCode: number;
    stderr: Buffer;
    stdout: Buffer;
}

let nativeBindings: NativeBindings | undefined;
let loadAttempted = false;

const esmRequire = createRequire(import.meta.url);

/**
 * Attempts to load the native addon. Returns undefined if unavailable.
 * The result is cached after the first attempt.
 *
 * napi v3 outputs the .node file to the package root as
 * `task-runner-native.&lt;platform>.node`. The napi-generated index.js
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
        if (typeof loaded.hashCommand === "function" && typeof loaded.hashFile === "function" && typeof loaded.runConcurrent === "function") {
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

export type {
    NativeBindings,
    NativeConcurrentCloseEvent,
    NativeConcurrentCommandConfig,
    NativeConcurrentRunnerOptions,
    NativeConcurrentRunResult,
    NativeCycleResult,
    NativeFileHash,
    NativeProcessEvent,
    NativeSeccompFileAccess,
    NativeSeccompSpawnOptions,
    NativeSeccompTrackingResult,
    NativeTaskGraph,
    NativeTaskHashDetails,
};
export { isNativeAvailable, loadNativeBindings };
