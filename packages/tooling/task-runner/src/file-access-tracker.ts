import { execFile, execFileSync } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { platform } from "node:os";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { join, resolve } from "@visulima/path";

import { loadNativeBindings } from "./native-binding";
import { withEnhancedPath } from "./path-utils";
import { uniqueId } from "./utils";

/**
 * Lazily checks whether strace is available on the current system.
 * Caches the result after the first call.
 */
let straceAvailable: boolean | undefined;

const isStraceAvailable = (): boolean => {
    if (straceAvailable === undefined) {
        try {
            execFileSync("strace", ["-V"], { stdio: "ignore" });
            straceAvailable = true;
        } catch {
            straceAvailable = false;
        }
    }

    return straceAvailable;
};

/**
 * Lazily resolves the path to the bundled `fspy-seccomp-helper`
 * binary. Returns `undefined` when:
 * - not on Linux,
 * - the native addon failed to load,
 * - the addon doesn't expose `trackWithSeccomp` (built for a
 *   non-Linux target),
 * - or no helper binary is locatable on disk.
 *
 * The helper ships alongside the native `.node` addon — the napi
 * platform binding packages have the addon at their root and the
 * helper one directory above. Falls back to a dev location for
 * `cargo build --debug` workflows.
 */
interface HelperPathCache {
    /** Resolved path, or `""` for "looked but didn't find one". */
    value: string;
}

let helperPathCache: HelperPathCache | undefined;

const resolveSeccompHelperPath = (): string | undefined => {
    if (helperPathCache !== undefined) {
        return helperPathCache.value === "" ? undefined : helperPathCache.value;
    }

    if (platform() !== "linux") {
        helperPathCache = { value: "" };

        return undefined;
    }

    const candidates: string[] = [];

    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const cjsRequire = createRequire(import.meta.url);

        // Production: the helper ships in every Linux binding
        // package (gnu, musl, x86_64, aarch64). Try each; whichever
        // matches the host's arch/libc resolves cleanly, the others
        // throw ERR_MODULE_NOT_FOUND and get skipped.
        const bindingPackages = [
            "@visulima/task-runner-binding-linux-x64-gnu",
            "@visulima/task-runner-binding-linux-x64-musl",
            "@visulima/task-runner-binding-linux-arm64-gnu",
            "@visulima/task-runner-binding-linux-arm64-musl",
        ];

        for (const pkg of bindingPackages) {
            try {
                const pkgJsonPath = cjsRequire.resolve(`${pkg}/package.json`);

                candidates.push(join(dirname(pkgJsonPath), "fspy-seccomp-helper"));
            } catch {
                // Binding not installed for this host — try the next.
            }
        }

        // Source tree fallback (`pnpm build:native:debug` output).
        candidates.push(
            join(here, "..", "native", "fspy_seccomp", "target", "debug", "fspy-seccomp-helper"),
            join(here, "..", "native", "fspy_seccomp", "target", "release", "fspy-seccomp-helper"),
        );
    } catch {
        // import.meta.url may be unusable in some bundler outputs;
        // skip the resolve and fall through to the null cache.
    }

    for (const candidate of candidates) {
        try {
            accessSync(candidate, fsConstants.X_OK);
            helperPathCache = { value: candidate };

            return candidate;
        } catch {
            // Try the next candidate.
        }
    }

    helperPathCache = { value: "" };

    return undefined;
};

/**
 * Returns true when seccomp_unotify tracking is available on this
 * host (Linux + the native addon's `trackWithSeccomp` is exposed +
 * the helper binary is on disk). Cached after the first call.
 */
let seccompAvailable: boolean | undefined;

const isSeccompAvailable = (): boolean => {
    if (seccompAvailable !== undefined) {
        return seccompAvailable;
    }

    if (platform() !== "linux") {
        seccompAvailable = false;

        return false;
    }

    const native = loadNativeBindings();

    if (!native?.trackWithSeccomp) {
        seccompAvailable = false;

        return false;
    }

    seccompAvailable = resolveSeccompHelperPath() !== undefined;

    return seccompAvailable;
};

/**
 * Lazily resolves the bundled `fspy-macos.dylib` (the DYLD-interpose
 * tracker injected into directly-exec'd children on macOS). Mirrors
 * {@link resolveSeccompHelperPath}: the dylib ships in each darwin
 * binding package, with a source-tree fallback for `cargo build`.
 */
let dylibPathCache: HelperPathCache | undefined;

