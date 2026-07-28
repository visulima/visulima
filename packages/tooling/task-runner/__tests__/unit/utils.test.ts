import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { xxh3Hash } from "@shared/xxh3";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectFiles, createFailureResult, hashFile, hashStrings, isInsideWorkspace, readPackageDeps, resolveTaskCwd, sortObjectKeys } from "../../src/utils";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `task-runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(hashFile, () => {
    let temporaryDirectory: string;

    beforeEach(async () => {
        temporaryDirectory = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(temporaryDirectory, { force: true, recursive: true });
    });

    it("should return the xxh3-128 hash of a file's content", async () => {
        expect.assertions(1);

        const filePath = join(temporaryDirectory, "test.txt");
        const content = "hello world";

        await writeFile(filePath, content);

        const expected = xxh3Hash(Buffer.from(content));
        const result = await hashFile(filePath);

        expect(result).toBe(expected);
    });

    it("should return undefined for a non-existent file", async () => {
        expect.assertions(1);

        const result = await hashFile(join(temporaryDirectory, "nonexistent.txt"));

        expect(result).toBeUndefined();
    });

    it("should handle empty files", async () => {
        expect.assertions(1);

        const filePath = join(temporaryDirectory, "empty.txt");

        await writeFile(filePath, "");

        const expected = xxh3Hash(Buffer.from(""));
        const result = await hashFile(filePath);

        expect(result).toBe(expected);
    });
});

describe(hashStrings, () => {
    it("should hash a single string deterministically", () => {
        expect.assertions(2);

        const result = hashStrings("hello");

        // Should be a 32-char hex string (xxh3-128)
        expect(result).toMatch(/^[\da-f]{32}$/);
        // Should be deterministic
        expect(hashStrings("hello")).toBe(result);
    });

    it("should hash multiple strings deterministically", () => {
        expect.assertions(2);

        const result = hashStrings("hello", "world");

        expect(result).toMatch(/^[\da-f]{32}$/);
        expect(hashStrings("hello", "world")).toBe(result);
    });

    it("should produce different hashes for different inputs", () => {
        expect.assertions(1);

        expect(hashStrings("a", "b")).not.toBe(hashStrings("b", "a"));
    });
});

describe(sortObjectKeys, () => {
    it("should sort top-level keys alphabetically", () => {
        expect.assertions(1);

        const result = sortObjectKeys({ a: 1, b: 2, c: 3 });

        expect(Object.keys(result)).toStrictEqual(["a", "b", "c"]);
    });

    it("should recursively sort nested object keys", () => {
        expect.assertions(2);

        const result = sortObjectKeys({ a: 1, b: { a: 2, z: 1 } });

        expect(Object.keys(result)).toStrictEqual(["a", "b"]);
        expect(Object.keys(result["b"] as Record<string, unknown>)).toStrictEqual(["a", "z"]);
    });

    it("should preserve arrays without sorting them", () => {
        expect.assertions(1);

        const result = sortObjectKeys({ arr: [3, 1, 2] });

        expect(result["arr"]).toStrictEqual([3, 1, 2]);
    });

    it("should handle null and undefined values", () => {
        expect.assertions(1);

        const result = sortObjectKeys({ a: undefined, b: null });

        expect(result).toStrictEqual({ a: undefined, b: null });
    });
});

describe(collectFiles, () => {
    let temporaryDirectory: string;

    beforeEach(async () => {
        temporaryDirectory = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(temporaryDirectory, { force: true, recursive: true });
    });

    it("should collect all files in a flat directory", async () => {
        expect.assertions(1);

        await writeFile(join(temporaryDirectory, "a.txt"), "a");
        await writeFile(join(temporaryDirectory, "b.txt"), "b");

        const result = await collectFiles(temporaryDirectory, new Set());

        expect(result.sort()).toStrictEqual([join(temporaryDirectory, "a.txt"), join(temporaryDirectory, "b.txt")]);
    });

    it("should collect files recursively", async () => {
        expect.assertions(1);

        const subDirectory = join(temporaryDirectory, "sub");

        await mkdir(subDirectory);
        await writeFile(join(temporaryDirectory, "root.txt"), "r");
        await writeFile(join(subDirectory, "nested.txt"), "n");

        const result = await collectFiles(temporaryDirectory, new Set());

        expect(result.sort()).toStrictEqual([join(temporaryDirectory, "root.txt"), join(subDirectory, "nested.txt")].sort());
    });

    it("should skip ignored directories", async () => {
        expect.assertions(1);

        const nodeModules = join(temporaryDirectory, "node_modules");

        await mkdir(nodeModules);
        await writeFile(join(nodeModules, "pkg.json"), "{}");
        await writeFile(join(temporaryDirectory, "src.ts"), "x");

        const result = await collectFiles(temporaryDirectory, new Set(["node_modules"]));

        expect(result).toStrictEqual([join(temporaryDirectory, "src.ts")]);
    });

    it("should return a single file if path points to a file", async () => {
        expect.assertions(1);

        const filePath = join(temporaryDirectory, "single.txt");

        await writeFile(filePath, "data");

        const result = await collectFiles(filePath, new Set());

        expect(result).toStrictEqual([filePath]);
    });

    it("should return empty array for non-existent directory", async () => {
        expect.assertions(1);

        const result = await collectFiles(join(temporaryDirectory, "nope"), new Set());

        expect(result).toStrictEqual([]);
    });

    it("should follow symlinks to files", async () => {
        expect.assertions(1);

        const realFile = join(temporaryDirectory, "real.txt");
        const linkFile = join(temporaryDirectory, "link.txt");

        await writeFile(realFile, "data");
        await symlink(realFile, linkFile);

        const result = await collectFiles(temporaryDirectory, new Set());

        expect(result.sort()).toStrictEqual([linkFile, realFile].sort());
    });
});

describe(resolveTaskCwd, () => {
    it("should return workspace root when task has no projectRoot", () => {
        expect.assertions(1);

        const task = {
            id: "test:build",
            outputs: [],
            overrides: {},
            target: { project: "test", target: "build" },
        };

        expect(resolveTaskCwd("/workspace", task)).toBe("/workspace");
    });

    it("should join workspace root and projectRoot", () => {
        expect.assertions(1);

        const task = {
            id: "test:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/test",
            target: { project: "test", target: "build" },
        };

        expect(resolveTaskCwd("/workspace", task)).toBe("/workspace/packages/test");
    });
});

describe(isInsideWorkspace, () => {
    it("accepts paths strictly inside the workspace", () => {
        expect.assertions(2);

        expect(isInsideWorkspace("/repo", "/repo/src/index.ts")).toBe(true);
        expect(isInsideWorkspace("/repo", "/repo/packages/a/dist/out.js")).toBe(true);
    });

    it("rejects a sibling directory sharing the workspace name as a string prefix", () => {
        expect.assertions(3);

        // The bug this replaces: `"/repo-cache/...".startsWith("/repo")` was
        // true, leaking sibling trees into the tracked access set.
        expect(isInsideWorkspace("/repo", "/repo-cache/file.ts")).toBe(false);
        expect(isInsideWorkspace("/repo", "/repo-backup/file.ts")).toBe(false);
        expect(isInsideWorkspace("/proj", "/proj.worktrees/x/file.ts")).toBe(false);
    });

    it("rejects the workspace root itself and outside paths", () => {
        expect.assertions(2);

        expect(isInsideWorkspace("/repo", "/repo")).toBe(false);
        expect(isInsideWorkspace("/repo", "/etc/hosts")).toBe(false);
    });
});

describe(createFailureResult, () => {
    it("should create a failure result from an Error", () => {
        expect.assertions(6);

        const task = {
            id: "test:build",
            outputs: [],
            overrides: {},
            target: { project: "test", target: "build" },
        };
        const startTime = Date.now() - 1000;
        const result = createFailureResult(task, new Error("Something failed"), startTime);

        expect(result.status).toBe("failure");
        expect(result.code).toBe(1);
        expect(result.task).toBe(task);
        expect(result.terminalOutput).toBe("Something failed");
        expect(result.startTime).toBe(startTime);
        expect(result.endTime).toBeGreaterThanOrEqual(startTime);
    });

    it("should create a failure result from a non-Error value", () => {
        expect.assertions(1);

        const task = {
            id: "test:build",
            outputs: [],
            overrides: {},
            target: { project: "test", target: "build" },
        };
        const result = createFailureResult(task, "string error", Date.now());

        expect(result.terminalOutput).toBe("string error");
    });
});

describe(readPackageDeps, () => {
    let temporaryDirectory: string;

    beforeEach(async () => {
        temporaryDirectory = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(temporaryDirectory, { force: true, recursive: true });
    });

    it("should read all dependency types by default", async () => {
        expect.assertions(2);

        const packageJsonPath = join(temporaryDirectory, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { lodash: "^4.0.0" },
                devDependencies: { vitest: "^1.0.0" },
                optionalDependencies: { fsevents: "^2.0.0" },
                peerDependencies: { react: "^18.0.0" },
            }),
        );

        const result = await readPackageDeps(packageJsonPath);

        expect(result).toBeDefined();
        expect(result).toStrictEqual(new Set(["fsevents", "lodash", "react", "vitest"]));
    });

    it("should exclude peer dependencies when peer is false", async () => {
        expect.assertions(3);

        const packageJsonPath = join(temporaryDirectory, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { lodash: "^4.0.0" },
                peerDependencies: { react: "^18.0.0" },
            }),
        );

        const result = await readPackageDeps(packageJsonPath, { peer: false });

        expect(result).toBeDefined();
        expect(result!.has("lodash")).toBe(true);
        expect(result!.has("react")).toBe(false);
    });

    it("should exclude optional dependencies when optional is false", async () => {
        expect.assertions(3);

        const packageJsonPath = join(temporaryDirectory, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { lodash: "^4.0.0" },
                optionalDependencies: { fsevents: "^2.0.0" },
            }),
        );

        const result = await readPackageDeps(packageJsonPath, { optional: false });

        expect(result).toBeDefined();
        expect(result!.has("lodash")).toBe(true);
        expect(result!.has("fsevents")).toBe(false);
    });

    it("should return undefined for non-existent file", async () => {
        expect.assertions(1);

        const result = await readPackageDeps(join(temporaryDirectory, "nonexistent.json"));

        expect(result).toBeUndefined();
    });

    it("should handle package.json with no dependencies", async () => {
        expect.assertions(2);

        const packageJsonPath = join(temporaryDirectory, "package.json");

        await writeFile(packageJsonPath, JSON.stringify({ name: "empty-pkg" }));

        const result = await readPackageDeps(packageJsonPath);

        expect(result).toBeDefined();
        expect(result!.size).toBe(0);
    });
});
