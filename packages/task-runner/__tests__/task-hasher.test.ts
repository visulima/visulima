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
