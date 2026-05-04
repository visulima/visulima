import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Diagnostics for the watch / signal subsystem surfaced by `vis doctor`.
 *
 * Each check is platform-aware and reports `status: "skip"` when it
 * doesn't apply to the current host (e.g. inotify on Windows). All
 * checks are intentionally cheap — they read /proc, query the TTY,
 * or shell out to `ps` / `tasklist` once. Nothing here spawns a long
 * probe or talks to the network, so the doctor stays fast.
 */

export type DiagnosticStatus = "ok" | "skip" | "warn";

/**
 * Stable id for the orphan-runners diagnostic. Exported so callers
 * (notably the doctor handler's `--fix` gating) can match by constant
 * instead of a magic string — keeps a future rename grep-safe.
 */
export const ORPHANS_DIAGNOSTIC_ID = "orphans";

export interface RuntimeDiagnostic {
    /** Optional supporting numbers — rendered alongside the message. */
    detail?: Record<string, number | string>;
    /** Short identifier for JSON consumers (`inotify`, `tty`, `orphans`). */
    id: string;
    /** Human-readable line shown by the table renderer. */
    message: string;
    status: DiagnosticStatus;
}

/**
 * Linux-only inotify watcher capacity check. `fs.watch({ recursive })`
 * silently caps at `fs.inotify.max_user_watches`; once the limit is
 * exhausted, watch mode reports no events and the user has no idea
 * why nothing reruns.
 *
 * Returns `skip` on non-Linux platforms.
 */
export const checkInotifyCapacity = (): RuntimeDiagnostic => {
    if (process.platform !== "linux") {
        return {
            id: "inotify",
            message: "inotify capacity check skipped (not Linux).",
            status: "skip",
        };
    }

    let maxWatches: number | undefined;

    try {
        const raw = readFileSync("/proc/sys/fs/inotify/max_user_watches", "utf8").trim();
        const parsed = Number.parseInt(raw, 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            maxWatches = parsed;
        }
    } catch {
        return {
            id: "inotify",
            message: "Could not read /proc/sys/fs/inotify/max_user_watches.",
            status: "warn",
        };
    }

    if (maxWatches === undefined) {
        return {
            id: "inotify",
            message: "inotify max_user_watches reported a non-numeric value.",
            status: "warn",
        };
    }

    // 8192 is the default on many distros and runs out fast on
    // monorepos with thousands of files. 524288 is the value most
    // editor docs (VS Code, IntelliJ) recommend for large repos.
    if (maxWatches < 65_536) {
        return {
            detail: { maxWatches },
            id: "inotify",
            message: `inotify watcher limit is ${String(maxWatches)} — large monorepos can exhaust this. Bump now with \`sudo sysctl fs.inotify.max_user_watches=524288\` and persist via \`/etc/sysctl.d/99-vis.conf\` so it survives reboot.`,
            status: "warn",
        };
    }

    return {
        detail: { maxWatches },
        id: "inotify",
        message: `inotify capacity OK (${String(maxWatches)} watches).`,
        status: "ok",
    };
};

/**
 * Watch-mode keybinds (`r`/`a`/`p`/`q`/`h`) require an interactive TTY
 * on stdin. CI runs and piped invocations correctly fall back to
 * file-change-only reruns; this diagnostic surfaces the state so a
 * confused user knows why their keypresses do nothing.
 */
export const checkTtyAvailability = (): RuntimeDiagnostic => {
    const stdinIsTty = Boolean(process.stdin.isTTY);
    const stdoutIsTty = Boolean(process.stdout.isTTY);

    if (stdinIsTty && stdoutIsTty) {
        return {
            id: "tty",
            message: "Interactive TTY available — watch keybinds enabled.",
            status: "ok",
        };
    }

    if (!stdinIsTty && !stdoutIsTty) {
        return {
            id: "tty",
            message: "No TTY on stdin/stdout — running in CI / piped mode (keybinds disabled).",
            status: "skip",
        };
    }

    return {
        detail: { stdin: String(stdinIsTty), stdout: String(stdoutIsTty) },
        id: "tty",
        message: stdinIsTty
            ? "stdin is a TTY but stdout is not — output is being captured; keybinds still work."
            : "stdout is a TTY but stdin is not — keybinds disabled (input is piped).",
        status: "skip",
    };
};

/**
 * Enumerate orphan vis/task-runner PIDs without classifying or
 * formatting them. Shares the same underlying enumerator helpers
 * (`listOrphansWindows` / `listOrphansUnix`) as
 * {@link checkOrphanedRunners}, so the matcher cannot drift between
 * "what doctor reports" and "what --fix kills".
 *
 * Note: the *error semantics* differ from {@link checkOrphanedRunners}.
 * This function swallows enumeration failures and returns `[]` so
 * callers can iterate without branching; the diagnostic surfaces the
 * same failure as a `warn` so the user sees it.
 *
 * Excludes the current PID.
 */
export const listOrphanPids = (): number[] => {
    const selfPid = process.pid;

    try {
        return process.platform === "win32" ? listOrphansWindows(selfPid) : listOrphansUnix(selfPid);
    } catch {
        return [];
    }
};

