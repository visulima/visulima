import type { ChildProcess } from "node:child_process";
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
let helperPathCache: string | null | undefined;

const resolveSeccompHelperPath = (): string | undefined => {
    if (helperPathCache !== undefined) {
        return helperPathCache ?? undefined;
    }

    if (platform() !== "linux") {
        helperPathCache = null;

        return undefined;
    }

    const candidates: string[] = [];

    // Production: the addon lives in node_modules/<binding-pkg>/
    // and ships the helper next to its .node file.
    try {
        const here = dirname(fileURLToPath(import.meta.url));
        const cjsRequire = createRequire(import.meta.url);
        const indexJsPath = cjsRequire.resolve("../index.js");
        const indexDir = dirname(indexJsPath);

        candidates.push(
            // Production: same dir as the .node addon.
            join(indexDir, "fspy-seccomp-helper"),
            // Or a `bin/` subdir if the binding package nests it.
            join(indexDir, "bin", "fspy-seccomp-helper"),
            // Source tree (`pnpm build:native:debug` output).
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
            helperPathCache = candidate;

            return candidate;
        } catch {
            // Try the next candidate.
        }
    }

    helperPathCache = null;

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
 * Tracks which files a child process accesses during execution.
 *
 * Uses `strace` on Linux to intercept syscalls (open, openat, stat, lstat, access, getdents).
 * Falls back to no tracking on unsupported platforms.
 */
export class FileAccessTracker {
    readonly #workspaceRoot: string;

    readonly #excludePatterns: RegExp[];

    /** Tracks active child processes for cleanup on abort */
    readonly #activeProcesses = new Set<ChildProcess>();

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
     */
    async #runWithSeccomp(
        command: string,
        options: {
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

        try {
            const result = await native.trackWithSeccomp(argv, helperPath, { cwd, env: envFiltered });

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
        }
    }

    /**
     * Runs a command wrapped with strace to capture file accesses.
     */
    async #runWithStrace(
        command: string,
        options: {
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
     * Kills all active child processes. Called on abort/signal to prevent orphans.
     */
    public killAll(): void {
        for (const child of this.#activeProcesses) {
            try {
                child.kill("SIGTERM");
            } catch {
                // Process may have already exited
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

                    _resolve({
                        accesses: [],
                        code: child.exitCode ?? 1,
                        output: stdout + stderr,
                    });
                },
            );

            this.#activeProcesses.add(child);
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
