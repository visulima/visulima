import { randomBytes } from "node:crypto";
import { open, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";

import { ensureDir, isAccessible, readJson } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisWorkspaceDir } from "../util/vis-paths";
import type { ServiceEntry } from "./types";

/**
 * Mode for entry JSON files and log files: 0o600 (owner-read/write).
 * Service stdout often contains DB URLs, API tokens, OAuth secrets, etc.
 * On a shared host (CI runner with multiple jobs sharing $HOME, dev
 * container with mounted homedir, multi-user build server) anything less
 * permissive leaks credentials to every account on the box.
 */
export const REGISTRY_FILE_MODE = 0o600;

const LOCK_TIMEOUT_MS = 5000;
const LOCK_POLL_MS = 50;
/** A lock older than this with no live owner is treated as stale. */
const LOCK_STALE_MS = 30_000;

/**
 * Returns the registry directory for a workspace. Creates it on demand.
 * Lives outside the workspace tree because writing PID files into the
 * workspace would dirty `affected` detection.
 *
 * Translates the "path exists as a file" error (ENOTDIR) into a clear
 * actionable message — `ensureDir`'s native error code is opaque enough
 * that operators waste time grepping the codebase. EEXIST is *not*
 * remapped: in modern Node it surfaces only on legitimate races (a
 * concurrent `ensureDir` on the same path), and rebranding it as
 * "exists but not a directory" would be misleading.
 */
export const getRegistryDir = async (workspaceRoot: string): Promise<string> => {
    const directory = join(getVisWorkspaceDir(workspaceRoot), "services");

    try {
        await ensureDir(directory);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOTDIR") {
            throw new Error(
                `Service registry path ${directory} exists but is not a directory. Remove it or move the conflicting file before running \`vis service\`.`,
                { cause: error },
            );
        }

        throw error;
    }

    return directory;
};

/**
 * Filesystem-safe slug for a target id. Task ids contain `:` and `/`
 * (e.g. `apps/api:db`), neither of which are portable in filenames on
 * Windows. Replace with underscore-pairs so the slug stays reversible
 * by inspection.
 *
 * Known collision modes — accepted as pre-existing limitations rather
 * than worked around with hashing, because both are extreme edge cases
 * and round-trippable filenames are useful for ad-hoc debugging:
 *
 * 1. **Case-insensitive filesystems** (macOS HFS+ default, NTFS without
 *    case-sensitivity) collapse `apps/api:Db` and `apps/api:db` into
 *    the same file. We don't lower-case ids because vis ids are
 *    case-sensitive everywhere else.
 * 2. **Same-encoding inputs**: `apps/api:db` slugifies to
 *    `apps_api__db`, which is the same as the slug for the (highly
 *    unusual) literal id `apps_api:db` or `apps/api__db`. Vis project
 *    ids are package names and project paths in practice, so neither
 *    `_` runs nor literal `:` characters in segments occur.
 */
export const slugify = (id: string): string => id.replaceAll("/", "_").replaceAll(":", "__");

const entryPath = (registryDirectory: string, id: string): string => join(registryDirectory, `${slugify(id)}.json`);

const lockPath = (registryDirectory: string, id: string): string => join(registryDirectory, `${slugify(id)}.lock`);

/**
 * Read a single service entry by id. Returns undefined when the entry
 * is missing or unparseable — callers treat both as "not registered".
 */
export const readEntry = async (workspaceRoot: string, id: string): Promise<ServiceEntry | undefined> => {
    const directory = await getRegistryDir(workspaceRoot);
    const path = entryPath(directory, id);

    if (!(await isAccessible(path))) {
        return undefined;
    }

    try {
        return (await readJson(path)) as unknown as ServiceEntry;
    } catch {
        return undefined;
    }
};

/**
 * Read every service entry in the workspace's registry. Skips files
 * that fail to parse so a single corrupt entry can't poison the list.
 */