const resolveInterposeDylibPath = (): string | undefined => {
    if (dylibPathCache !== undefined) {
        return dylibPathCache.value === "" ? undefined : dylibPathCache.value;
    }

    if (platform() !== "darwin") {
        dylibPathCache = { value: "" };

        return undefined;
    }

    const candidates: string[] = [];

    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const cjsRequire = createRequire(import.meta.url);

        for (const pkg of ["@visulima/task-runner-binding-darwin-arm64", "@visulima/task-runner-binding-darwin-x64"]) {
            try {
                const pkgJsonPath = cjsRequire.resolve(`${pkg}/package.json`);

                candidates.push(join(dirname(pkgJsonPath), "fspy-macos.dylib"));
            } catch {
                // Binding not installed for this host — try the next.
            }
        }

        // Source-tree fallback (`cargo build [--release]` output). The
        // cdylib's `fspy-macos` crate name maps to `libfspy_macos.dylib`.
        candidates.push(
            join(here, "..", "native", "fspy_macos", "target", "debug", "libfspy_macos.dylib"),
            join(here, "..", "native", "fspy_macos", "target", "release", "libfspy_macos.dylib"),
        );
    } catch {
        // import.meta.url unusable in some bundler outputs — null cache.
    }

    for (const candidate of candidates) {
        try {
            accessSync(candidate, fsConstants.R_OK);
            dylibPathCache = { value: candidate };

            return candidate;
        } catch {
            // Try the next candidate.
        }
    }

    dylibPathCache = { value: "" };

    return undefined;
};

/**
 * True when interpose tracking is available (macOS + the addon exposes
 * `trackWithInterpose` + the dylib is on disk). Cached.
 */
let interposeAvailable: boolean | undefined;

const isInterposeAvailable = (): boolean => {
    if (interposeAvailable !== undefined) {
        return interposeAvailable;
    }

    if (platform() !== "darwin") {
        interposeAvailable = false;

        return false;
    }

    if (!loadNativeBindings()?.trackWithInterpose) {
        interposeAvailable = false;

        return false;
    }

    interposeAvailable = resolveInterposeDylibPath() !== undefined;

    return interposeAvailable;
};

/**
 * Lazily resolves the bundled `fspy-windows.dll` (the IAT-hook tracker
 * injected into directly-exec'd children on Windows). Mirrors
 * {@link resolveInterposeDylibPath} for the win32 binding packages, with
 * a source-tree fallback for `cargo build`.
 */
let windowsDllPathCache: HelperPathCache | undefined;

const resolveWindowsDllPath = (): string | undefined => {
    if (windowsDllPathCache !== undefined) {
        return windowsDllPathCache.value === "" ? undefined : windowsDllPathCache.value;
    }

    if (platform() !== "win32") {
        windowsDllPathCache = { value: "" };

        return undefined;
    }

    const candidates: string[] = [];

    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const cjsRequire = createRequire(import.meta.url);

        for (const pkg of ["@visulima/task-runner-binding-win32-x64-msvc", "@visulima/task-runner-binding-win32-arm64-msvc"]) {
            try {
                const pkgJsonPath = cjsRequire.resolve(`${pkg}/package.json`);

                candidates.push(join(dirname(pkgJsonPath), "fspy-windows.dll"));
            } catch {
                // Binding not installed for this host — try the next.
            }
        }

        // Source-tree fallback (`cargo build [--release]`). The cdylib has no
        // `lib` prefix on Windows → `fspy_windows.dll`.
        candidates.push(
            join(here, "..", "native", "fspy_windows", "target", "debug", "fspy_windows.dll"),
            join(here, "..", "native", "fspy_windows", "target", "release", "fspy_windows.dll"),
        );
    } catch {
        // import.meta.url unusable in some bundler outputs — null cache.
    }

    for (const candidate of candidates) {
        try {
            accessSync(candidate, fsConstants.R_OK);
            windowsDllPathCache = { value: candidate };

            return candidate;
        } catch {
            // Try the next candidate.
        }
    }

    windowsDllPathCache = { value: "" };

    return undefined;
};

/**
 * True when IAT-hook tracking is available (Windows + the addon exposes
 * `trackWithIatHook` + the DLL is on disk). Cached.
 */
let iatHookAvailable: boolean | undefined;

const isIatHookAvailable = (): boolean => {
    if (iatHookAvailable !== undefined) {
        return iatHookAvailable;
    }

    if (platform() !== "win32") {
        iatHookAvailable = false;

        return false;
    }

    if (!loadNativeBindings()?.trackWithIatHook) {
        iatHookAvailable = false;

        return false;
    }

    iatHookAvailable = resolveWindowsDllPath() !== undefined;

    return iatHookAvailable;
};

/**
 * Shell syntax that means a command can't be exec'd as a single binary
 * — so the macOS interpose path (which exec's directly, never through
 * `/bin/sh`, to survive SIP) can't handle it and must defer to the
 * preload fallback. Quotes/globs/expansions all disqualify.
 */
