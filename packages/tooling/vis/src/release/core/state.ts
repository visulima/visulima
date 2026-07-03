/**
 * State file persistence for resume-from-failure (RFC §19.1).
 *
 * `&lt;changesDir>/.state.json` holds in-progress release state across re-runs.
 * The CLI handlers read it on startup when `--resume` is set; failed runs
 * leave it in place; `git push --tags` success deletes it.
 *
 * Location: gitignored by `vis release init`. State is per-workspace, not
 * per-machine — a CI re-run from the SAME worktree can resume because the
 * file lives there.
 *
 * Git-tracked lock (`release.publish.lockInGit`): when enabled the state is
 * written to a git-TRACKED `&lt;changesDir>/publish-lock.json` instead. Committed
 * + pushed by the publish flow, it lets an *ephemeral* CI runner (a fresh
 * checkout on a different machine) resume a partially-failed publish — the
 * gitignored `.state.json` never survives a fresh clone, the tracked lock does.
 */

import { constants as fsConstants } from "node:fs";
import { mkdir, open, readFile, unlink, writeFile } from "node:fs/promises";
import { hostname, platform } from "node:os";
import { dirname, join } from "node:path";

import { VisReleaseError } from "../errors";
import type { LockInfo, PlannedRelease, StateFile } from "../types";

/** Gitignored, worktree-local state file (default). */
const LOCAL_STATE_FILENAME = ".state.json";
/** Git-tracked lock file used when `release.publish.lockInGit` is on. */
const TRACKED_LOCK_FILENAME = "publish-lock.json";

/**
 * Resolve the state/lock file path. When `lockInGit` is true the tracked
 * `publish-lock.json` is used (survives a fresh clone); otherwise the
 * gitignored `.state.json`.
 */
export const stateFilePath = (cwd: string, changesDir: string, lockInGit = false): string =>
    join(cwd, changesDir, lockInGit ? TRACKED_LOCK_FILENAME : LOCAL_STATE_FILENAME);

export const readState = async (cwd: string, changesDir: string, lockInGit = false): Promise<StateFile | undefined> => {
    try {
        const content = await readFile(stateFilePath(cwd, changesDir, lockInGit), "utf8");
        const parsed = JSON.parse(content) as StateFile;

        if (parsed.version !== 1) {
            throw new VisReleaseError({
                code: "STATE_FILE_CORRUPT",
                message: `Unknown state file version: ${parsed.version}. Delete ${stateFilePath(cwd, changesDir, lockInGit)} to start fresh.`,
            });
        }

        return parsed;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return undefined;
        }

        if (error instanceof VisReleaseError) {
            throw error;
        }

        throw new VisReleaseError({
            cause: error,
            code: "STATE_FILE_CORRUPT",
            message: `Failed to read state file: ${(error as Error).message}`,
        });
    }
};

