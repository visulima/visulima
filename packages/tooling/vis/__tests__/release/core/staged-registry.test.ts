import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    findConflictingPendingStages,
    pruneOldEntries,
    readStagedRegistry,
    recordRecentlyNotified,
    recordRecentlyWalked,
    removePendingStages,
    stagedRegistryPath,
    upsertPendingStages,
    writeStagedRegistry,
} from "../../../src/release/core/staged-registry";
import { VisReleaseError } from "../../../src/release/errors";
import type { PendingStage, StagedRegistryFile } from "../../../src/release/types";

const CHANGES_DIR = ".vis/release";

describe("staged-registry: read/write round-trip", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "vis-staged-registry-"));
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("returns an empty registry when staged.json is absent", async () => {
        expect.hasAssertions();

        const registry = await readStagedRegistry(cwd, CHANGES_DIR);

        expect(registry.version).toBe(1);
        expect(registry.pending).toStrictEqual([]);
        expect(registry.updatedAt).toBeTypeOf("string");
    });

    it("writes the file when there's at least one pending entry", async () => {
        expect.hasAssertions();

        const entry: PendingStage = {
            id: "stage-xyz",
            name: "@scope/pkg",
            reason: "timeout",
            stagedAt: "2026-05-22T14:00:00.000Z",
            tag: "latest",
            version: "1.2.0",
        };

        const result = await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [entry],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        expect(result.changed).toBe(true);
        expect(result.removed).toBe(false);
        expect(result.path).toBe(stagedRegistryPath(cwd, CHANGES_DIR));

        const onDisk = JSON.parse(await readFile(result.path, "utf8")) as StagedRegistryFile;

        expect(onDisk.pending).toHaveLength(1);
        expect(onDisk.pending[0]).toMatchObject(entry);
    });

    it("deletes the file when the registry becomes empty", async () => {
        // Seed a non-empty file first.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [{
                id: "stage-xyz",
                name: "x",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: "now",
            version: 1,
        });

        const result = await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [],
            updatedAt: "now",
            version: 1,
        });

        expect(result.changed).toBe(true);
        expect(result.removed).toBe(true);

        await expect(readFile(result.path, "utf8")).rejects.toThrow(/ENOENT/);
    });

    it("does not touch the worktree when an empty registry was already empty on disk", async () => {
        expect.hasAssertions();

        const result = await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [],
            updatedAt: "now",
            version: 1,
        });

        expect(result.changed).toBe(false);
        expect(result.removed).toBe(false);
    });

    it("reports `changed: false` when the registry is identical to disk", async () => {
        expect.hasAssertions();

        const registry: StagedRegistryFile = {
            pending: [{
                id: "stage-xyz",
                name: "x",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        };

        await writeStagedRegistry(cwd, CHANGES_DIR, registry);
        // Second write with the same updatedAt should be a no-op.
        const second = await writeStagedRegistry(cwd, CHANGES_DIR, registry);

        expect(second.changed).toBe(false);
    });

    it("reports `changed: false` even when the in-memory updatedAt is fresher than disk", async () => {
        // Important: this is the bug-fix regression test. Without
        // pendingSetsEqual, a second write with the same pending set but
        // a fresh `updatedAt` would falsely report `changed: true` and
        // trigger a noise commit every wave.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [{
                id: "stage-xyz",
                name: "x",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        // Write the same registry but with a fresh updatedAt.
        const second = await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [{
                id: "stage-xyz",
                name: "x",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: new Date().toISOString(),
            version: 1,
        });

        expect(second.changed).toBe(false);
    });

    it("reports `changed: true` when the pending set changes (id swap)", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [{
                id: "stage-a",
                name: "x",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const second = await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [{
                id: "stage-b",
                name: "x",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        expect(second.changed).toBe(true);
    });

    it("reports `changed: true` when the same entry's reason flips (timeout → rejected)", async () => {
        expect.hasAssertions();

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [{
                id: "stage-xyz",
                name: "x",
                reason: "timeout",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        const second = await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [{
                id: "stage-xyz",
                name: "x",
                reason: "rejected",
                stagedAt: "2026-05-22T14:00:00.000Z",
                version: "1.0.0",
            }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        });

        expect(second.changed).toBe(true);
    });

    it("throws STATE_FILE_CORRUPT when staged.json is malformed JSON", async () => {
        expect.hasAssertions();

        const path = stagedRegistryPath(cwd, CHANGES_DIR);
        const { mkdir } = await import("node:fs/promises");

        await mkdir(join(cwd, CHANGES_DIR), { recursive: true });
        await writeFile(path, "{ this is not JSON }");

        await expect(readStagedRegistry(cwd, CHANGES_DIR)).rejects.toMatchObject({
            code: "STATE_FILE_CORRUPT",
        });
    });

    it("throws STATE_FILE_CORRUPT for unknown schema versions", async () => {
        expect.hasAssertions();

        const path = stagedRegistryPath(cwd, CHANGES_DIR);
        const { mkdir } = await import("node:fs/promises");

        await mkdir(join(cwd, CHANGES_DIR), { recursive: true });
        await writeFile(path, JSON.stringify({ pending: [], version: 99 }));

        await expect(readStagedRegistry(cwd, CHANGES_DIR)).rejects.toMatchObject({
            code: "STATE_FILE_CORRUPT",
        });
    });

    it("throws STATE_FILE_CORRUPT when `pending` is not an array", async () => {
        expect.hasAssertions();

        const path = stagedRegistryPath(cwd, CHANGES_DIR);
        const { mkdir } = await import("node:fs/promises");

        await mkdir(join(cwd, CHANGES_DIR), { recursive: true });
        await writeFile(path, JSON.stringify({ pending: { id: "x" }, version: 1 }));

        await expect(readStagedRegistry(cwd, CHANGES_DIR)).rejects.toBeInstanceOf(VisReleaseError);
    });
});

describe("staged-registry: pure helpers", () => {
    const buildEntry = (overrides: Partial<PendingStage>): PendingStage => {
        return {
            id: "stage-default",
            name: "@scope/pkg",
            reason: "timeout",
            stagedAt: "2026-05-22T14:00:00.000Z",
            tag: "latest",
            version: "1.0.0",
            ...overrides,
        };
    };

    describe(upsertPendingStages, () => {
        it("returns the input registry unchanged when next[] is empty", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = { pending: [], updatedAt: "now", version: 1 };

            expect(upsertPendingStages(registry, [])).toBe(registry);
        });

        it("adds new entries", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = { pending: [], updatedAt: "now", version: 1 };
            const entry = buildEntry({ id: "stage-xyz" });

            const next = upsertPendingStages(registry, [entry]);

            expect(next.pending).toStrictEqual([entry]);
        });

        it("replaces an existing entry by id, preserving the rest", () => {
            expect.hasAssertions();

            const a = buildEntry({ id: "stage-a", reason: "timeout" });
            const b = buildEntry({ id: "stage-b", name: "@scope/other" });
            const updated = buildEntry({ id: "stage-a", reason: "rejected" });

            const registry: StagedRegistryFile = { pending: [a, b], updatedAt: "now", version: 1 };
            const next = upsertPendingStages(registry, [updated]);

            expect(next.pending).toHaveLength(2);
            expect(next.pending.find((entry) => entry.id === "stage-a")?.reason).toBe("rejected");
            expect(next.pending.find((entry) => entry.id === "stage-b")).toStrictEqual(b);
        });

        it("dedupes within a single upsert call", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = { pending: [], updatedAt: "now", version: 1 };
            const first = buildEntry({ id: "stage-a", version: "1.0.0" });
            const second = buildEntry({ id: "stage-a", version: "1.0.1" });

            const next = upsertPendingStages(registry, [first, second]);

            expect(next.pending).toHaveLength(1);
            expect(next.pending[0]!.version).toBe("1.0.1");
        });
    });

    describe(removePendingStages, () => {
        it("returns the input when ids[] is empty", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = {
                pending: [buildEntry({ id: "x" })],
                updatedAt: "now",
                version: 1,
            };

            expect(removePendingStages(registry, [])).toBe(registry);
        });

        it("returns the input when nothing matches", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = {
                pending: [buildEntry({ id: "x" })],
                updatedAt: "now",
                version: 1,
            };

            expect(removePendingStages(registry, ["y"])).toBe(registry);
        });

        it("drops only matching ids", () => {
            expect.hasAssertions();

            const a = buildEntry({ id: "a" });
            const b = buildEntry({ id: "b" });
            const c = buildEntry({ id: "c" });

            const registry: StagedRegistryFile = { pending: [a, b, c], updatedAt: "now", version: 1 };
            const next = removePendingStages(registry, ["a", "c"]);

            expect(next.pending).toStrictEqual([b]);
        });

        it("treats the empty list of ids as a no-op even when registry has entries", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = {
                pending: [buildEntry({ id: "x" })],
                updatedAt: "now",
                version: 1,
            };

            expect(removePendingStages(registry, [])).toBe(registry);
        });
    });

    describe(findConflictingPendingStages, () => {
        it("returns an empty list when the registry is empty", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = { pending: [], updatedAt: "now", version: 1 };

            expect(findConflictingPendingStages(registry, ["@scope/pkg"])).toStrictEqual([]);
        });

        it("returns an empty list when no package matches", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = {
                pending: [buildEntry({ name: "@scope/a" })],
                updatedAt: "now",
                version: 1,
            };

            expect(findConflictingPendingStages(registry, ["@scope/b"])).toStrictEqual([]);
        });

        it("returns entries whose package name matches, regardless of version", () => {
            // Important behaviour: the guard blocks on *package*, not
            // (package, version). A pending pkg@1.2.0 blocks both a
            // re-publish of 1.2.0 AND a re-version to 1.2.1.
            expect.hasAssertions();

            const blocked = buildEntry({ id: "stage-old", name: "@scope/a", version: "1.0.0" });
            const allowed = buildEntry({ id: "stage-other", name: "@scope/b", version: "2.0.0" });

            const registry: StagedRegistryFile = { pending: [blocked, allowed], updatedAt: "now", version: 1 };
            const conflicts = findConflictingPendingStages(registry, ["@scope/a"]);

            expect(conflicts).toStrictEqual([blocked]);
        });

        it("matches multiple packages in one call", () => {
            expect.hasAssertions();

            const a = buildEntry({ id: "stage-a", name: "@scope/a" });
            const b = buildEntry({ id: "stage-b", name: "@scope/b" });
            const c = buildEntry({ id: "stage-c", name: "@scope/c" });

            const registry: StagedRegistryFile = { pending: [a, b, c], updatedAt: "now", version: 1 };
            const conflicts = findConflictingPendingStages(registry, ["@scope/a", "@scope/c"]);

            expect(conflicts.map((entry) => entry.id)).toStrictEqual(["stage-a", "stage-c"]);
        });
    });
});

