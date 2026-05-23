import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";

import { REGISTRY_FILE_MODE } from "./registry";

const isWindows = process.platform === "win32";

export interface SpawnDetachedInput {
    /** Shell command to run. Resolved via `/bin/sh -c` (POSIX) or `cmd /d /s /c` (Windows). */
    command: string;
    cwd: string;
    env: Record<string, string>;
    /** Absolute path the child's stdout/stderr is written to. Created/truncated. */
    logFile: string;
}

export interface SpawnDetachedResult {
    pid: number;
}

/**
 * Spawn a child process that survives after this Node process exits.
 *
 * On POSIX, `detached: true` makes the child its own process-group
 * leader (`setsid`). When this Node process exits, the child reparents
 * to PID 1 and keeps running. We `unref()` so the parent's event loop
 * doesn't wait for it.
 *
 * On Windows, `detached: true` opens the child in a new console; there
 * is no `setsid` equivalent, but the child outlives the parent.
 *
 * Throws synchronously when the child fails to spawn (`ENOENT`, etc).
 * Resolves once the OS has assigned a PID.
 */
export const spawnDetached = async (input: SpawnDetachedInput): Promise<SpawnDetachedResult> => {
    const { command, cwd, env, logFile } = input;

    // Open log file with append + create — `vis service start` may be
    // called after a crashed run that left a stale log. Append keeps
    // forensic trail; truncating would lose the crash output. Mode
    // 0o600 keeps the captured stdout (which often contains DB URLs,
    // tokens, OAuth secrets) private to the owning user on shared hosts.
    //
    // The fd is handed straight to `stdio[1]/[2]` so the child inherits
    // it as its stdout/stderr. We previously used the shell's own `>>`
    // redirect, but `detached + stdio: "ignore"` on Windows starves
    // cmd.exe of the parent handles it needs to set up the redirect,
    // and the log silently stays empty. Passing an explicit fd skips
    // cmd's redirect machinery entirely.
    const logFd = openSync(logFile, "a", REGISTRY_FILE_MODE);

    let child: ChildProcess;

    const shell = isWindows ? "cmd" : "/bin/sh";
    const args = isWindows ? ["/d", "/s", "/c", command] : ["-c", command];

    try {
        child = spawn(shell, args, {
            cwd,
            detached: true,
            env: { ...process.env, ...env },
            stdio: ["ignore", logFd, logFd],
            // Windows: spawn in a new console so the child isn't tied
            // to this terminal's lifetime.
            windowsHide: true,
        });
    } finally {
        // The child has its own duplicated handle by the time spawn
        // returns; closing here releases the parent's reference so
        // GC / file locks don't linger past this function.
        closeSync(logFd);
    }

    if (child.pid === undefined) {
        // `spawn` only resolves PID after the OS confirms the fork. If
        // the binary doesn't exist, we get an `error` event instead.
        await new Promise<void>((resolve, reject) => {
            child.once("spawn", () => {
                resolve();
            });
            child.once("error", (error) => {
                reject(error);
            });
        });
    }

    if (child.pid === undefined) {
        throw new Error(`Failed to spawn detached process for command: ${command}`);
    }

    child.unref();

    return { pid: child.pid };
};
