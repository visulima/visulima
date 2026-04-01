/**
 * Native bindings for vis PM operations.
 *
 * The native addon (Rust via napi-rs) provides:
 * - Fast package manager detection (lockfile scanning)
 * - Zero-overhead command resolution across pnpm/npm/yarn/bun
 * - Native process execution via Rust std::process::Command
 * - Binary lookup via `which`
 *
 * Falls back to pure TypeScript implementations when the native
 * addon is not available (not compiled, wrong platform, etc.).
 *
 * Build with: napi build --platform --release --manifest-path native/Cargo.toml --output-dir .
 */

import { createRequire } from "node:module";

// ── Types matching Rust structs ──────────────────────────────────────

interface DetectedPackageManager {
    isWorkspace: boolean;
    name: string;
    /** Version from packageManager field, or undefined if unknown */
    version?: string;
}

interface ResolvedCommand {
    args: string[];
    bin: string;
    warnings: string[];
}

interface ExecResult {
    code: number;
    stderr: string;
    stdout: string;
}

interface InstallOptions {
    dev: boolean;
    filter: string[];
    force: boolean;
    frozenLockfile: boolean;
    ignoreScripts: boolean;
    lockfileOnly: boolean;
    noOptional: boolean;
    offline: boolean;
    prod: boolean;
    recursive: boolean;
    silent: boolean;
    workspaceRoot: boolean;
}

interface AddOptions {
    exact: boolean;
    filter: string[];
    global: boolean;
    optional: boolean;
    packages: string[];
    peer: boolean;
    saveDev: boolean;
    workspace: boolean;
    workspaceRoot: boolean;
}

interface RemoveOptions {
    filter: string[];
    global: boolean;
    packages: string[];
    recursive: boolean;
    saveDev: boolean;
    workspaceRoot: boolean;
}

interface WhyOptions {
    /** Uses Option<i32> in Rust - pass undefined for no depth limit (not null!) */
    depth?: number;
    dev: boolean;
    filter: string[];
    global: boolean;
    json: boolean;
    long: boolean;
    noOptional: boolean;
    packages: string[];
    parseable: boolean;
    prod: boolean;
    recursive: boolean;
}

interface OutdatedOptions {
    compatible: boolean;
    dev: boolean;
    filter: string[];
    format: string;
    global: boolean;
    long: boolean;
    noOptional: boolean;
    packages: string[];
    prod: boolean;
    recursive: boolean;
    workspaceRoot: boolean;
}

interface DlxOptions {
    additionalPackages: string[];
    args: string[];
    package: string;
    shellMode: boolean;
    silent: boolean;
}

interface ExecOptions {
    args: string[];
    command: string;
    filter: string[];
    parallel: boolean;
    recursive: boolean;
    reverse: boolean;
    shellMode: boolean;
    workspaceRoot: boolean;
}

interface CleanResult {
    errors: string[];
    lockfilesRemoved: string[];
    removed: string[];
}

interface NativeBindings {
    cleanWorkspace: (root: string, removeLockfile: boolean) => CleanResult;
    detectPackageManager: (cwd: string) => DetectedPackageManager;
    execPmCommand: (bin: string, args: string[], cwd: string) => ExecResult;
    execPmCommandInteractive: (bin: string, args: string[], cwd: string) => number;
    resolveAdd: (pm: string, version: string, opts: AddOptions) => ResolvedCommand;
    resolveDedupe: (pm: string, version: string, check: boolean) => ResolvedCommand;
    resolveDlx: (pm: string, version: string, opts: DlxOptions) => ResolvedCommand;
    resolveExec: (pm: string, version: string, opts: ExecOptions) => ResolvedCommand;
    resolveInstall: (pm: string, version: string, opts: InstallOptions) => ResolvedCommand;
    resolveLink: (pm: string, target: string | null) => ResolvedCommand;
    resolveOutdated: (pm: string, version: string, opts: OutdatedOptions) => ResolvedCommand;
    resolvePmCommand: (pm: string, version: string, subcommand: string, extraArgs: string[]) => ResolvedCommand;
    resolveRemove: (pm: string, version: string, opts: RemoveOptions) => ResolvedCommand;
    resolveUnlink: (pm: string, version: string, packages: string[], recursive: boolean) => ResolvedCommand;
    resolveWhy: (pm: string, version: string, opts: WhyOptions) => ResolvedCommand;
    whichBin: (name: string) => string | null;
}

let nativeBindings: NativeBindings | undefined;
let loadAttempted = false;

const esmRequire = createRequire(import.meta.url);

/**
 * Attempts to load the native addon. Returns undefined if unavailable.
 * The result is cached after the first attempt.
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
        if (typeof loaded.detectPackageManager === "function" && typeof loaded.execPmCommand === "function") {
            nativeBindings = loaded;
        }
    } catch {
        nativeBindings = undefined;
    }

    return nativeBindings;
};

/**
 * Returns true if the native addon is loaded and available.
 */
const isNativeAvailable = (): boolean => loadNativeBindings() !== undefined;

export type {
    AddOptions,
    CleanResult,
    DetectedPackageManager,
    DlxOptions,
    ExecOptions,
    ExecResult,
    InstallOptions,
    NativeBindings,
    OutdatedOptions,
    RemoveOptions,
    ResolvedCommand,
    WhyOptions,
};
export { isNativeAvailable, loadNativeBindings };