const SHELL_SYNTAX = /[\t\n!"#$&'()*;<>?[\\\]`{|}~]/u;

/**
 * Returns the argv for a command that is a single direct binary
 * invocation with no shell syntax, or `undefined` when a shell is
 * required. Conservative by design: anything that could behave
 * differently under `execvp` than under a shell is rejected so the
 * caller falls back to the (shell-based) preload path.
 */
export const parseDirectExec = (command: string): string[] | undefined => {
    const trimmed = command.trim();

    if (trimmed === "" || SHELL_SYNTAX.test(trimmed)) {
        return undefined;
    }

    const argv = trimmed.split(/\s+/u);

    return argv.length > 0 ? argv : undefined;
};

/**
 * Represents a file access recorded during task execution.
 *
 * Write-intent accesses (`"write"`) are emitted when a task opens a file
 * with `O_WRONLY`/`O_RDWR`/`O_CREAT`/`O_TRUNC` flags (strace) or calls
 * `writeFile`/`appendFile`/`unlink`/`rename` (preload script).
 * The orchestrator uses the overlap of reads and writes to the same
 * workspace path to detect self-modifying tasks and skip caching.
 */
export interface FileAccess {
    /** The absolute path of the file */
    path: string;
    /** The type of access */
    type: "missing" | "read" | "readdir" | "stat" | "write";
}

/**
 * Result of tracking file accesses during a command execution.
 */
export interface TrackingResult {
    /** All file accesses recorded */
    accesses: FileAccess[];
    /** The command exit code */
    code: number;
    /** The command stdout + stderr output */
    output: string;
}

/**
 * Strace syscall patterns and their corresponding file access types.
 * Order matters — first match wins.
 *
 * For open/openat the resolved type depends on the flag list, which
 * {@link parseOpenAccessType} inspects separately. These entries mark
 * the pattern as an `open`-family syscall; the actual read/write type
 * is decided in {@link FileAccessTracker.parseStraceLine}.
 */
const STRACE_PATTERNS: ReadonlyArray<{ kind: "access" | "creat" | "getdents" | "open" | "stat"; pattern: RegExp }> = [
    { kind: "open", pattern: /openat\(AT_FDCWD,\s*"([^"]+)"/ },
    { kind: "open", pattern: /^(?:\d+\s+)?open\("([^"]+)"/ },
    { kind: "creat", pattern: /(?:^|\s)creat\("([^"]+)"/ },
    { kind: "stat", pattern: /(?:stat|lstat|newfstatat)\((?:AT_FDCWD,\s*)?"([^"]+)"/ },
    { kind: "stat", pattern: /access\("([^"]+)"/ },
    { kind: "getdents", pattern: /getdents(?:64)?\(\d+/ },
];

/**
 * Returns `"write"` when the open-family flags imply write intent,
 * `"read"` otherwise. Checks for `O_WRONLY`/`O_RDWR`/`O_CREAT`/`O_TRUNC`
 * in the strace-formatted flag list.
 */
const parseOpenAccessType = (line: string): "read" | "write" => {
    if (/O_WRONLY|O_RDWR|O_CREAT|O_TRUNC|O_APPEND/.test(line)) {
        return "write";
    }

    return "read";
};

/**
 * Minimal duck-typed surface `killAll()` needs. `ChildProcess`
 * satisfies this directly; the seccomp dispatch synthesises a stub
 * around `process.kill(pid, signal)` so its helper PID participates
 * in the same kill-on-abort plumbing.
 *
 * The return type accepts `boolean | undefined` to cover both
 * `ChildProcess.kill` (returns `boolean`) and `process.kill`
 * (returns `void` in some Node typings) without unioning `void`,
 * which `@typescript-eslint/no-invalid-void-type` rightly flags.
 */
interface Killable {
    kill: (signal?: NodeJS.Signals | number) => boolean | undefined;
}

/**
 * Wire a per-call `AbortSignal` to SIGTERM a `Killable` spawn.
 * Used by every dispatch path (seccomp, strace, no-tracking) so
 * cancellation behaves identically regardless of which tracker is
 * active — a caller that aborts always kills the spawned process.
 *
 * Returns a detach function the caller invokes once the spawn
 * completes, so the listener can't leak past the command's life.
 * If the signal is already aborted, kills immediately.
 */
const wireAbort = (signal: AbortSignal | undefined, target: Killable): (() => void) => {
    if (!signal) {
        return () => {};
    }

    const kill = (): void => {
        try {
            target.kill("SIGTERM");
        } catch {
            // Process already exited — nothing to terminate.
        }
    };

    if (signal.aborted) {
        kill();

        return () => {};
    }

    signal.addEventListener("abort", kill, { once: true });

    return () => {
        signal.removeEventListener("abort", kill);
    };
};

/**
 * Tracks which files a child process accesses during execution.
 *
 * Uses `strace` on Linux to intercept syscalls (open, openat, stat, lstat, access, getdents).
 * Falls back to no tracking on unsupported platforms.
 */
export class FileAccessTracker {
    readonly #workspaceRoot: string;

    readonly #excludePatterns: RegExp[];

    /**
     * Tracks active processes for kill-on-abort. ChildProcess
     * (strace path) and the seccomp helper PID stub both implement
     * the `Killable` shape so `killAll()` can iterate the union.
     */
    readonly #activeProcesses = new Set<Killable>();

    public constructor(workspaceRoot: string, excludePatterns?: RegExp[]) {
        this.#workspaceRoot = resolve(workspaceRoot);
        this.#excludePatterns = excludePatterns ?? [
            /\/proc\//,
            /\/sys\//,
            /\/dev\//,
            /\/tmp\//,
            /\/etc\//,
            /\.so(\.\d+)*$/,
            /node_modules\/.package-lock\.json$/,
        ];
    }

    /**
     * Returns true if file access tracking is supported on the current platform.
     */
    // eslint-disable-next-line class-methods-use-this
    public isSupported(): boolean {
        return platform() === "linux" && (isSeccompAvailable() || isStraceAvailable());
    }

    /**
     * True when the macOS DYLD-interpose tracker is usable. Unlike
     * {@link isSupported} (which gates the syscall-level Linux paths),
     * interpose only covers *directly-exec'd* commands — the caller
     * must additionally check {@link parseDirectExec} and fall back to
     * the preload path for shell-syntax commands.
     */
    // eslint-disable-next-line class-methods-use-this
    public isInterposeSupported(): boolean {
        return isInterposeAvailable();
    }

    /**
     * Tracks a directly-exec'd `argv` via the macOS interpose dylib.
     * `argv` MUST come from {@link parseDirectExec} (a single binary,
     * no shell syntax) — it is exec'd directly, never through a shell,
     * so `DYLD_INSERT_LIBRARIES` survives SIP. Degrades to the
     * no-tracking path if the addon/dylib went missing since the
     * availability check.
     */
    public async trackInterpose(
        argv: string[],
        options: {
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        } = {},
    ): Promise<TrackingResult> {
        return this.#runWithInterpose(argv, options);
    }

    /**
     * True when the Windows IAT-hook tracker is usable. Like
     * {@link isInterposeSupported}, only covers *directly-exec'd*
     * commands (the DLL is injected into the spawned binary, with no
     * child-process propagation) — the caller must gate on
     * {@link parseDirectExec} and fall back to the preload path for
     * shell-syntax commands.
     */
    // eslint-disable-next-line class-methods-use-this
    public isIatHookSupported(): boolean {
        return isIatHookAvailable();
    }

    /**
     * Tracks a directly-exec'd `argv` via the Windows `fspy_windows`
     * DLL (IAT hooks). `argv` MUST come from {@link parseDirectExec}.
     * Degrades to the no-tracking path if the addon/DLL went missing
     * since the availability check.
     */
    public async trackIatHook(
        argv: string[],
        options: {
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        } = {},
    ): Promise<TrackingResult> {
        return this.#runWithIatHook(argv, options);
    }

    /**
     * Runs a command and tracks all file system accesses.
     *
     * Dispatch order (highest fidelity first):
     * 1. **seccomp_unotify** — kernel-level interception via the
     *    bundled helper binary. Catches static binaries and musl
     *    children that the strace + preload paths miss. Linux only.
     * 2. **strace** — userspace fallback when seccomp isn't
     *    available (no native addon, no helper bin, kernel < 5.0).
     * 3. **no-op** — on every other platform, run the command and
     *    return zero accesses so the orchestrator's empty-fingerprint
     *    diagnostic fires.
     */
    public async track(
        command: string,
        options: {
            /** When fired, SIGTERMs the active spawn for this call. */
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        } = {},
    ): Promise<TrackingResult> {
        if (platform() !== "linux") {
            return this.#runWithoutTracking(command, options);
        }

        if (isSeccompAvailable()) {
            return this.#runWithSeccomp(command, options);
        }

        if (isStraceAvailable()) {
            return this.#runWithStrace(command, options);
        }

        return this.#runWithoutTracking(command, options);
    }

    /**
     * Runs a command under seccomp_unotify tracking via the helper
     * binary. The native addon's `trackWithSeccomp` returns raw
     * accesses; we filter to the workspace + exclusion patterns
     * here (same predicate as the strace branch) so the result
     * shape is identical to the orchestrator.
     *
     * Cancellation surface: the native addon fires an `onStarted`
     * callback with the helper PID. We register a `Killable` stub
     * in `#activeProcesses` so `killAll()` reaches it, and also
     * SIGTERM on per-call `abortSignal` aborts.
     */
    async #runWithSeccomp(
        command: string,
        options: {
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        },
    ): Promise<TrackingResult> {
        const native = loadNativeBindings();
        const helperPath = resolveSeccompHelperPath();

        if (!native?.trackWithSeccomp || !helperPath) {
            // Both pre-checks passed in isSupported, but defensive
            // fall-through in case the cache is stale (e.g. someone
            // deleted the helper between calls).
            return this.#runWithoutTracking(command, options);
        }

        // Same `sh -c` wrapping as the strace path so shell-syntax
        // commands (pipelines, redirects) work. cwd + env are
        // propagated through the native binding's spawn-options to
        // Command::current_dir / Command::env on the helper.
        const cwd = options.cwd ?? this.#workspaceRoot;
        const env = withEnhancedPath({ ...process.env, ...options.env }, cwd);
        const envFiltered: Record<string, string> = {};

        for (const [k, v] of Object.entries(env)) {
            if (typeof v === "string") {
                envFiltered[k] = v;
            }
        }

        const argv = ["sh", "-c", command];

        // Cancellation plumbing — both `killAll()` and per-call
        // `abortSignal` route through the same registered stub. The
        // PID lands once via the native's `onStarted` callback;
        // we resolve a deferred so the abort listener doesn't race
        // against the PID arrival.
        let killable: Killable | undefined;
        let resolveKillable: ((k: Killable) => void) | undefined;
        const killableReady = new Promise<Killable>((r) => {
            resolveKillable = r;
        });

        const onStarted = (pid: number): void => {
            killable = {
                kill: (signal): boolean => {
                    try {
                        return process.kill(pid, signal ?? "SIGTERM");
                    } catch {
                        // Already exited — same semantics as ChildProcess.kill.
                        return false;
                    }
                },
            };
            this.#activeProcesses.add(killable);
            resolveKillable?.(killable);
        };

        const abortHandler = (): void => {
            // Don't race the PID arrival: wait for `onStarted` then
            // kill. If the helper crashed before connecting, the
            // accept watchdog (5s) will return an error instead.
            killableReady
                .then((k) => {
                    k.kill("SIGTERM");

                    return undefined;
                })
                .catch(() => {
                    // Promise never rejects (we only ever resolve)
                    // but appease the floating-promise rule.
                });
        };

        if (options.abortSignal?.aborted) {
            // Already aborted before we started — short-circuit.
            return { accesses: [], code: -1, output: "" };
        }

        options.abortSignal?.addEventListener("abort", abortHandler, { once: true });

        try {
            const result = await native.trackWithSeccomp(argv, helperPath, { cwd, env: envFiltered }, onStarted);

            const accesses: FileAccess[] = [];

            for (const a of result.accesses) {
                const absolute = a.path.startsWith("/") ? a.path : resolve(cwd, a.path);

                if (this.#shouldExclude(absolute) || !absolute.startsWith(this.#workspaceRoot)) {
                    continue;
                }

                accesses.push({ path: absolute, type: a.kind });
            }

            // Concatenate stdout + stderr to mirror the strace path's
            // single `output` field. The orchestrator presents the
            // two streams together; finer-grained separation can be
            // added by widening TrackingResult later.
            const output = `${result.stdout.toString("utf8")}${result.stderr.toString("utf8")}`;

            return { accesses, code: result.exitCode, output };
        } catch {
            // Helper failure shouldn't fail the task — degrade to
            // the no-tracking path so the orchestrator marks the
            // result as `emptyFingerprint: true` and skips caching.
            return this.#runWithoutTracking(command, options);
        } finally {
            if (killable) {
                this.#activeProcesses.delete(killable);
            }

            options.abortSignal?.removeEventListener("abort", abortHandler);
        }
    }

    /**
     * macOS interpose path. Spawns the directly-exec'd `argv` (no
     * shell — SIP would strip `DYLD_INSERT_LIBRARIES` from `/bin/sh`)
     * with the `fspy_macos` dylib injected and collects the reported
     * accesses. Cancellation + access filtering mirror
     * {@link #runWithSeccomp}.
     */
    async #runWithInterpose(
        argv: string[],
        options: {
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        },
    ): Promise<TrackingResult> {
        const native = loadNativeBindings();
        const dylibPath = resolveInterposeDylibPath();

        if (!native?.trackWithInterpose || !dylibPath || argv.length === 0) {
            return this.#runWithoutTracking(argv.join(" "), options);
        }

        const cwd = options.cwd ?? this.#workspaceRoot;
        const env = withEnhancedPath({ ...process.env, ...options.env }, cwd);
        const envFiltered: Record<string, string> = {};

        for (const [k, v] of Object.entries(env)) {
            if (typeof v === "string") {
                envFiltered[k] = v;
            }
        }

        let killable: Killable | undefined;
        let resolveKillable: ((k: Killable) => void) | undefined;
        const killableReady = new Promise<Killable>((r) => {
            resolveKillable = r;
        });

        // Intentionally mirrors the seccomp path's PID-kill plumbing; kept
        // inline rather than shared so the proven seccomp method is untouched.
        // eslint-disable-next-line sonarjs/no-identical-functions
        const onStarted = (pid: number): void => {
            killable = {
                kill: (signal): boolean => {
                    try {
                        return process.kill(pid, signal ?? "SIGTERM");
                    } catch {
                        return false;
                    }
                },
            };
            this.#activeProcesses.add(killable);
            resolveKillable?.(killable);
        };

        // eslint-disable-next-line sonarjs/no-identical-functions
        const abortHandler = (): void => {
            killableReady
                .then((k) => {
                    k.kill("SIGTERM");

                    return undefined;
                })
                .catch(() => {});
        };

        if (options.abortSignal?.aborted) {
            return { accesses: [], code: -1, output: "" };
        }

        options.abortSignal?.addEventListener("abort", abortHandler, { once: true });

        try {
            const result = await native.trackWithInterpose(argv, dylibPath, { cwd, env: envFiltered }, onStarted);

            const accesses: FileAccess[] = [];

            for (const a of result.accesses) {
                const absolute = a.path.startsWith("/") ? a.path : resolve(cwd, a.path);

                if (this.#shouldExclude(absolute) || !absolute.startsWith(this.#workspaceRoot)) {
                    continue;
                }

                accesses.push({ path: absolute, type: a.kind });
            }

            const output = `${result.stdout.toString("utf8")}${result.stderr.toString("utf8")}`;

            return { accesses, code: result.exitCode, output };
        } catch {
            return this.#runWithoutTracking(argv.join(" "), options);
        } finally {
            if (killable) {
                this.#activeProcesses.delete(killable);
            }

            options.abortSignal?.removeEventListener("abort", abortHandler);
        }
    }

    /**
     * Windows IAT-hook path. Spawns `argv` suspended, injects the
     * `fspy_windows` DLL, and collects accesses off the named pipe.
     * Cancellation mirrors {@link #runWithSeccomp}. The DLL emits
     * forward-slash, drive-qualified paths; Windows is case-insensitive,
     * so the workspace filter compares lower-cased.
     */
    async #runWithIatHook(
        argv: string[],
        options: {
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        },
    ): Promise<TrackingResult> {
        const native = loadNativeBindings();
        const dllPath = resolveWindowsDllPath();

        if (!native?.trackWithIatHook || !dllPath || argv.length === 0) {
            return this.#runWithoutTracking(argv.join(" "), options);
        }

        const cwd = options.cwd ?? this.#workspaceRoot;
        const env = withEnhancedPath({ ...process.env, ...options.env }, cwd);
        const envFiltered: Record<string, string> = {};

        for (const [k, v] of Object.entries(env)) {
            if (typeof v === "string") {
                envFiltered[k] = v;
            }
        }

        let killable: Killable | undefined;
        let resolveKillable: ((k: Killable) => void) | undefined;
        const killableReady = new Promise<Killable>((r) => {
            resolveKillable = r;
        });

        // eslint-disable-next-line sonarjs/no-identical-functions
        const onStarted = (pid: number): void => {
            killable = {
                kill: (signal): boolean => {
                    try {
                        return process.kill(pid, signal ?? "SIGTERM");
                    } catch {
                        return false;
                    }
                },
            };
            this.#activeProcesses.add(killable);
            resolveKillable?.(killable);
        };

        // eslint-disable-next-line sonarjs/no-identical-functions
        const abortHandler = (): void => {
            killableReady
                .then((k) => {
                    k.kill("SIGTERM");

                    return undefined;
                })
                .catch(() => {});
        };

        if (options.abortSignal?.aborted) {
            return { accesses: [], code: -1, output: "" };
        }

        options.abortSignal?.addEventListener("abort", abortHandler, { once: true });

        const workspaceLower = this.#workspaceRoot.toLowerCase();

        try {
            const result = await native.trackWithIatHook(argv, dllPath, { cwd, env: envFiltered }, onStarted);

            const accesses: FileAccess[] = [];

            for (const a of result.accesses) {
                // The DLL already normalizes to forward-slash; treat a
                // drive-qualified or rooted path as absolute, else resolve.
                const absolute = /^(?:[a-z]:)?[/\\]/iu.test(a.path) ? a.path : resolve(cwd, a.path);

                if (this.#shouldExclude(absolute) || !absolute.toLowerCase().startsWith(workspaceLower)) {
                    continue;
                }

                accesses.push({ path: absolute, type: a.kind });
            }

            const output = `${result.stdout.toString("utf8")}${result.stderr.toString("utf8")}`;

            return { accesses, code: result.exitCode, output };
        } catch {
            return this.#runWithoutTracking(argv.join(" "), options);
        } finally {
            if (killable) {
                this.#activeProcesses.delete(killable);
            }

            options.abortSignal?.removeEventListener("abort", abortHandler);
        }
    }

    /**
     * Runs a command wrapped with strace to capture file accesses.
     */
    async #runWithStrace(
        command: string,
        options: {
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        },
    ): Promise<TrackingResult> {
        const traceDirectory = join(this.#workspaceRoot, "node_modules", ".cache", "task-runner");

        await mkdir(traceDirectory, { recursive: true });
        const traceFile = join(traceDirectory, `strace-${uniqueId()}.log`);

        // strace flags:
        // -f: follow forks
        // -e trace=open,openat,stat,lstat,newfstatat,access,getdents,getdents64: track file operations
        // -o: output to file
        // -qq: suppress non-essential messages
        //
        // Spawn argv-style rather than going through /bin/sh. The
        // workspace path (and thus `traceFile`) can contain spaces on
        // perfectly normal contributor machines (macOS Library paths,
        // mounted shares, CI workers); string interpolation through a
        // shell would break the `-o` flag and silently produce no
        // trace, which the catch below mistakes for "strace not
        // available" and the orchestrator caches the task as if it
        // had no inputs.
        const straceArgs = [
            "-f",
            "-qq",
            "-e",
            "trace=open,openat,creat,stat,lstat,newfstatat,access,getdents,getdents64,unlink,unlinkat,rename,renameat,renameat2",
            "-o",
            traceFile,
            "--",
            "sh",
            "-c",
            command,
        ];

        return new Promise((_resolve) => {
            const child = execFile(
                "strace",
                straceArgs,
                {
                    cwd: options.cwd ?? this.#workspaceRoot,
                    env: withEnhancedPath({ ...process.env, ...options.env }, options.cwd ?? this.#workspaceRoot),
                    maxBuffer: 50 * 1024 * 1024, // 50MB
                },
                async (_error, stdout, stderr) => {
                    this.#activeProcesses.delete(child);
                    detachAbort();

                    let accesses: FileAccess[] = [];

                    try {
                        const traceContent = await readFile(traceFile, "utf8");

                        accesses = this.#parseStraceOutput(traceContent, options.cwd ?? this.#workspaceRoot);
                    } catch {
                        // Trace file might not exist if strace isn't available
                    }

                    // Clean up trace file
                    await rm(traceFile, { force: true }).catch(() => {});

                    _resolve({
                        accesses,
                        code: child.exitCode ?? 1,
                        output: stdout + stderr,
                    });
                },
            );

            this.#activeProcesses.add(child);
            const detachAbort = wireAbort(options.abortSignal, child);
        });
    }

    /**
     * Parses strace output to extract file accesses.
     *
     * A single path may appear with both `read` and `write` types when a
     * task reads a file and later rewrites it — self-modifying detection
     * relies on seeing both, so we dedupe per `(path, type)` rather than
     * by path alone.
     */
    #parseStraceOutput(traceContent: string, cwd: string): FileAccess[] {
        const accesses: FileAccess[] = [];
        const seen = new Set<string>();

        for (const line of traceContent.split("\n")) {
            const parsed = this.#parseStraceLine(line, cwd);

            if (!parsed) {
                continue;
            }

            const key = `${parsed.type}:${parsed.path}`;

            if (!seen.has(key)) {
                seen.add(key);
                accesses.push(parsed);
            }
        }

        return accesses;
    }

    /**
     * Parses a single strace output line.
     * Each entry maps a regex to the file access kind; the actual type
     * (read vs write) depends on flag inspection for `open`/`openat`.
     */
    #parseStraceLine(line: string, cwd: string): FileAccess | undefined {
        const isMissing = line.includes("ENOENT");

        for (const { kind, pattern } of STRACE_PATTERNS) {
            const match = pattern.exec(line);

            if (!match) {
                continue;
            }

            if (kind === "getdents") {
                // getdents operates on an fd, not a path — skip until we
                // later introduce fd→path tracking.
                return undefined;
            }

            const capturedPath = match[1];

            if (!capturedPath) {
                continue;
            }

            let path = capturedPath;

            if (!path.startsWith("/")) {
                path = resolve(cwd, path);
            }

            if (this.#shouldExclude(path) || !path.startsWith(this.#workspaceRoot)) {
                return undefined;
            }

            if (isMissing) {
                return { path, type: "missing" };
            }

            const type: FileAccess["type"] = kind === "open" ? parseOpenAccessType(line) : kind === "creat" ? "write" : "stat";

            return { path, type };
        }

        // unlink/rename take a path but don't match the capturing patterns
        // above. Handle them here so the touched path is flagged as a write.
        const destructive = /(?:^|\s)(?:unlink|unlinkat|rename|renameat|renameat2)\((?:AT_FDCWD,\s*)?"([^"]+)"/.exec(line);

        if (destructive?.[1]) {
            let path = destructive[1];

            if (!path.startsWith("/")) {
                path = resolve(cwd, path);
            }

            if (this.#shouldExclude(path) || !path.startsWith(this.#workspaceRoot)) {
                return undefined;
            }

            return { path, type: "write" };
        }

        return undefined;
    }

    /**
     * Checks if a path should be excluded from tracking.
     */
    #shouldExclude(filePath: string): boolean {
        return this.#excludePatterns.some((pattern) => pattern.test(filePath));
    }

    /**
     * Kills all active child processes. Called on abort/signal to
     * prevent orphans. Works for both `ChildProcess` (strace path)
     * and the seccomp helper PID stub via the shared `Killable`
     * shape.
     */
    public killAll(): void {
        for (const target of this.#activeProcesses) {
            try {
                target.kill("SIGTERM");
            } catch {
                // Process may have already exited.
            }
        }

        this.#activeProcesses.clear();
    }

    /**
     * Runs a command without file access tracking.
     */
    async #runWithoutTracking(
        command: string,
        options: {
            abortSignal?: AbortSignal;
            cwd?: string;
            env?: Record<string, string | undefined>;
        },
    ): Promise<TrackingResult> {
        return new Promise((_resolve) => {
            // Argv-style spawn through `sh -c`: keeps the user task's
            // shell expansion semantics intact while avoiding string
            // interpolation of the workspace path. A workspaceRoot
            // containing spaces used to break the previous string-form
            // invocation when the command referenced derived paths.
            // `sh` is the canonical shell on every dispatch path (strace
            // + seccomp wrap with it too); on Windows it resolves to the
            // runner's Git Bash, so task commands use POSIX semantics
            // consistently rather than cmd.exe.
            const child = execFile(
                "sh",
                ["-c", command],
                {
                    cwd: options.cwd ?? this.#workspaceRoot,
                    env: withEnhancedPath({ ...process.env, ...options.env }, options.cwd ?? this.#workspaceRoot),
                    maxBuffer: 50 * 1024 * 1024,
                },
                (_error, stdout, stderr) => {
                    this.#activeProcesses.delete(child);
                    detachAbort();

                    _resolve({
                        accesses: [],
                        code: child.exitCode ?? 1,
                        output: stdout + stderr,
                    });
                },
            );

            this.#activeProcesses.add(child);
            const detachAbort = wireAbort(options.abortSignal, child);
        });
    }
}

