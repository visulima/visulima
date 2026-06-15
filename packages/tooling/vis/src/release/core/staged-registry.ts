/**
 * Pending staged-publish registry (`&lt;changesDir>/staged.json`).
 *
 * Tracks tarballs uploaded to npm but not yet approved by a maintainer.
 * Unlike `.state.json` (gitignored, ephemeral, per-wave) this file lives
 * in the worktree and is committed by `vis release publish` so the
 * pending set survives:
 *
 *   - fresh CI runner clones (state from a prior run is in the commit)
 *   - branch switches (you see what's still pending wherever you are)
 *   - workflow re-runs after a timeout
 *
 * Three operations only:
 *   - read: load whatever's on disk (empty registry if absent)
 *   - upsert: add or replace entries by id, keeping the rest
 *   - remove: drop entries by id (used by `stage approve|reject` and
 *     by the publish flow when re-running picks up an approved id)
 *
 * Schema (`StagedRegistryFile`) lives in `release/types.ts`. The file
 * is created with `version: 1`; readers tolerant of forward versions
 * are out of scope (a hard fail with `STATE_FILE_CORRUPT` is fine —
 * the operator can resolve manually).
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { VisReleaseError } from "../errors";
import type { PendingStage, StagedRegistryFile } from "../types";

export const stagedRegistryPath = (cwd: string, changesDir: string): string => join(cwd, changesDir, "staged.json");

const emptyRegistry = (): StagedRegistryFile => {
    return {
        pending: [],
        recentlyNotified: [],
        recentlyWalked: [],
        updatedAt: new Date().toISOString(),
        version: 1,
    };
};

/**
 * Cap on how many cross-run dedupe entries (`recentlyNotified` /
 * `recentlyWalked`) we keep in the registry. The spec says "last 30 days
 * OR last 100 entries, whichever is smaller". We apply BOTH filters on
 * every write so the file never grows unboundedly even on a workspace
 * that releases many times per day.
 */
const MAX_RECENT_ENTRIES = 100;
const MAX_RECENT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Drop entries older than 30 days, then keep only the most recent 100.
 * Exported so callers (orchestrator, future tooling) can prune without
 * going through a write cycle.
 *
 * Pure — no I/O, no mutation of the input array.
 */
export const pruneOldEntries = (
    entries: ReadonlyArray<{ at: string; key: string }> | undefined,
    now: number = Date.now(),
): { at: string; key: string }[] => {
    if (!entries || entries.length === 0) {
        return [];
    }

    const cutoff = now - MAX_RECENT_AGE_MS;
    const filtered = entries.filter((entry) => {
        // Tolerate bad timestamps from a prior version / corrupted write:
        // a NaN `at` is treated as expired so we drop the noise.
        const parsed = Date.parse(entry.at);

        return Number.isFinite(parsed) && parsed >= cutoff;
    });

    if (filtered.length <= MAX_RECENT_ENTRIES) {
        return filtered;
    }

    // Sort by `at` DESC and take the head. Stable sort preserves the
    // insertion order for entries with identical timestamps.
    return [...filtered]
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, MAX_RECENT_ENTRIES);
};

/**
 * Load the registry. Returns an empty (in-memory only) registry when the
 * file is absent — callers shouldn't have to special-case "first run".
 *
 * A corrupt or unparseable file throws `STATE_FILE_CORRUPT` so the
 * operator notices instead of vis silently dropping pending stages.
 */
export const readStagedRegistry = async (cwd: string, changesDir: string): Promise<StagedRegistryFile> => {
    const path = stagedRegistryPath(cwd, changesDir);

    let content: string;

    try {
        content = await readFile(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return emptyRegistry();
        }

        throw new VisReleaseError({
            cause: error,
            code: "STATE_FILE_CORRUPT",
            message: `Failed to read staged registry at ${path}: ${(error as Error).message}`,
        });
    }

    let parsed: StagedRegistryFile;

    try {
        parsed = JSON.parse(content) as StagedRegistryFile;
    } catch (error) {
        throw new VisReleaseError({
            cause: error,
            code: "STATE_FILE_CORRUPT",
            message: `Staged registry at ${path} is not valid JSON: ${(error as Error).message}. Remove the file or fix it manually.`,
        });
    }

    if (parsed.version !== 1) {
        throw new VisReleaseError({
            code: "STATE_FILE_CORRUPT",
            message: `Staged registry at ${path} reports unknown version ${parsed.version}. Upgrade vis or remove the file.`,
        });
    }

    if (!Array.isArray(parsed.pending)) {
        throw new VisReleaseError({
            code: "STATE_FILE_CORRUPT",
            message: `Staged registry at ${path} is missing the "pending" array.`,
        });
    }

    return parsed;
};

