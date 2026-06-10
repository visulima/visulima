/**
 * Integration: lockfile changes invalidate task hashes
 *
 * Public API used:
 *   - `InProcessTaskHasher` — constructor takes `TaskHasherOptions`
 *     (workspaceRoot, projects, smartLockfileHashing?, globalInputs?, …)
 *   - `hashTask(task: Task): Promise<TaskHashDetails>` — the method that
 *     returns the per-task hash details bag
 *   - `computeTaskHash(details: TaskHashDetails): string` — converts the bag
 *     into a single opaque hash string
 *
 * Two hashing modes exercised here:
 *
 *   Default mode  (smartLockfileHashing: false, the default)
 *     The lockfile is a *global* input — it is hashed as a whole file and its
 *     hash is mixed into every task's `__global__` implicit dep.  Any change to
 *     the lockfile therefore changes EVERY task's final hash.
 *
 *   Smart mode  (smartLockfileHashing: true)
 *     The lockfile is excluded from the global inputs list (see
 *     `LOCKFILE_NAMES` filter in `#computeGlobalHash`).  Instead a
 *     `LockfileHasher` reads only the resolved versions of the project's own
 *     direct + dev dependencies and stores them in
 *     `implicitDeps["__lockfile__"]`.  Changing an unrelated package's version
 *     in the lockfile does NOT bust the hash; changing one of the project's
 *     own deps DOES.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { computeTaskHash, InProcessTaskHasher } from "../../src/task-hasher";
import type { Task } from "../../src/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `lockfile-invalidation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

/** Minimal pnpm-lock.yaml that parsePnpmLockfile can successfully parse. */
const buildPnpmLockfile = (lodashVersion: string, unrelatedVersion = "2.0.0"): string => `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      lodash:
        specifier: ^4.17.0
        version: ${lodashVersion}
      unrelated-pkg:
        specifier: ^2.0.0
        version: ${unrelatedVersion}
`;

/** Minimal Task fixture for the "lib-a:build" target. */
const makeTask = (): Task => ({
    id: "lib-a:build",
    outputs: [],
    overrides: {},
    target: { project: "lib-a", target: "build" },
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("lockfile invalidation", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        // Minimal monorepo layout: one package that depends only on "lodash".
        await mkdir(join(workspaceRoot, "packages/lib-a/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib-a/src/index.ts"), "export const x = 1;\n");
        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "lib-a",
            }),
        );
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    // -----------------------------------------------------------------------
    // Default mode (smartLockfileHashing: false / unset)
    // -----------------------------------------------------------------------

    it("default mode — version bump changes hash", async () => {
        expect.assertions(1);

        // Write initial lockfile with lodash @ 4.17.21.
        await writeFile(join(workspaceRoot, "pnpm-lock.yaml"), buildPnpmLockfile("4.17.21"));

        const hasher1 = new InProcessTaskHasher({
            // Explicit single global input so the test is insulated from
            // DEFAULT_GLOBAL_INPUTS growing/shrinking over time.
            globalInputs: ["pnpm-lock.yaml"],
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const hash1 = computeTaskHash(await hasher1.hashTask(makeTask()));

        // Bump lodash to 4.17.22 → lockfile on disk changes → global hash must differ.
        await writeFile(join(workspaceRoot, "pnpm-lock.yaml"), buildPnpmLockfile("4.17.22"));

        const hasher2 = new InProcessTaskHasher({
            globalInputs: ["pnpm-lock.yaml"],
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const hash2 = computeTaskHash(await hasher2.hashTask(makeTask()));

        expect(hash1).not.toBe(hash2);
    });

    it("default mode — no change, stable hash", async () => {
        expect.assertions(1);

        await writeFile(join(workspaceRoot, "pnpm-lock.yaml"), buildPnpmLockfile("4.17.21"));

        const hasher1 = new InProcessTaskHasher({
            globalInputs: ["pnpm-lock.yaml"],
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const hash1 = computeTaskHash(await hasher1.hashTask(makeTask()));

        // Second hasher, lockfile untouched.
        const hasher2 = new InProcessTaskHasher({
            globalInputs: ["pnpm-lock.yaml"],
            projects: { "lib-a": { root: "packages/lib-a" } },
            workspaceRoot,
        });

        const hash2 = computeTaskHash(await hasher2.hashTask(makeTask()));

        expect(hash1).toBe(hash2);
    });

    // -----------------------------------------------------------------------
    // Smart mode (smartLockfileHashing: true)
    // -----------------------------------------------------------------------

    it("smart mode — dependency bump changes hash", async () => {
        expect.assertions(1);

        // lib-a depends on lodash; bump lodash → __lockfile__ must change.
        await writeFile(join(workspaceRoot, "pnpm-lock.yaml"), buildPnpmLockfile("4.17.21"));

        const hasher1 = new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
            workspaceRoot,
        });

        const details1 = await hasher1.hashTask(makeTask());
        const hash1 = computeTaskHash(details1);

        // Bump lodash in the lockfile.
        await writeFile(join(workspaceRoot, "pnpm-lock.yaml"), buildPnpmLockfile("4.17.22"));

        const hasher2 = new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
            workspaceRoot,
        });

        const details2 = await hasher2.hashTask(makeTask());
        const hash2 = computeTaskHash(details2);

        expect(hash1).not.toBe(hash2);
    });

    it("smart mode — unrelated bump keeps hash", async () => {
        expect.assertions(1);

        // lib-a does NOT depend on "unrelated-pkg" (see package.json in beforeEach).
        // Bumping only "unrelated-pkg" in the lockfile should leave lib-a's hash unchanged.
        await writeFile(join(workspaceRoot, "pnpm-lock.yaml"), buildPnpmLockfile("4.17.21", "2.0.0"));

        const hasher1 = new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
            workspaceRoot,
        });

        const hash1 = computeTaskHash(await hasher1.hashTask(makeTask()));

        // Bump only the unrelated package.
        await writeFile(join(workspaceRoot, "pnpm-lock.yaml"), buildPnpmLockfile("4.17.21", "2.1.0"));

        const hasher2 = new InProcessTaskHasher({
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
            workspaceRoot,
        });

        const hash2 = computeTaskHash(await hasher2.hashTask(makeTask()));

        expect(hash1).toBe(hash2);
    });
});