describe("staged-registry: cross-runner notify/walk dedupe", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "vis-staged-registry-recent-"));
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("round-trips recentlyNotified + recentlyWalked through write + read", async () => {
        expect.hasAssertions();

        const registry: StagedRegistryFile = {
            pending: [],
            recentlyNotified: [{ at: new Date().toISOString(), key: "@scope/a@1.0.0" }],
            recentlyWalked: [{ at: new Date().toISOString(), key: "@scope/b@2.0.0" }],
            updatedAt: new Date().toISOString(),
            version: 1,
        };

        const write = await writeStagedRegistry(cwd, CHANGES_DIR, registry);

        // File persisted (NOT deleted) because the cross-runner arrays
        // have entries — even though pending is empty.
        expect(write.changed).toBe(true);
        expect(write.removed).toBe(false);

        const read = await readStagedRegistry(cwd, CHANGES_DIR);

        expect(read.recentlyNotified).toStrictEqual(registry.recentlyNotified);
        expect(read.recentlyWalked).toStrictEqual(registry.recentlyWalked);
    });

    it("preserves the file when pending is empty but recentlyNotified has entries", async () => {
        // Seed a registry with ONLY recentlyNotified.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [],
            recentlyNotified: [{ at: new Date().toISOString(), key: "@scope/a@1.0.0" }],
            updatedAt: new Date().toISOString(),
            version: 1,
        });

        // Read it back — file should be on disk.
        const read = await readStagedRegistry(cwd, CHANGES_DIR);

        expect(read.recentlyNotified).toHaveLength(1);
    });

    it("deletes the file ONLY when pending + recentlyNotified + recentlyWalked are all empty", async () => {
        // Seed with recents present.
        expect.hasAssertions();

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [],
            recentlyNotified: [{ at: new Date().toISOString(), key: "@scope/a@1.0.0" }],
            updatedAt: new Date().toISOString(),
            version: 1,
        });

        // Now write an entirely-empty registry — file SHOULD be deleted.
        const write = await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [],
            recentlyNotified: [],
            recentlyWalked: [],
            updatedAt: new Date().toISOString(),
            version: 1,
        });

        expect(write.removed).toBe(true);
    });

    it("prunes entries older than 30 days on write", async () => {
        expect.hasAssertions();

        const now = Date.now();
        const old = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
        const fresh = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [],
            recentlyNotified: [
                { at: old, key: "@scope/old@1.0.0" },
                { at: fresh, key: "@scope/fresh@1.0.0" },
            ],
            updatedAt: new Date().toISOString(),
            version: 1,
        });

        const read = await readStagedRegistry(cwd, CHANGES_DIR);

        // Only the fresh entry survives the prune.
        expect(read.recentlyNotified).toHaveLength(1);
        expect(read.recentlyNotified![0]!.key).toBe("@scope/fresh@1.0.0");
    });

    it("caps recentlyNotified at 100 entries (keeping the most recent)", async () => {
        expect.hasAssertions();

        const now = Date.now();
        const entries = Array.from({ length: 150 }, (_, idx) => {
            return {
            // Older entries first; idx=149 is the most recent.
                at: new Date(now - (150 - idx) * 60_000).toISOString(),
                key: `@scope/p${idx}@1.0.0`,
            };
        });

        await writeStagedRegistry(cwd, CHANGES_DIR, {
            pending: [],
            recentlyNotified: entries,
            updatedAt: new Date().toISOString(),
            version: 1,
        });

        const read = await readStagedRegistry(cwd, CHANGES_DIR);

        expect(read.recentlyNotified).toHaveLength(100);

        // The oldest 50 dropped: surviving entries should include p149 (most recent).
        const keys = new Set((read.recentlyNotified ?? []).map((entry) => entry.key));

        expect(keys.has("@scope/p149@1.0.0")).toBe(true);
        expect(keys.has("@scope/p0@1.0.0")).toBe(false);
    });

    it("does not produce a noise write when only the in-memory updatedAt changed", async () => {
        expect.hasAssertions();

        const initial: StagedRegistryFile = {
            pending: [],
            recentlyNotified: [{ at: "2026-05-22T14:00:00.000Z", key: "@scope/a@1.0.0" }],
            updatedAt: "2026-05-22T14:00:00.000Z",
            version: 1,
        };

        await writeStagedRegistry(cwd, CHANGES_DIR, initial);

        const second = await writeStagedRegistry(cwd, CHANGES_DIR, {
            ...initial,
            updatedAt: new Date().toISOString(), // newer timestamp, same content
        });

        expect(second.changed).toBe(false);
    });

    describe(pruneOldEntries, () => {
        it("returns an empty array when input is undefined or empty", () => {
            expect.hasAssertions();
            expect(pruneOldEntries(undefined)).toStrictEqual([]);
            expect(pruneOldEntries([])).toStrictEqual([]);
        });

        it("drops entries older than 30 days", () => {
            expect.hasAssertions();

            const now = Date.now();
            const old = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
            const fresh = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();

            const result = pruneOldEntries(
                [
                    { at: old, key: "old" },
                    { at: fresh, key: "fresh" },
                ],
                now,
            );

            expect(result).toStrictEqual([{ at: fresh, key: "fresh" }]);
        });

        it("caps the result to 100 entries even when all are within the 30-day window", () => {
            expect.hasAssertions();

            const now = Date.now();
            const entries = Array.from({ length: 150 }, (_, idx) => {
                return {
                    at: new Date(now - (150 - idx) * 60_000).toISOString(),
                    key: `k${idx}`,
                };
            });

            const result = pruneOldEntries(entries, now);

            expect(result).toHaveLength(100);
        });

        it("treats bad-timestamp entries as expired (defensive)", () => {
            expect.hasAssertions();

            const now = Date.now();
            const result = pruneOldEntries(
                [
                    { at: "not-a-date", key: "bad" },
                    { at: new Date(now - 60_000).toISOString(), key: "good" },
                ],
                now,
            );

            expect(result.map((entry) => entry.key)).toStrictEqual(["good"]);
        });
    });

    describe("recordRecentlyNotified / recordRecentlyWalked", () => {
        it("appends new keys with the supplied timestamp", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = {
                pending: [],
                updatedAt: "old",
                version: 1,
            };

            const next = recordRecentlyNotified(registry, ["@scope/a@1.0.0"], "2026-05-22T14:00:00.000Z");

            expect(next.recentlyNotified).toStrictEqual([{ at: "2026-05-22T14:00:00.000Z", key: "@scope/a@1.0.0" }]);
            expect(next.updatedAt).toBe("2026-05-22T14:00:00.000Z");
        });

        it("dedupes against existing entries (same wave, same key)", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = {
                pending: [],
                recentlyNotified: [{ at: "earlier", key: "@scope/a@1.0.0" }],
                updatedAt: "old",
                version: 1,
            };

            const next = recordRecentlyNotified(registry, ["@scope/a@1.0.0", "@scope/b@2.0.0"], "later");

            // Only the new key gets appended; the existing one keeps its
            // original `at` so subsequent prune cycles compare against the
            // FIRST notification time.
            expect(next.recentlyNotified).toHaveLength(2);
            expect(next.recentlyNotified!.find((entry) => entry.key === "@scope/a@1.0.0")!.at).toBe("earlier");
            expect(next.recentlyNotified!.find((entry) => entry.key === "@scope/b@2.0.0")!.at).toBe("later");
        });

        it("returns the input unchanged when keys[] is empty", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = { pending: [], updatedAt: "old", version: 1 };

            expect(recordRecentlyNotified(registry, [])).toBe(registry);
            expect(recordRecentlyWalked(registry, [])).toBe(registry);
        });

        it("returns the input unchanged when nothing new to add", () => {
            expect.hasAssertions();

            const registry: StagedRegistryFile = {
                pending: [],
                recentlyWalked: [{ at: "earlier", key: "@scope/a@1.0.0" }],
                updatedAt: "old",
                version: 1,
            };

            expect(recordRecentlyWalked(registry, ["@scope/a@1.0.0"])).toBe(registry);
        });
    });
});