/**
 * Looks for `vis run` / task-runner processes left over from prior
 * crashes. On Unix we shell out to `ps`; on Windows we use
 * `tasklist`. A handful of orphans is harmless, but a steadily
 * growing number leaks file watchers and PTY sessions.
 *
 * The current PID is excluded so the running `vis doctor` invocation
 * doesn't report itself.
 */
export const checkOrphanedRunners = (): RuntimeDiagnostic => {
    const selfPid = process.pid;
    let pids: number[];

    try {
        pids = process.platform === "win32" ? listOrphansWindows(selfPid) : listOrphansUnix(selfPid);
    } catch {
        return {
            id: ORPHANS_DIAGNOSTIC_ID,
            message: "Could not enumerate processes (ps/tasklist failed).",
            status: "warn",
        };
    }

    if (pids.length === 0) {
        return {
            id: ORPHANS_DIAGNOSTIC_ID,
            message: "No orphaned vis/task-runner processes detected.",
            status: "ok",
        };
    }

    if (pids.length <= 2) {
        return {
            detail: { count: pids.length, pids: pids.join(",") },
            id: ORPHANS_DIAGNOSTIC_ID,
            message: `${String(pids.length)} possibly orphaned process(es) detected (PIDs: ${pids.join(", ")}). Likely benign.`,
            status: "skip",
        };
    }

    const killSnippet = process.platform === "win32" ? pids.map((p) => `taskkill /F /PID ${String(p)}`).join(" & ") : `kill ${pids.join(" ")}`;

    return {
        detail: { count: pids.length, pids: pids.join(",") },
        id: "orphans",
        message: `${String(pids.length)} possibly orphaned vis/task-runner processes — run \`vis doctor --fix\` to clean them up, or kill them manually: ${killSnippet}`,
        status: "warn",
    };
};

export interface KillOrphansOptions {
    /**
     * Override the orphan enumerator. Defaults to {@link listOrphanPids}
     * — exposed for tests so a fixture can inject a deterministic PID
     * set without spawning real processes.
     */
    enumerate?: () => number[];

    /**
     * Skip the SIGTERM step and go straight to SIGKILL (Unix) or
     * `taskkill /F` (Windows). Default `false` lets children flush
     * buffered output and tear down child trees gracefully.
     */
    force?: boolean;

    /**
     * Override the kill primitive. Defaults to `process.kill` on Unix
     * and `taskkill` (via `spawnSync`) on Windows. Tests inject a fake
     * to assert which signal each PID received without touching the
     * host's process table.
     */
    kill?: (pid: number, signal: "SIGKILL" | "SIGTERM") => void;
}

export interface KillOrphansResult {
    /**
     * PIDs the kill primitive could not deliver to. `reason` is the
     * underlying error string — typically `ESRCH` (already gone) or
     * `EPERM` (no permission). `ESRCH` is *not* reported as a failure
     * because the goal — process gone — was already met before we
     * tried.
     */
    failed: { pid: number; reason: string }[];
    /** PIDs that received the signal without an error. */
    killed: number[];
}

/**
 * Auto-recover step for the `orphans` diagnostic. Sends SIGTERM (or
 * SIGKILL with `force`) to every PID {@link listOrphanPids} returns,
 * collecting per-PID success / failure so the caller can render a
 * summary without re-enumerating.
 *
 * Two safety properties matter:
 *
 * 1. The matcher is shared with the diagnostic — what the doctor warns
 *    about is exactly what `--fix` kills. Drift here would let a
 *    benign-looking warning escalate into a kill of an unrelated PID.
 * 2. `ESRCH` is treated as success. Orphans can exit between the
 *    enumeration and the signal, and reporting that as a failure would
 *    be confusing noise — the user wanted them gone, they're gone.
 */
export const killOrphanedRunners = (options: KillOrphansOptions = {}): KillOrphansResult => {
    const enumerate = options.enumerate ?? listOrphanPids;
    const force = options.force === true;
    const signal: "SIGKILL" | "SIGTERM" = force ? "SIGKILL" : "SIGTERM";
    const killFn = options.kill ?? defaultKill;

    const pids = enumerate();
    const killed: number[] = [];
    const failed: { pid: number; reason: string }[] = [];

    for (const pid of pids) {
        try {
            killFn(pid, signal);
            killed.push(pid);
        } catch (error) {
            const reason = (error as NodeJS.ErrnoException).code ?? (error as Error).message;

            // ESRCH = process already exited between enumeration and the
            // signal. Treat as success — the orphan is gone, which is the
            // outcome the user asked for.
            if (reason === "ESRCH") {
                killed.push(pid);
                continue;
            }

            failed.push({ pid, reason });
        }
    }

    return { failed, killed };
};

/**
 * Subset of `spawnSync`'s return value that {@link killViaTaskkill}
 * actually consumes. Lets tests inject a fake without pulling in the
 * full `child_process` typing.
 */
export interface TaskkillRunResult {
    error?: Error;
    status?: null | number;
}