/**
 * Write the registry to disk. The file is deleted when ALL three state
 * arrays (pending stages, recentlyNotified, recentlyWalked) are empty —
 * the worktree shouldn't carry a noisy empty record forever, but as
 * long as we have cross-runner dedupe state to preserve, the file stays.
 * Either operation surfaces via the returned `changed` flag so callers
 * can skip the commit step when nothing needs to ship.
 *
 * No-op detection compares the semantic content against what's on disk
 * — a registry whose entries are unchanged from disk returns
 * `changed: false` even though our in-memory `updatedAt` would
 * otherwise differ. This stops the orchestrator from producing a noise
 * commit every wave.
 */
export const writeStagedRegistry = async (
    cwd: string,
    changesDir: string,
    registry: StagedRegistryFile,
): Promise<{ changed: boolean; path: string; removed: boolean }> => {
    const path = stagedRegistryPath(cwd, changesDir);

    let previous: StagedRegistryFile | undefined;

    try {
        const raw = await readFile(path, "utf8");

        previous = JSON.parse(raw) as StagedRegistryFile;
    } catch {
        previous = undefined;
    }

    // Prune cross-run dedupe arrays on every write so the registry never
    // accumulates more than 30 days / 100 entries per array. Done HERE
    // (not at every upsert) so callers can compose multiple in-memory
    // mutations cheaply and only pay the prune cost at the IO boundary.
    const prunedNotified = pruneOldEntries(registry.recentlyNotified);
    const prunedWalked = pruneOldEntries(registry.recentlyWalked);
    const next: StagedRegistryFile = {
        ...registry,
        recentlyNotified: prunedNotified,
        recentlyWalked: prunedWalked,
    };

    // The file lives on disk for THREE reasons now: pending stages,
    // recentlyNotified, recentlyWalked. Only delete when ALL THREE are
    // empty — otherwise we'd lose the cross-runner dedupe state every
    // time the pending set drained.
    const hasNoState = next.pending.length === 0
        && prunedNotified.length === 0
        && prunedWalked.length === 0;

    if (hasNoState) {
        if (previous === undefined) {
            return { changed: false, path, removed: false };
        }

        try {
            await unlink(path);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }

        return { changed: true, path, removed: true };
    }

    if (previous && registryContentsEqual(previous, next)) {
        // Disk already reflects the desired state. Skip the write (and
        // therefore the commit) so unchanged waves don't produce noise.
        return { changed: false, path, removed: false };
    }

    await mkdir(dirname(path), { recursive: true });

    const payload = `${JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2)}\n`;

    await writeFile(path, payload);

    return { changed: true, path, removed: false };
};

/**
 * Append `${name}@${version}` (with the current ISO timestamp) to
 * `recentlyNotified`, deduping against entries already present so two
 * mutations within the same wave don't accumulate. Pure — no I/O.
 */
export const recordRecentlyNotified = (
    registry: StagedRegistryFile,
    keys: ReadonlyArray<string>,
    now: string = new Date().toISOString(),
): StagedRegistryFile => {
    if (keys.length === 0) {
        return registry;
    }

    const existing = registry.recentlyNotified ?? [];
    const seen = new Set(existing.map((entry) => entry.key));
    const additions = keys.filter((key) => !seen.has(key)).map((key) => {
        return { at: now, key };
    });

    if (additions.length === 0) {
        return registry;
    }

    return {
        ...registry,
        recentlyNotified: [...existing, ...additions],
        updatedAt: now,
    };
};

/**
 * Same shape as `recordRecentlyNotified` but for the `walked` set —
 * tracks packages whose PR/issue sticky-comment + label landed on a
 * prior run so a fresh CI runner doesn't re-walk them.
 */
export const recordRecentlyWalked = (
    registry: StagedRegistryFile,
    keys: ReadonlyArray<string>,
    now: string = new Date().toISOString(),
): StagedRegistryFile => {
    if (keys.length === 0) {
        return registry;
    }

    const existing = registry.recentlyWalked ?? [];
    const seen = new Set(existing.map((entry) => entry.key));
    const additions = keys.filter((key) => !seen.has(key)).map((key) => {
        return { at: now, key };
    });

    if (additions.length === 0) {
        return registry;
    }

    return {
        ...registry,
        recentlyWalked: [...existing, ...additions],
        updatedAt: now,
    };
};

