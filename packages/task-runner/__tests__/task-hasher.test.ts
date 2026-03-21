import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { InProcessTaskHasher, computeTaskHash } from "../src/task-hasher";
import type { Task, TaskHashDetails } from "../src/types";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `hasher-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

describe("InProcessTaskHasher", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();

        // Create test project structure
        await mkdir(join(workspaceRoot, "packages/lib-a/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/lib-a/src/index.ts"), "export const a = 1;");
        await writeFile(join(workspaceRoot, "packages/lib-a/package.json"), '{"name":"lib-a"}');
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });

        // Clean up env vars that tests may set
        delete process.env["TEST_VAR_HASHER"];
        delete process.env["NEXT_PUBLIC_API_URL"];
        delete process.env["NEXT_PUBLIC_TEST"];
    });

    it("should hash a task with default inputs (all project files)", async () => {
        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: {
                "lib-a": { root: "packages/lib-a" },
            },
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const details = await hasher.hashTask(task);

        expect(details.command).toBeDefined();
        expect(Object.keys(details.nodes).length).toBeGreaterThan(0);
    });

    it("should produce different hashes for different file contents", async () => {
        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: {
                "lib-a": { root: "packages/lib-a" },
            },
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const hash1 = await hasher.hashTask(task);

        // Modify a file
        await writeFile(join(workspaceRoot, "packages/lib-a/src/index.ts"), "export const a = 42;");

        // Clear cache and rehash
        hasher.clearCache();

        const hash2 = await hasher.hashTask(task);

        expect(hash1.nodes).not.toEqual(hash2.nodes);
    });

    it("should produce different command hashes for different overrides", async () => {
        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: {
                "lib-a": { root: "packages/lib-a" },
            },
        });

        const task1: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: { mode: "dev" },
            outputs: [],
        };

        const task2: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: { mode: "prod" },
            outputs: [],
        };

        const details1 = await hasher.hashTask(task1);
        const details2 = await hasher.hashTask(task2);

        expect(details1.command).not.toBe(details2.command);
    });

    it("should include environment variables in hash", async () => {
        process.env["TEST_VAR_HASHER"] = "value1";

        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: { "lib-a": { root: "packages/lib-a" } },
            envVars: ["TEST_VAR_HASHER"],
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const details = await hasher.hashTask(task);

        expect(details.runtime).toBeDefined();
        expect(details.runtime!["env:TEST_VAR_HASHER"]).toBeDefined();

        delete process.env["TEST_VAR_HASHER"];
    });

    it("should use smart lockfile hashing when enabled", async () => {
        // Create a lockfile
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: {
                    "node_modules/lodash": { version: "4.17.21" },
                    "node_modules/express": { version: "4.18.2" },
                },
            }),
        );

        // lib-a depends on lodash only
        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                name: "lib-a",
                dependencies: { lodash: "^4.17.0" },
            }),
        );

        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const details = await hasher.hashTask(task);

        // Should have a __lockfile__ implicit dep
        expect(details.implicitDeps).toBeDefined();
        expect(details.implicitDeps!["__lockfile__"]).toBeDefined();
    });

    it("should produce different lockfile hashes for different resolved versions", async () => {
        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                name: "lib-a",
                dependencies: { lodash: "^4.17.0" },
            }),
        );

        // First lockfile
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: { "node_modules/lodash": { version: "4.17.21" } },
            }),
        );

        const hasher1 = new InProcessTaskHasher({
            workspaceRoot,
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const details1 = await hasher1.hashTask(task);

        // Update lockfile with different version
        await writeFile(
            join(workspaceRoot, "package-lock.json"),
            JSON.stringify({
                lockfileVersion: 3,
                packages: { "node_modules/lodash": { version: "4.17.20" } },
            }),
        );

        const hasher2 = new InProcessTaskHasher({
            workspaceRoot,
            projects: { "lib-a": { root: "packages/lib-a" } },
            smartLockfileHashing: true,
        });

        const details2 = await hasher2.hashTask(task);

        expect(details1.implicitDeps!["__lockfile__"]).not.toBe(details2.implicitDeps!["__lockfile__"]);
    });

    it("should include framework env vars in hash when frameworkInference is enabled", async () => {
        // Make lib-a a Next.js project
        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                name: "lib-a",
                dependencies: { next: "14.0.0", react: "18.2.0" },
            }),
        );

        process.env["NEXT_PUBLIC_API_URL"] = "https://api.example.com";

        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: { "lib-a": { root: "packages/lib-a" } },
            frameworkInference: true,
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const details = await hasher.hashTask(task);

        expect(details.runtime).toBeDefined();
        expect(details.runtime!["framework-env:NEXT_PUBLIC_API_URL"]).toBeDefined();

        delete process.env["NEXT_PUBLIC_API_URL"];
    });

    it("should not include framework env vars when frameworkInference is disabled", async () => {
        await writeFile(
            join(workspaceRoot, "packages/lib-a/package.json"),
            JSON.stringify({
                name: "lib-a",
                dependencies: { next: "14.0.0" },
            }),
        );

        process.env["NEXT_PUBLIC_TEST"] = "value";

        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: { "lib-a": { root: "packages/lib-a" } },
            frameworkInference: false,
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const details = await hasher.hashTask(task);

        const frameworkKeys = Object.keys(details.runtime ?? {}).filter((k) => k.startsWith("framework-env:"));

        expect(frameworkKeys).toHaveLength(0);

        delete process.env["NEXT_PUBLIC_TEST"];
    });

    it("should use named inputs when configured", async () => {
        const hasher = new InProcessTaskHasher({
            workspaceRoot,
            projects: {
                "lib-a": {
                    root: "packages/lib-a",
                    targets: {
                        build: {
                            inputs: ["production"],
                        },
                    },
                },
            },
            namedInputs: {
                production: ["{projectRoot}/src/**/*"],
            },
        });

        const task: Task = {
            id: "lib-a:build",
            target: { project: "lib-a", target: "build" },
            overrides: {},
            outputs: [],
        };

        const details = await hasher.hashTask(task);

        // Should only include src files, not package.json
        const paths = Object.keys(details.nodes);

        expect(paths.some((p) => p.includes("src/index.ts"))).toBe(true);
        expect(paths.some((p) => p === "packages/lib-a/package.json")).toBe(false);
    });
});

describe("computeTaskHash", () => {
    it("should produce deterministic hash", () => {
        const details: TaskHashDetails = {
            command: "abc",
            nodes: { "file1": "hash1", "file2": "hash2" },
        };

        const hash1 = computeTaskHash(details);
        const hash2 = computeTaskHash(details);

        expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
        const details1: TaskHashDetails = {
            command: "abc",
            nodes: { "file1": "hash1" },
        };

        const details2: TaskHashDetails = {
            command: "abc",
            nodes: { "file1": "hash2" },
        };

        expect(computeTaskHash(details1)).not.toBe(computeTaskHash(details2));
    });

    it("should be order-independent for nodes", () => {
        const details1: TaskHashDetails = {
            command: "abc",
            nodes: { "a": "1", "b": "2" },
        };

        const details2: TaskHashDetails = {
            command: "abc",
            nodes: { "b": "2", "a": "1" },
        };

        expect(computeTaskHash(details1)).toBe(computeTaskHash(details2));
    });
});
