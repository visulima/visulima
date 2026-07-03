/**
 * Benchmark: Task hash computation
 *
 * Compares:
 * - Node.js SHA-256 hash computation (Nx approach)
 * - Native Rust xxHash3 computation (our addon)
 * - Full InProcessTaskHasher pipeline
 *
 * This measures the "compute the cache key" step, which runs
 * for every task on every invocation. Fast hashing is critical
 * for large monorepos with hundreds of tasks.
 */
import { createHash } from "node:crypto";

import { afterAll, beforeAll, bench, describe } from "vitest";

import { computeTaskHash, InProcessTaskHasher } from "../src/task-hasher";
import type { TaskHashDetails } from "../src/types";
import { hashStrings } from "../src/utils";
import { cleanupFixture, createMonorepoFixture } from "./setup";

// ─── computeTaskHash: JS vs Native ─────────────────────────────────

const makeHashDetails = (nodeCount: number): TaskHashDetails => {
    const nodes: Record<string, string> = {};

    for (let i = 0; i < nodeCount; i++) {
        nodes[`packages/pkg/src/file-${i}.ts`] = createHash("sha256").update(`content-${i}`).digest("hex");
    }

    return {
        command: createHash("sha256").update("build:production").digest("hex"),
        implicitDeps: {
            __global__: createHash("sha256").update("global").digest("hex"),
            __lockfile__: createHash("sha256").update("lockfile").digest("hex"),
        },
        nodes,
        runtime: {
            "env:CI": hashStrings("CI", "true"),
            "env:NODE_ENV": hashStrings("NODE_ENV", "production"),
        },
    };
};

describe("computeTaskHash - 50 file nodes", () => {
    const details = makeHashDetails(50);

    bench("JS SHA-256 (Nx-style)", () => {
        const hash = createHash("sha256");

        hash.update(details.command);

        for (const key of Object.keys(details.nodes).sort()) {
            hash.update(key);
            hash.update(details.nodes[key] as string);
        }

        if (details.implicitDeps) {
            for (const key of Object.keys(details.implicitDeps).sort()) {
                hash.update(key);
                hash.update(details.implicitDeps[key] as string);
            }
        }

        if (details.runtime) {
            for (const key of Object.keys(details.runtime).sort()) {
                hash.update(key);
                hash.update(details.runtime[key] as string);
            }
        }

        hash.digest("hex");
    });

    bench("computeTaskHash (auto-selects native or JS)", () => {
        computeTaskHash(details);
    });
});

describe("computeTaskHash - 500 file nodes", () => {
    const details = makeHashDetails(500);

    bench("JS SHA-256 (Nx-style)", () => {
        const hash = createHash("sha256");

        hash.update(details.command);

        for (const key of Object.keys(details.nodes).sort()) {
            hash.update(key);
            hash.update(details.nodes[key] as string);
        }

        if (details.implicitDeps) {
            for (const key of Object.keys(details.implicitDeps).sort()) {
                hash.update(key);
                hash.update(details.implicitDeps[key] as string);
            }
        }

        hash.digest("hex");
    });

    bench("computeTaskHash (auto-selects native or JS)", () => {
        computeTaskHash(details);
    });
});

describe("computeTaskHash - 2000 file nodes", () => {
    const details = makeHashDetails(2000);

    bench("JS SHA-256 (Nx-style)", () => {
        const hash = createHash("sha256");

        hash.update(details.command);

        for (const key of Object.keys(details.nodes).sort()) {
            hash.update(key);
            hash.update(details.nodes[key] as string);
        }

        hash.digest("hex");
    });

    bench("computeTaskHash (auto-selects native or JS)", () => {
        computeTaskHash(details);
    });
});

// ─── Full task hasher pipeline ──────────────────────────────────────

describe("InProcessTaskHasher - 10 packages × 50 files", () => {
    let fixtureDir: string;

    beforeAll(() => {
        fixtureDir = createMonorepoFixture(10, 50, 1024);
    });

    afterAll(() => {
        cleanupFixture(fixtureDir);
    });

    bench("hash single task (cold)", async () => {
        const projects: Record<string, { root: string; targets?: Record<string, { command?: string }> }> = {};

        for (let i = 0; i < 10; i++) {
            projects[`pkg-${i}`] = {
                root: `packages/pkg-${i}`,
                targets: { build: { command: "tsc -b" } },
            };
        }

        const hasher = new InProcessTaskHasher({
            projects,
            workspaceRoot: fixtureDir,
        });

        await hasher.hashTask({
            id: "pkg-5:build",
            outputs: ["packages/pkg-5/dist"],
            overrides: {},
            projectRoot: "packages/pkg-5",
            target: { project: "pkg-5", target: "build" },
        });
    });

    bench("hash all 10 tasks (sequential)", async () => {
        const projects: Record<string, { root: string; targets?: Record<string, { command?: string }> }> = {};

        for (let i = 0; i < 10; i++) {
            projects[`pkg-${i}`] = {
                root: `packages/pkg-${i}`,
                targets: { build: { command: "tsc -b" } },
            };
        }

        const hasher = new InProcessTaskHasher({
            projects,
            workspaceRoot: fixtureDir,
        });

        for (let i = 0; i < 10; i++) {
            // eslint-disable-next-line no-await-in-loop
            await hasher.hashTask({
                id: `pkg-${i}:build`,
                outputs: [`packages/pkg-${i}/dist`],
                overrides: {},
                projectRoot: `packages/pkg-${i}`,
                target: { project: `pkg-${i}`, target: "build" },
            });
        }
    });
});
