import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Force the pure-JS hashing path: with the native addon present, filesets are
// hashed by the Rust batch and never touch `#hashFile`, so the in-memory
// `#fileHashCache` (the staleness vector this test guards) is bypassed. Mock
// the addon away (hoisted above the imports below) so `#hashFileSet` walks
// files through `#hashFile`.
vi.mock(import("../../src/native-binding"), () => {
    return {
        isNativeAvailable: () => false,
        loadNativeBindings: () => undefined,
    };
});

// eslint-disable-next-line import/first -- must come after the hoisted vi.mock
import { InProcessTaskHasher } from "../../src/task-hasher";
// eslint-disable-next-line import/first -- must come after the hoisted vi.mock
import type { Task } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `stale-cache-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe("task-hasher in-memory cache revalidation (JS path)", () => {
    let workspaceRoot: string;

    const sourceRelative = join("packages", "lib-a", "src", "index.ts");

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        await mkdir(join(workspaceRoot, "packages", "lib-a", "src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages", "lib-a", "package.json"), "{\"name\":\"lib-a\"}");
        await writeFile(join(workspaceRoot, sourceRelative), "export const a = 1;");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    const buildHasher = (): InstanceType<typeof InProcessTaskHasher> =>
        new InProcessTaskHasher({
            projects: { "lib-a": { root: join("packages", "lib-a") } },
            workspaceRoot,
        });

    const task: Task = {
        id: "lib-a:build",
        outputs: [],
        overrides: {},
        target: { project: "lib-a", target: "build" },
    };

    it("re-reads a file mutated between two hashes on the same hasher", async () => {
        expect.assertions(2);

        const hasher = buildHasher();

        const before = await hasher.hashTask(task);
        const beforeHash = before.nodes[sourceRelative];

        // A different upstream task could rewrite this file mid-run. Change the
        // content AND its size so revalidation is deterministic regardless of
        // mtime granularity.
        await writeFile(join(workspaceRoot, sourceRelative), "export const a = 2; // mutated upstream");

        const after = await hasher.hashTask(task);
        const afterHash = after.nodes[sourceRelative];

        expect(beforeHash).toBeDefined();
        // Without revalidation the stale in-memory cache would return beforeHash.
        expect(afterHash).not.toBe(beforeHash);
    });

    it("still serves the in-memory cache when the file is unchanged", async () => {
        expect.assertions(1);

        const hasher = buildHasher();

        const first = await hasher.hashTask(task);
        const second = await hasher.hashTask(task);

        expect(second.nodes[sourceRelative]).toBe(first.nodes[sourceRelative]);
    });
});
