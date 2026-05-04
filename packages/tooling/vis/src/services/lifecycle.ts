import { join } from "@visulima/path";

import { runReadiness } from "./readiness";
import { deleteEntry, getRegistryDir, isAlive, readEntry, slugify, withServiceLock, writeEntry } from "./registry";
import { spawnDetached } from "./spawn";
import type { ServiceConfig, ServiceEntry } from "./types";

const DEFAULT_KILL_GRACE_MS = 5000;

export interface StartServiceInput {
    /** Resolved shell command to spawn. */
    command: string;
    config: ServiceConfig;
    cwd: string;
    /** Env to apply to the spawned process. */
    env: Record<string, string>;
    /** Target id, e.g. `apps/api:db`. Doubles as the registry key. */
    id: string;
    /** Override readiness timeout (e.g. from `vis service start --timeout=60000`). */
    readinessTimeoutMs?: number;
    /** Skip readiness probe entirely (e.g. `--no-readiness`). */
    skipReadiness?: boolean;
    workspaceRoot: string;
}

export interface StartServiceResult {
    entry: ServiceEntry;
}

/**
 * Boot a service: spawn detached, register the entry, and (unless
 * skipped) wait for the readiness probe. On readiness failure, kill the
 * orphaned child and remove the registry entry so a retry starts clean.
 *
 * Refuses to start when an alive entry already exists for the same id.
 *
 * Wrapped in a per-id lock so two concurrent `vis service start &lt;id>`
 * invocations can't both spawn children and orphan one — without the
 * lock, the second `writeEntry` overwrites the first entry and the
 * first child becomes an unreachable port-holder.
 */
export const startService = async (input: StartServiceInput): Promise<StartServiceResult> =>
    withServiceLock(input.workspaceRoot, input.id, async () => {
        const existing = await readEntry(input.workspaceRoot, input.id);

        if (existing && isAlive(existing.pid)) {
            throw new Error(`Service ${input.id} is already running (pid ${String(existing.pid)})`);
        }

        if (existing) {
            // Stale entry from a crashed run — clear it before re-spawning.
            await deleteEntry(input.workspaceRoot, input.id, existing);
        }

        const registryDirectory = await getRegistryDir(input.workspaceRoot);
        const slug = slugify(input.id);
        const logFile = join(registryDirectory, `${slug}.log`);

        const { pid } = await spawnDetached({
            command: input.command,
            cwd: input.cwd,
            env: input.env,
            logFile,
        });

        const entry: ServiceEntry = {
            command: input.command,
            config: input.config,
            cwd: input.cwd,
            env: input.config.env ?? {},
            id: input.id,
            logFile,
            pid,
            slug,
            startedAt: new Date().toISOString(),
            visVersion: process.env["VIS_VERSION"] ?? "0.0.0",
        };

        await writeEntry(input.workspaceRoot, entry);

        if (input.skipReadiness !== true) {
            try {
                await runReadiness(input.config, { timeoutMs: input.readinessTimeoutMs });
            } catch (error) {
                // Probe failed — clean up so the next attempt isn't blocked.
                await stopServiceByPid(pid, input.config.killGracePeriodMs ?? DEFAULT_KILL_GRACE_MS).catch(() => {});
                await deleteEntry(input.workspaceRoot, input.id, entry).catch(() => {});

                throw error;
            }
        }

        return { entry };
    });

export interface StopServiceInput {
    /** Override the entry's `killGracePeriodMs`. */
    graceMs?: number;
    id: string;
    workspaceRoot: string;
}

export interface StopServiceResult {
    /** True when an alive entry was killed; false when nothing was registered. */
    stopped: boolean;
}

/**
 * Send SIGTERM to the registered service, escalate to SIGKILL after the
 * grace period, then remove the registry entry. Idempotent — calling
 * stop on an unknown id resolves to `{ stopped: false }`.
 *
 * Locked per-id so a concurrent `start` of the same id doesn't observe
 * the entry mid-cleanup.
 */
export const stopService = async (input: StopServiceInput): Promise<StopServiceResult> =>
    withServiceLock(input.workspaceRoot, input.id, async () => {
        const entry = await readEntry(input.workspaceRoot, input.id);

        if (!entry) {
            return { stopped: false };
        }

        if (!isAlive(entry.pid)) {
            await deleteEntry(input.workspaceRoot, input.id, entry);

            return { stopped: false };
        }

        const graceMs = input.graceMs ?? entry.config.killGracePeriodMs ?? DEFAULT_KILL_GRACE_MS;

        await stopServiceByPid(entry.pid, graceMs);
        await deleteEntry(input.workspaceRoot, input.id, entry);

        return { stopped: true };
    });

const stopServiceByPid = async (pid: number, graceMs: number): Promise<void> => {
    sendSignalToServiceGroup(pid, "SIGTERM");

    const start = Date.now();

    while (Date.now() - start < graceMs) {
        if (!isAlive(pid)) {
            return;
        }

        await new Promise<void>((resolve) => {
            setTimeout(resolve, 100);
        });
    }

    if (isAlive(pid)) {
        sendSignalToServiceGroup(pid, "SIGKILL");
    }
};

/**
 * Send a signal to the **service**'s process group on POSIX. Negative
 * PID targets the group, reaching detached children of shell wrappers.
 *
 * Pre-condition: `pid` is a process-group leader. This is true for
 * services because `spawnDetached` passes `detached: true` (which
 * `setsid`s the child, making it the PGID leader). Don't call this with
 * arbitrary PIDs — `kill(-pid, ...)` to a non-leader silently signals
 * whichever PGID happens to equal `pid`.
 *
 * Windows has no process groups; falls back to plain `pid`. Swallows
 * ESRCH only — other errors (e.g. EPERM, EINVAL) bubble up so they're
 * not silently lost.
 */
const sendSignalToServiceGroup = (pid: number, signal: NodeJS.Signals): void => {
    try {
        if (process.platform === "win32") {
            process.kill(pid, signal);
        } else {
            process.kill(-pid, signal);
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ESRCH") {
            return;
        }

        throw error;
    }
};
