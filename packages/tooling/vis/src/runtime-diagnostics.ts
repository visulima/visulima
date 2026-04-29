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
    const stdinIsTty = process.stdin.isTTY === true;
    const stdoutIsTty = process.stdout.isTTY === true;

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
            id: "orphans",
            message: "Could not enumerate processes (ps/tasklist failed).",
            status: "warn",
        };
    }

    if (pids.length === 0) {
        return {
            id: "orphans",
            message: "No orphaned vis/task-runner processes detected.",
            status: "ok",
        };
    }

    if (pids.length <= 2) {
        return {
            detail: { count: pids.length, pids: pids.join(",") },
            id: "orphans",
            message: `${String(pids.length)} possibly orphaned process(es) detected (PIDs: ${pids.join(", ")}). Likely benign.`,
            status: "skip",
        };
    }

    const killSnippet = process.platform === "win32"
        ? pids.map((p) => `taskkill /F /PID ${String(p)}`).join(" & ")
        : `kill ${pids.join(" ")}`;

    return {
        detail: { count: pids.length, pids: pids.join(",") },
        id: "orphans",
        message: `${String(pids.length)} possibly orphaned vis/task-runner processes — kill them with: ${killSnippet}`,
        status: "warn",
    };
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

        if (command.includes("vis-native") || /\bvis run\b/.test(command) || command.includes("task-runner")) {
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
        const cells = line.split(/","/).map((cell) => cell.replace(/^"|"$/g, ""));
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
export const runRuntimeDiagnostics = (): RuntimeDiagnostic[] => [
    checkInotifyCapacity(),
    checkTtyAvailability(),
    checkOrphanedRunners(),
];
