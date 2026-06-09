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
     * Windows-only: spawn the directly-exec'd `argv` suspended, inject
     * the `fspy_windows` DLL (at `dllPath`) via
     * `CreateRemoteThread(LoadLibraryW)`, and collect the IAT-hooked
     * accesses streamed over a named pipe. Same result shape as
     * `trackWithSeccomp`. Present only when the addon was built for a
     * Windows target.
     */
    trackWithIatHook?: (
        argv: string[],
        dllPath: string,
        options?: NativeSeccompSpawnOptions,
        onStarted?: (pid: number) => void,
    ) => Promise<NativeSeccompTrackingResult>;

    /**
     * macOS-only: spawn the directly-exec'd `argv` with the
     * `fspy_macos` interpose dylib (at `dylibPath`) injected via
     * `DYLD_INSERT_LIBRARIES` and collect reported accesses. Same
     * result shape as `trackWithSeccomp`. Present only when the
     * addon was built for a macOS target.
     */
    trackWithInterpose?: (
        argv: string[],
        dylibPath: string,
        options?: NativeSeccompSpawnOptions,
        onStarted?: (pid: number) => void,
    ) => Promise<NativeSeccompTrackingResult>;

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
 * When truthy, a missing/unusable native addon is a hard error instead of
 * a silent degrade to the slower pure-JS path. Intended for CI/production
 * where running on the fallback unnoticed would mask a broken install and
 * the perf/behaviour differences that come with it. Checked under both the
 * package-scoped name and the `VIS_`-prefixed alias `@visulima/vis` users
 * would reach for.
 */
const isRequireNativeEnabled = (): boolean => {
    const value = process.env["TASK_RUNNER_REQUIRE_NATIVE"] ?? process.env["VIS_REQUIRE_NATIVE"];

    return value === "1" || value === "true";
};

/**
 * Surfaces a missing native addon exactly once. Hard-fails when
 * `TASK_RUNNER_REQUIRE_NATIVE`/`VIS_REQUIRE_NATIVE` is set; otherwise emits a
 * single process warning so the degrade to pure JS is visible rather than
 * silent. Only fires for the genuine fallback case (hashing/graph ops) — the
 * concurrent runner's JS path is a deliberate capability choice (stdin/PTY/
 * streaming the addon can't do), not a degradation, so it never routes here.
 */
const reportMissingNative = (cause: unknown): void => {
    const detail = cause instanceof Error ? cause.message : "native addon not found";

    if (isRequireNativeEnabled()) {
        throw new Error(
            `@visulima/task-runner: native addon is required (TASK_RUNNER_REQUIRE_NATIVE/VIS_REQUIRE_NATIVE is set) but could not be loaded: ${detail}. `
            + "Install the matching @visulima/task-runner-binding-* package, or build it with `pnpm build:native`.",
        );
    }

    process.emitWarning(
        `@visulima/task-runner native addon not loaded (${detail}); falling back to the slower pure-JS implementation. `
        + "File hashing and graph operations will be slower. Install the matching @visulima/task-runner-binding-* package, "
        + "or run `pnpm build:native`. Set TASK_RUNNER_REQUIRE_NATIVE=1 to fail instead, or NODE_NO_WARNINGS=1 to silence this.",
        { code: "TASK_RUNNER_NATIVE_FALLBACK", type: "Warning" },
    );
};

/**
 * Attempts to load the native addon. Returns undefined if unavailable.
 * The result is cached after the first attempt.
 *
 * napi v3 outputs the .node file to the package root as
 * `task-runner-native.&lt;platform>.node`. The napi-generated index.js
 * handles platform detection automatically.
 *
 * Uses createRequire because the napi-generated index.js is CJS.
 *
 * On failure the degrade to JS is announced once via {@link reportMissingNative}
 * (or hard-fails under `TASK_RUNNER_REQUIRE_NATIVE`) so it is never silent.
 */
const loadNativeBindings = (): NativeBindings | undefined => {
    if (loadAttempted) {
        return nativeBindings;
    }

    loadAttempted = true;

    let cause: unknown;

    try {
        const loaded = esmRequire("../index.js") as NativeBindings;

        // Validate that the loaded binding has the expected API surface.
        // A stale .node binary may load successfully but be missing functions.
        if (typeof loaded.hashCommand === "function" && typeof loaded.hashFile === "function" && typeof loaded.runConcurrent === "function") {
            nativeBindings = loaded;
        } else {
            cause = new Error("native addon loaded but is missing expected exports (stale or version-mismatched binary)");
        }
    } catch (error) {
        // Native addon not available - will use TypeScript fallbacks
        nativeBindings = undefined;
        cause = error;
    }

    if (nativeBindings === undefined) {
        reportMissingNative(cause);
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