export type TaskkillRunner = (args: string[]) => TaskkillRunResult;

const defaultTaskkillRunner: TaskkillRunner = (args) => spawnSync("taskkill", args, { encoding: "utf8" });
const defaultProcessKill = (pid: number, signal: "SIGKILL" | "SIGTERM"): void => {
    process.kill(pid, signal);
};

/**
 * Windows kill primitive. `taskkill` without `/F` asks the process to
 * close (closest analogue to SIGTERM); `/F` is the hard kill. Matches
 * the snippet the doctor diagnostic prints so behavior is identical
 * to a user copy-pasting it.
 *
 * Exit code 128 is community-attested as "process not found" — neither
 * Microsoft's docs nor the help text enumerate `taskkill`'s exit codes,
 * but every Windows build observed so far returns 128 when the PID is
 * gone. Mapping it to `ESRCH` lets {@link killOrphanedRunners} treat
 * the race window as success.
 */
export const killViaTaskkill = (pid: number, signal: "SIGKILL" | "SIGTERM", runner: TaskkillRunner = defaultTaskkillRunner): void => {
    const args = signal === "SIGKILL" ? ["/F", "/PID", String(pid)] : ["/PID", String(pid)];
    const result = runner(args);

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === "number" && result.status !== 0) {
        const code = result.status === 128 ? "ESRCH" : `taskkill exited with code ${String(result.status)}`;
        const error = new Error(code) as NodeJS.ErrnoException;

        error.code = code;

        throw error;
    }
};

/**
 * Unix kill primitive. Direct passthrough to `process.kill` —
 * exposed as its own export so tests can verify the wrapper without
 * needing to spy on the global `process` object.
 */
export const killViaSignal = (
    pid: number,
    signal: "SIGKILL" | "SIGTERM",
    kill: (pid: number, signal: "SIGKILL" | "SIGTERM") => void = defaultProcessKill,
): void => {
    kill(pid, signal);
};

const defaultKill = (pid: number, signal: "SIGKILL" | "SIGTERM"): void => {
    if (process.platform === "win32") {
        killViaTaskkill(pid, signal);

        return;
    }

    killViaSignal(pid, signal);
};

const runProcessListing = (command: string, args: string[]): string => {
    const result = spawnSync(command, args, { encoding: "utf8" });

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === "number" && result.status !== 0) {
        throw new Error(`${command} exited with code ${String(result.status)}`);
    }

    return typeof result.stdout === "string" ? result.stdout : "";
};

const listOrphansUnix = (selfPid: number): number[] => {
    // BSD-style `ps` with `-o pid=,command=` works on Linux + macOS.
    const stdout = runProcessListing("ps", ["-Ao", "pid=,command="]);
    const pids: number[] = [];

    for (const line of stdout.split("\n")) {
        if (line.length === 0) {
            continue;
        }

        const match = /^\s*(\d+)\s+(.+)$/.exec(line);

        if (!match) {
            continue;
        }

        const pid = Number.parseInt(match[1] ?? "", 10);
        const command = (match[2] ?? "").toLowerCase();

        if (!Number.isFinite(pid) || pid === selfPid) {
            continue;
        }

        // Tight matchers: substring matches like `command.includes("task-runner")`
        // would falsely flag `unrelated-task-runner-helper` and similar — and
        // a misclassification matters more under `sudo vis doctor --fix`.
        // Anchor each pattern so it only matches the binaries we actually ship.
        if (/(?:^|[ /])vis-native(?:\s|$|[-.])/.test(command) || /(?:^|[ /])vis\s+run\b/.test(command) || /(?:^|[ /])task-runner(?:\s|$|[-.])/.test(command)) {
            pids.push(pid);
        }
    }

    return pids;
};

const listOrphansWindows = (selfPid: number): number[] => {
    const stdout = runProcessListing("tasklist", ["/FO", "CSV", "/NH"]);
    const pids: number[] = [];

    for (const line of stdout.split(/\r?\n/)) {
        if (line.length === 0) {
            continue;
        }

        // CSV: "image","pid","session","sessionNum","memUsage"
        const cells = line.split(/","/).map((cell) => cell.replaceAll(/^"|"$/g, ""));
        const image = (cells[0] ?? "").toLowerCase();
        const pid = Number.parseInt(cells[1] ?? "", 10);

        if (!Number.isFinite(pid) || pid === selfPid) {
            continue;
        }

        // Tight match: the Windows binary names we ship.
        // `image.includes("vis")` would falsely flag visualstudio.exe,
        // vista.exe, aviso.exe, etc.
        if (image === "vis.exe" || image.startsWith("vis-native") || image.includes("task-runner")) {
            pids.push(pid);
        }
    }

    return pids;
};

/**
 * Runs every diagnostic and returns the results in a stable order.
 * The order matches the doctor's display order: capacity first
 * (most likely to silently break watch), then TTY (informational),
 * then orphans (cleanup).
 */
export const runRuntimeDiagnostics = (): RuntimeDiagnostic[] => [checkInotifyCapacity(), checkTtyAvailability(), checkOrphanedRunners()];
