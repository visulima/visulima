import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { IncrementalFileHasher } from "../../src/incremental-hasher";
import { InProcessTaskHasher } from "../../src/task-hasher";
import type { Task } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `incremental-hot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe("incrementalFileHasher × InProcessTaskHasher hot path", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
        await mkdir(join(workspaceRoot, "packages/lib/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib/src/index.ts"), "export const a = 1;");
        await writeFile(join(workspaceRoot, "packages/lib/package.json"), '{"name":"lib"}');
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("snapshot has matching hashes across two hasher instances sharing the same IncrementalFileHasher", async () => {
        expect.assertions(1);

        const incremental = new IncrementalFileHasher({ workspaceRoot });

        await incremental.load();

        const hasher = new InProcessTaskHasher({
            incrementalHasher: incremental,
            projects: { lib: { root: "packages/lib" } },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib:build",
            outputs: [],
            overrides: {},
            target: { project: "lib", target: "build" },
        };

        const first = await hasher.hashTask(task);

        // Fresh hasher, same snapshot. The file hashes in the new run
        // must exactly match the first run — unchanged files must
        // produce identical hashes regardless of read path.
        const hasher2 = new InProcessTaskHasher({
            incrementalHasher: incremental,
            projects: { lib: { root: "packages/lib" } },
            workspaceRoot,
        });

        const second = await hasher2.hashTask(task);

        // Compare entries as a single assertion — avoids a dynamic
        // `expect.assertions()` count that depends on how many files
        // matched this glob.
        expect(second.nodes).toStrictEqual(first.nodes);
    });

    it("falls back to re-reading when a file's mtime changes", async () => {
        expect.assertions(2);

        const incremental = new IncrementalFileHasher({ workspaceRoot });

        await incremental.load();

        const hasher = new InProcessTaskHasher({
            incrementalHasher: incremental,
            projects: { lib: { root: "packages/lib" } },
            workspaceRoot,
        });

        const task: Task = {
            id: "lib:build",
            outputs: [],
            overrides: {},
            target: { project: "lib", target: "build" },
        };

        const first = await hasher.hashTask(task);

        // Mutate a tracked file — mtime + size change → snapshot miss.
        await writeFile(join(workspaceRoot, "packages/lib/src/index.ts"), "export const a = 2;\nconst b = 42;");

        const hasher2 = new InProcessTaskHasher({
            incrementalHasher: incremental,
            projects: { lib: { root: "packages/lib" } },
            workspaceRoot,
        });

        const second = await hasher2.hashTask(task);

        // Same task, different file contents → different nodes hash.
        expect(first.nodes["packages/lib/src/index.ts"]).toBeDefined();
        expect(first.nodes["packages/lib/src/index.ts"]).not.toBe(second.nodes["packages/lib/src/index.ts"]);
    });
});
