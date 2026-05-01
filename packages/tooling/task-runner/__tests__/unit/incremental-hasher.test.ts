import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IncrementalFileHasher } from "../../src/incremental-hasher";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `inc-hash-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(IncrementalFileHasher, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        await mkdir(join(workspaceRoot, "src"), { recursive: true });
        await writeFile(join(workspaceRoot, "src/index.ts"), "export const x = 1;");
        await writeFile(join(workspaceRoot, "src/utils.ts"), "export const y = 2;");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("should hash all files in a directory", async () => {
        expect.assertions(3);

        const hasher = new IncrementalFileHasher({
            snapshotPath: join(workspaceRoot, ".snapshot.json"),
            workspaceRoot,
        });

        const hashes = await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(Object.keys(hashes)).toHaveLength(2);
        expect(hashes["src/index.ts"]).toBeDefined();
        expect(hashes["src/utils.ts"]).toBeDefined();
    });

    it("should reuse cached hashes for unchanged files", async () => {
        expect.assertions(1);

        const hasher = new IncrementalFileHasher({
            snapshotPath: join(workspaceRoot, ".snapshot.json"),
            workspaceRoot,
        });

        // First hash (cold)
        const hashes1 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        // Second hash (warm, should reuse mtime-based cache)
        const hashes2 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(hashes1).toStrictEqual(hashes2);
    });

    it("should detect file content changes via mtime", async () => {
        expect.assertions(2);

        const hasher = new IncrementalFileHasher({
            snapshotPath: join(workspaceRoot, ".snapshot.json"),
            workspaceRoot,
        });

        const hashes1 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        // Modify a file (changes mtime)
        await new Promise((resolve) => {
            setTimeout(resolve, 50);
        });
        await writeFile(join(workspaceRoot, "src/index.ts"), "export const x = 42;");

        const hashes2 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(hashes1["src/index.ts"]).not.toBe(hashes2["src/index.ts"]);
        // Unchanged file should keep the same hash
        expect(hashes1["src/utils.ts"]).toBe(hashes2["src/utils.ts"]);
    });

    it("should persist and restore snapshot to disk", async () => {
        expect.assertions(2);

        const snapshotPath = join(workspaceRoot, ".cache", "snapshot.json");

        const hasher1 = new IncrementalFileHasher({
            snapshotPath,
            workspaceRoot,
        });

        await hasher1.hashDirectory(join(workspaceRoot, "src"));
        await hasher1.save();

        // Create a new hasher that loads from the saved snapshot
        const hasher2 = new IncrementalFileHasher({
            snapshotPath,
            workspaceRoot,
        });

        const hashes = await hasher2.hashDirectory(join(workspaceRoot, "src"));

        expect(Object.keys(hashes)).toHaveLength(2);
        expect(hasher2.snapshotSize).toBeGreaterThan(0);
    });

    it("should handle new files appearing", async () => {
        expect.assertions(3);

        const hasher = new IncrementalFileHasher({
            snapshotPath: join(workspaceRoot, ".snapshot.json"),
            workspaceRoot,
        });

        const hashes1 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(Object.keys(hashes1)).toHaveLength(2);

        // Add a new file
        await writeFile(join(workspaceRoot, "src/new.ts"), "export const z = 3;");

        const hashes2 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(Object.keys(hashes2)).toHaveLength(3);
        expect(hashes2["src/new.ts"]).toBeDefined();
    });

    it("should handle file deletions", async () => {
        expect.assertions(3);

        const hasher = new IncrementalFileHasher({
            snapshotPath: join(workspaceRoot, ".snapshot.json"),
            workspaceRoot,
        });

        const hashes1 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(Object.keys(hashes1)).toHaveLength(2);

        // Delete a file
        await rm(join(workspaceRoot, "src/utils.ts"));

        const hashes2 = await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(Object.keys(hashes2)).toHaveLength(1);
        expect(hashes2["src/utils.ts"]).toBeUndefined();
    });

    it("should skip ignored directories", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "node_modules/pkg"), { recursive: true });
        await writeFile(join(workspaceRoot, "node_modules/pkg/index.js"), "module.exports = {}");

        const hasher = new IncrementalFileHasher({ workspaceRoot });

        const hashes = await hasher.hashDirectory(workspaceRoot);

        expect(Object.keys(hashes).some((p) => p.includes("node_modules"))).toBe(false);
    });

    it("should clear the snapshot", async () => {
        expect.assertions(2);

        const hasher = new IncrementalFileHasher({ workspaceRoot });

        await hasher.hashDirectory(join(workspaceRoot, "src"));

        expect(hasher.snapshotSize).toBeGreaterThan(0);

        hasher.clear();

        expect(hasher.snapshotSize).toBe(0);
    });
});