export const readAllEntries = async (workspaceRoot: string): Promise<ServiceEntry[]> => {
    const directory = await getRegistryDir(workspaceRoot);

    let names: string[];

    try {
        names = await readdir(directory);
    } catch {
        return [];
    }

    const entries: ServiceEntry[] = [];

    for (const name of names) {
        if (!name.endsWith(".json")) {
            continue;
        }

        try {
            const entry = (await readJson(join(directory, name))) as unknown as ServiceEntry;

            entries.push(entry);
        } catch {
            // Skip corrupt entries — `pruneDead` or a manual `vis
            // service stop --all` will clean them up eventually.
        }
    }

    return entries;
};

/**
 * Atomically write a service entry. Mirrors the `tmp + rename` pattern
 * used in `task-runner/src/cas/action-cache.ts` so concurrent writers
 * never observe a half-written entry. Files are written with mode 0o600
 * to keep service env / metadata private to the owning user.
 *
 * On Windows, `rename` can fail with EPERM/EACCES when antivirus is
 * scanning the staging file or another writer has the target briefly
 * open. The rename is retried with a short backoff before we surface
 * the error — only on errno codes that match the AV/sharing scenarios.
 */
export const writeEntry = async (workspaceRoot: string, entry: ServiceEntry): Promise<void> => {
    const directory = await getRegistryDir(workspaceRoot);
    const finalPath = entryPath(directory, entry.id);
    const stagingPath = join(directory, `.${randomBytes(8).toString("hex")}.tmp`);

    await writeFile(stagingPath, `${JSON.stringify(entry, undefined, 2)}\n`, { mode: REGISTRY_FILE_MODE });

    try {
        await renameWithRetry(stagingPath, finalPath);
    } catch (error) {
        await rm(stagingPath, { force: true }).catch(() => {});

        throw error;
    }
};

/** Errno codes that indicate a transient AV/file-locking race on Windows. */
const TRANSIENT_RENAME_CODES = new Set(["EACCES", "EBUSY", "EPERM"]);
const RENAME_MAX_ATTEMPTS = 8;
const RENAME_INITIAL_BACKOFF_MS = 20;

const renameWithRetry = async (from: string, to: string): Promise<void> => {
    let attempt = 0;

    while (true) {
        try {
            await rename(from, to);

            return;
        } catch (error) {
            const { code } = error as NodeJS.ErrnoException;
            const isTransient = code !== undefined && TRANSIENT_RENAME_CODES.has(code);

            if (!isTransient || attempt >= RENAME_MAX_ATTEMPTS) {
                throw error;
            }

            const delay = RENAME_INITIAL_BACKOFF_MS * 2 ** attempt;

            await new Promise<void>((resolve) => {
                setTimeout(resolve, delay);
            });

            attempt += 1;
        }
    }
};

/**
 * Remove an entry's JSON record and (when known) its captured log file.
 * Pass the cached `entry` to skip a redundant `readEntry` round-trip —
 * `pruneDead` already has it in hand. Idempotent: missing files are
 * silently ignored so concurrent stop attempts don't race.
 */
export const deleteEntry = async (workspaceRoot: string, id: string, entry?: ServiceEntry): Promise<void> => {
    const directory = await getRegistryDir(workspaceRoot);
    const resolved = entry ?? (await readEntry(workspaceRoot, id));

    await rm(entryPath(directory, id), { force: true });

    if (resolved) {
        await rm(resolved.logFile, { force: true }).catch(() => {});
    }
};

/**
 * Returns `true` when the entry's PID is currently alive.
 *
 * Uses signal `0` — POSIX semantics: no signal sent, but errno reflects
 * whether the target exists. Treats EPERM (process exists but owned by
 * another uid) as **not alive** for our purposes: a long-lived registry
 * across reboots can collide with a recycled PID owned by some daemon.
 * Auto-attaching to a stranger is worse than missing a service we do
 * own — the operator can always restart it.
 */
export const isAlive = (pid: number): boolean => {
    try {
        process.kill(pid, 0);

        return true;
    } catch {
        return false;
    }
};

/**
 * Result of `pruneDead`: which entry ids were pruned, plus the surviving
 * entries from the same registry read. Returning the surviving entries
 * lets `vis service list` skip a redundant `readAllEntries` round-trip
 * — the registry directory is on `$HOME` so the I/O cost matters on
 * sluggish network homes.
 *
 * Entries that were dead on disk but had a fresh restart between read
 * and delete (the concurrent-restart race) are returned in `surviving`,
 * not `pruned` — the new PID is now live.
 */
