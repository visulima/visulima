import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { open } from "node:fs/promises";

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
    const logHandle = await open(logFile, "a", REGISTRY_FILE_MODE);

    await logHandle.close().catch(() => {});

    let child: ChildProcess;

    // Inheriting a Node-opened fd into a Windows detached child is
    // unreliable — the duplicated handle is occasionally lost between
    // the parent close and the child write, dropping the captured
    // output. Use the shell's own append-redirection so the child opens
    // its log file directly (POSIX honors the same syntax).
    const redirectedCommand = isWindows
        ? `${command} >> "${logFile}" 2>&1`
        : `${command} >> ${JSON.stringify(logFile)} 2>&1`;
    const shell = isWindows ? "cmd" : "/bin/sh";
    const args = isWindows ? ["/d", "/s", "/c", redirectedCommand] : ["-c", redirectedCommand];

    child = spawn(shell, args, {
        cwd,
        detached: true,
        env: { ...process.env, ...env },
        stdio: "ignore",
        // Windows: spawn in a new console so the child isn't tied
        // to this terminal's lifetime.
        windowsHide: true,
    });

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