export const writeState = async (cwd: string, changesDir: string, state: StateFile, lockInGit = false): Promise<void> => {
    const path = stateFilePath(cwd, changesDir, lockInGit);

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(state, null, 2)}\n`);
};

export const clearState = async (cwd: string, changesDir: string, lockInGit = false): Promise<void> => {
    try {
        await unlink(stateFilePath(cwd, changesDir, lockInGit));
    } catch (error) {
        // ENOENT is expected on a fresh-success path (nothing to clear).
        // Anything else — EACCES, EIO, etc. — means the NEXT run sees a
        // stale state.json and incorrectly skips already-published
        // packages via filterPlanByState. Surface so the operator
        // notices.
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw new VisReleaseError({
                cause: error,
                code: "STATE_FILE_CORRUPT",
                message: `Could not clear state file at ${stateFilePath(cwd, changesDir, lockInGit)}: ${(error as Error).message}. Remove it manually before the next run.`,
            });
        }
    }
};

export const newState = (channel: string | undefined, plan: ReadonlyArray<PlannedRelease>): StateFile => {
    return {
        applied: [],
        channel,
        notified: [],
        plan: [...plan],
        published: [],
        pushed: false,
        startedAt: new Date().toISOString(),
        tagged: [],
        version: 1,
        walked: [],
    };
};

/**
 * Filter a release plan to only packages that haven't been published yet.
 * Used by `vis release publish --resume` to skip work that was completed
 * in the previous (failed) run.
 */
export const filterPlanByState = (plan: ReadonlyArray<PlannedRelease>, state: StateFile): PlannedRelease[] => {
    const publishedKeys = new Set(state.published);

    return plan.filter((r) => !publishedKeys.has(`${r.name}@${r.newVersion}`));
};

// ── Process-level concurrency lock (RFC §19.1) ─────────────────────

const STALE_LOCK_MS = 60 * 60 * 1000; // 1 hour

export const lockFilePath = (cwd: string, changesDir: string): string => join(cwd, changesDir, ".lock");

const isPidAlive = (pid: number): boolean => {
    try {
        // Signal 0 doesn't actually send a signal — it just checks whether
        // the target PID exists and is reachable.
        process.kill(pid, 0);

        return true;
    } catch {
        return false;
    }
};

/**
 * Try to acquire the process-level lock. Returns the path on success;
 * throws `STATE_FILE_CORRUPT` (overloaded for lock issues) when:
 *   - lock is held by a live PID — refuses
 *   - lock is held by a dead PID OR is older than 1h — clears + acquires
 *
 * Uses `O_EXCL | O_CREAT` for atomic creation so two racing processes can't
 * both observe "no lock" and both win. If the create fails with EEXIST, we
 * inspect the existing lock for staleness (dead PID / >1h old) and retry once.
 */
export const acquireLock = async (cwd: string, changesDir: string): Promise<string> => {
    const path = lockFilePath(cwd, changesDir);

    await mkdir(dirname(path), { recursive: true });

    const info: LockInfo = {
        acquiredAt: new Date().toISOString(),
        hostname: hostname(),
        pid: process.pid,
        platform: platform(),
    };
    const payload = `${JSON.stringify(info, null, 2)}\n`;

    const tryCreate = async (): Promise<boolean> => {
        try {
            // eslint-disable-next-line no-bitwise -- POSIX open flags require bitwise OR
            const handle = await open(path, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL, 0o600);

            try {
                await handle.writeFile(payload);
            } finally {
                await handle.close();
            }

            return true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "EEXIST") {
                return false;
            }

            throw error;
        }
    };

    if (await tryCreate()) {
        return path;
    }

    // Lock exists — check whether it's stale.
    let existing: LockInfo | undefined;

    try {
        existing = JSON.parse(await readFile(path, "utf8")) as LockInfo;
    } catch {
        // Unparseable / disappeared — treat as stale.
    }

    if (existing) {
        const ageMs = Date.now() - new Date(existing.acquiredAt).getTime();
        // Host-scoped staleness check (RFC §19.1): a PID from another host
        // is meaningless on this machine, so cross-host lockfiles bypass
        // `isPidAlive` and are treated as stale. The 1h fence still applies
        // to abandoned lockfiles on this host.
        const sameHost = !existing.hostname || existing.hostname === hostname();
        const stillLive = sameHost && isPidAlive(existing.pid);

        if (stillLive && ageMs < STALE_LOCK_MS) {
            const where = existing.hostname ? `${existing.hostname}:${existing.pid}` : `PID ${existing.pid}`;

            throw new VisReleaseError({
                code: "STATE_FILE_CORRUPT",
                message: `Release lock held by ${where} (acquired ${Math.round(ageMs / 1000)}s ago). Wait for the other run, or remove ${path} if you're sure it's stale.`,
            });
        }
    }

    // Stale: clear + retry exactly once. If we still lose the race, another
    // process beat us to the takeover and is now legitimately holding it.
    try {
        await unlink(path);
    } catch {
        // best-effort
    }

    if (await tryCreate()) {
        return path;
    }

    throw new VisReleaseError({
        code: "STATE_FILE_CORRUPT",
        message: `Could not acquire release lock at ${path} after clearing a stale entry. Another process took it. Retry in a few seconds.`,
    });
};

export const releaseLock = async (cwd: string, changesDir: string): Promise<void> => {
    try {
        await unlink(lockFilePath(cwd, changesDir));
    } catch {
        // best-effort
    }
};