export interface PruneDeadResult {
    pruned: string[];
    surviving: ServiceEntry[];
}

/**
 * Drop entries whose PIDs are no longer alive. Returns the pruned ids
 * (so `vis service list` can surface what went away) and the surviving
 * entries from the same registry read. Errors during deletion are
 * swallowed — the next prune will retry.
 *
 * Re-reads the entry just before deletion to defend against the race
 * where another shell restarted the same service between our liveness
 * check and our delete. If the on-disk PID has changed, the new entry
 * is left intact and reported as surviving.
 */
export const pruneDead = async (workspaceRoot: string): Promise<PruneDeadResult> => {
    const entries = await readAllEntries(workspaceRoot);
    const pruned: string[] = [];
    const surviving: ServiceEntry[] = [];

    for (const entry of entries) {
        if (isAlive(entry.pid)) {
            surviving.push(entry);
            continue;
        }

        const current = await readEntry(workspaceRoot, entry.id);

        if (current && current.pid !== entry.pid) {
            // A concurrent restart wrote a fresh entry — leave it alone
            // and report the *current* entry, not the dead one we read.
            surviving.push(current);
            continue;
        }

        await deleteEntry(workspaceRoot, entry.id, entry).catch(() => {});

        pruned.push(entry.id);
    }

    return { pruned, surviving };
};

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const tryClaimLock = async (path: string): Promise<boolean> => {
    try {
        // `wx`: exclusive create. Fails with EEXIST if the lockfile
        // already exists — the portable cross-platform mutex.
        const handle = await open(path, "wx", REGISTRY_FILE_MODE);

        try {
            await handle.writeFile(String(process.pid));
        } finally {
            await handle.close().catch(() => {});
        }

        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
            return false;
        }

        throw error;
    }
};

const isLockStale = async (path: string): Promise<boolean> => {
    let pid: number | undefined;

    try {
        const raw = await readFile(path, "utf8");
        const parsed = Number.parseInt(raw.trim(), 10);

        pid = Number.isFinite(parsed) ? parsed : undefined;
    } catch {
        // Lock disappeared — treat as stale (caller will retry the
        // wx create and either win or see a fresh lock).
        return true;
    }

    if (pid !== undefined && !isAlive(pid)) {
        return true;
    }

    // Empty / unparseable PID: rely on age. If the file is older than
    // LOCK_STALE_MS the writer almost certainly crashed mid-acquire.
    try {
        const stats = await stat(path);

        return Date.now() - stats.mtimeMs > LOCK_STALE_MS;
    } catch {
        return true;
    }
};

/**
 * Serialize service-mutating operations on a single id across processes.
 * Uses an exclusive-create lockfile (`open(path, "wx")`) — portable on
 * POSIX and Windows. Stale locks (dead writer PID, or older than
 * LOCK_STALE_MS) are reclaimed automatically.
 *
 * Without this, two concurrent `vis service start &lt;id>` invocations
 * each spawn a child and the second `writeEntry` orphans the first
 * child (still running, but unregistered — the port is bound forever).
 */
export const withServiceLock = async <T>(workspaceRoot: string, id: string, fn: () => Promise<T>): Promise<T> => {
    const directory = await getRegistryDir(workspaceRoot);
    const path = lockPath(directory, id);
    const start = Date.now();

    while (true) {
        if (await tryClaimLock(path)) {
            break;
        }

        if (await isLockStale(path)) {
            await unlink(path).catch(() => {});
            continue;
        }

        if (Date.now() - start >= LOCK_TIMEOUT_MS) {
            throw new Error(
                `Could not acquire service lock for ${id} within ${String(LOCK_TIMEOUT_MS)}ms — another \`vis service\` invocation appears to be holding it.`,
            );
        }

        await sleep(LOCK_POLL_MS);
    }

    try {
        return await fn();
    } finally {
        await unlink(path).catch(() => {});
    }
};