/**
 * Generates a preload script that can be used with NODE_OPTIONS to
 * track file accesses in Node.js child processes.
 *
 * This is an alternative to strace that works cross-platform for Node.js processes.
 */
export const generatePreloadScript = (outputPath: string): string => String.raw`
import { createWriteStream } from "node:fs";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const logStream = createWriteStream(${JSON.stringify(outputPath)}, { flags: "a" });
const log = (type, path) => { logStream.write(JSON.stringify({ type, path }) + "\n"); };

// Patch each fs method: save original, replace with logged wrapper
const patch = (obj, method, type) => {
    const orig = obj[method];
    obj[method] = function(...args) {
        log(type, args[0]?.toString());
        return orig.apply(this, args);
    };
};

// Reads / stats / directory listing
patch(fs, "readFileSync", "read");
patch(fs, "statSync", "stat");
patch(fs, "readdirSync", "readdir");
patch(fs, "readFile", "read");
patch(fs, "stat", "stat");
patch(fs, "readdir", "readdir");
patch(fsp, "readFile", "read");
patch(fsp, "stat", "stat");
patch(fsp, "readdir", "readdir");

// Writes and path-mutating ops — needed for self-modifying task detection
patch(fs, "writeFileSync", "write");
patch(fs, "appendFileSync", "write");
patch(fs, "unlinkSync", "write");
patch(fs, "renameSync", "write");
patch(fs, "writeFile", "write");
patch(fs, "appendFile", "write");
patch(fs, "unlink", "write");
patch(fs, "rename", "write");
patch(fsp, "writeFile", "write");
patch(fsp, "appendFile", "write");
patch(fsp, "unlink", "write");
patch(fsp, "rename", "write");

process.on("beforeExit", () => { logStream.end(); });
`;