/**
 * Add or replace pending entries by id, preserving existing entries
 * that aren't in `next`. Pure — no I/O. Useful when composing multiple
 * incremental updates within a single publish wave.
 */
export const upsertPendingStages = (
    registry: StagedRegistryFile,
    next: ReadonlyArray<PendingStage>,
): StagedRegistryFile => {
    if (next.length === 0) {
        return registry;
    }

    const byId = new Map(registry.pending.map((entry) => [entry.id, entry] as const));

    for (const entry of next) {
        byId.set(entry.id, entry);
    }

    return {
        ...registry,
        pending: [...byId.values()],
        updatedAt: new Date().toISOString(),
    };
};

/**
 * Drop pending entries whose id appears in `ids`. Returns an unchanged
 * registry when nothing matches so callers can short-circuit the
 * commit step.
 */
export const removePendingStages = (
    registry: StagedRegistryFile,
    ids: ReadonlyArray<string>,
): StagedRegistryFile => {
    if (ids.length === 0 || registry.pending.length === 0) {
        return registry;
    }

    const drop = new Set(ids);
    const next = registry.pending.filter((entry) => !drop.has(entry.id));

    if (next.length === registry.pending.length) {
        return registry;
    }

    return {
        ...registry,
        pending: next,
        updatedAt: new Date().toISOString(),
    };
};

/**
 * Find pending stages targeting any of the given package names. Used by
 * the version + publish guardrails to refuse work that would conflict
 * with an in-flight stage from a prior wave.
 *
 * Comparison is by package name only — the version is intentionally
 * ignored because a pending `pkg@1.2.0` would block re-versioning to
 * `1.2.1` (would orphan the prior tarball). The CALLER is responsible
 * for refining "same package, same version" (resume case → allow) vs
 * "same package, different version" (orphan-risk case → block) since
 * the plan version isn't visible at this layer.
 */
export const findConflictingPendingStages = (
    registry: StagedRegistryFile,
    packageNames: ReadonlyArray<string>,
): PendingStage[] => {
    if (registry.pending.length === 0 || packageNames.length === 0) {
        return [];
    }

    const set = new Set(packageNames);

    return registry.pending.filter((entry) => set.has(entry.name));
};

/**
 * Stable structural comparison of two registries (pending + the two
 * cross-run dedupe arrays). Used by `writeStagedRegistry` to skip the
 * disk write (and thus the auto-commit) when the semantic content is
 * unchanged — otherwise the `updatedAt` timestamp alone would force a
 * noise commit every wave.
 *
 * Order-independent within each list: registries with the same entries
 * in different order compare equal.
 */
const recentSetsEqual = (
    a: ReadonlyArray<{ at: string; key: string }> | undefined,
    b: ReadonlyArray<{ at: string; key: string }> | undefined,
): boolean => {
    const ax = a ?? [];
    const bx = b ?? [];

    if (ax.length !== bx.length) {
        return false;
    }

    if (ax.length === 0) {
        return true;
    }

    const byKey = new Map(ax.map((entry) => [entry.key, entry] as const));

    for (const entry of bx) {
        const match = byKey.get(entry.key);

        if (match?.at !== entry.at) {
            return false;
        }
    }

    return true;
};

export const registryContentsEqual = (
    a: StagedRegistryFile,
    b: StagedRegistryFile,
): boolean => pendingSetsEqual(a.pending, b.pending)
    && recentSetsEqual(a.recentlyNotified, b.recentlyNotified)
    && recentSetsEqual(a.recentlyWalked, b.recentlyWalked);

/**
 * Stable structural comparison of two registries' pending sets. Kept as
 * a public helper so the existing callers (the tests + the publish
 * loop's no-op detection) don't break.
 */
export const pendingSetsEqual = (
    a: ReadonlyArray<PendingStage>,
    b: ReadonlyArray<PendingStage>,
): boolean => {
    if (a.length !== b.length) {
        return false;
    }

    if (a.length === 0) {
        return true;
    }

    const aById = new Map(a.map((entry) => [entry.id, entry] as const));

    for (const entry of b) {
        const match = aById.get(entry.id);

        if (!match) {
            return false;
        }

        if (
            match.name !== entry.name
            || match.version !== entry.version
            || match.reason !== entry.reason
            || (match.tag ?? "latest") !== (entry.tag ?? "latest")
        ) {
            return false;
        }
    }

    return true;
};
