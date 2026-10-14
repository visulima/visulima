import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FileAccess } from "../../src/file-access-tracker";
import { FingerprintManager, hashFingerprint } from "../../src/fingerprint";

describe(hashFingerprint, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
        await mkdir(join(workspaceRoot, "src"), { recursive: true });
        await writeFile(join(workspaceRoot, "src/index.ts"), "export const x = 1;");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("gives the same key for identical observations from the same tracker", async () => {
        expect.assertions(1);

        const manager = new FingerprintManager(workspaceRoot);
        const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/index.ts"), type: "read" }];
        const first = await manager.createFingerprint(accesses, "build", {}, {}, [], [], "strace");
        const second = await manager.createFingerprint(accesses, "build", {}, {}, [], [], "strace");

        expect(hashFingerprint(first)).toBe(hashFingerprint(second));
    });

    it("gives a different key when the tracker kind differs for the same observations", async () => {
        expect.assertions(1);

        const manager = new FingerprintManager(workspaceRoot);
        const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/index.ts"), type: "read" }];
        const strace = await manager.createFingerprint(accesses, "build", {}, {}, [], [], "strace");
        const preload = await manager.createFingerprint(accesses, "build", {}, {}, [], [], "preload");

        expect(hashFingerprint(strace)).not.toBe(hashFingerprint(preload));
    });

    it("records the tracker kind on the fingerprint", async () => {
        expect.assertions(2);

        const manager = new FingerprintManager(workspaceRoot);
        const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/index.ts"), type: "read" }];
        const tagged = await manager.createFingerprint(accesses, "build", {}, {}, [], [], "interpose");
        const untagged = await manager.createFingerprint(accesses, "build", {}, {});

        expect(tagged.tracker).toBe("interpose");
        expect(untagged).not.toHaveProperty("tracker");
    });
});

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `fp-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(FingerprintManager, () => {
    let workspaceRoot: string;
    let manager: FingerprintManager;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
        manager = new FingerprintManager(workspaceRoot);

        // Create some test files
        await mkdir(join(workspaceRoot, "src"), { recursive: true });
        await writeFile(join(workspaceRoot, "src/index.ts"), "export const x = 1;");
        await writeFile(join(workspaceRoot, "src/utils.ts"), "export const y = 2;");
        await writeFile(join(workspaceRoot, "package.json"), '{"name":"test"}');
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    describe("createFingerprint", () => {
        it("should create fingerprint from file accesses", async () => {
            expect.assertions(4);

            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src/index.ts"), type: "read" },
                { path: join(workspaceRoot, "package.json"), type: "stat" },
            ];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            expect(Object.keys(fingerprint.fileHashes)).toHaveLength(2);
            expect(fingerprint.fileHashes["src/index.ts"]).toBeDefined();
            expect(fingerprint.fileHashes["package.json"]).toBeDefined();
            expect(fingerprint.commandHash).toBeDefined();
        });

        it("should track missing files", async () => {
            expect.assertions(1);

            const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/nonexistent.ts"), type: "missing" }];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            expect(fingerprint.missingFiles).toContain("src/nonexistent.ts");
        });

        it("should track directory listings", async () => {
            expect.assertions(3);

            const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src"), type: "readdir" }];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            expect(fingerprint.directoryListings["src"]).toBeDefined();
            expect(fingerprint.directoryListings["src"]).toContain("index.ts");
            expect(fingerprint.directoryListings["src"]).toContain("utils.ts");
        });

        it("should include env var hashes with wildcard patterns", async () => {
            expect.assertions(3);

            const envVariables = {
                NODE_ENV: "development",
                VITE_API_URL: "http://localhost:3000",
                VITE_MODE: "dev",
            };

            const fingerprint = await manager.createFingerprint([], "app:build", {}, envVariables, ["VITE_*"]);

            expect(fingerprint.envHashes["VITE_API_URL"]).toBeDefined();
            expect(fingerprint.envHashes["VITE_MODE"]).toBeDefined();
            expect(fingerprint.envHashes["NODE_ENV"]).toBeUndefined();
        });

        it("should exclude untracked env vars from fingerprint", async () => {
            expect.assertions(3);

            const envVariables = {
                VITE_API_URL: "http://localhost:3000",
                VITE_MODE: "dev",
                VITE_SECRET: "should-be-excluded",
            };

            const fingerprint = await manager.createFingerprint([], "app:build", {}, envVariables, ["VITE_*"], ["VITE_SECRET"]);

            expect(fingerprint.envHashes["VITE_API_URL"]).toBeDefined();
            expect(fingerprint.envHashes["VITE_MODE"]).toBeDefined();
            expect(fingerprint.envHashes["VITE_SECRET"]).toBeUndefined();
        });

        it("should not affect fingerprint when untracked env var changes", async () => {
            expect.assertions(3);

            const envVariables1 = {
                CI_BUILD_ID: "build-1",
                VITE_API_URL: "http://localhost:3000",
            };

            const envVariables2 = {
                CI_BUILD_ID: "build-2",
                VITE_API_URL: "http://localhost:3000",
            };

            const fp1 = await manager.createFingerprint([], "app:build", {}, envVariables1, ["VITE_*", "CI_BUILD_ID"], ["CI_BUILD_ID"]);

            const fp2 = await manager.createFingerprint([], "app:build", {}, envVariables2, ["VITE_*", "CI_BUILD_ID"], ["CI_BUILD_ID"]);

            // VITE_API_URL should be the same
            expect(fp1.envHashes["VITE_API_URL"]).toBe(fp2.envHashes["VITE_API_URL"]);
            // CI_BUILD_ID should not be present in either fingerprint
            expect(fp1.envHashes["CI_BUILD_ID"]).toBeUndefined();
            expect(fp2.envHashes["CI_BUILD_ID"]).toBeUndefined();
        });

        it("should produce different command hashes for different args", async () => {
            expect.assertions(1);

            const fp1 = await manager.createFingerprint([], "app:build", { mode: "dev" }, {});

            const fp2 = await manager.createFingerprint([], "app:build", { mode: "prod" }, {});

            expect(fp1.commandHash).not.toBe(fp2.commandHash);
        });
    });

    describe("validate", () => {
        it("should return null when fingerprint is still valid", async () => {
            expect.assertions(1);

            const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/index.ts"), type: "read" }];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            const reasons = await manager.validate(fingerprint);

            expect(reasons).toBeUndefined();
        });

        it("should detect file content changes", async () => {
            expect.assertions(2);

            const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/index.ts"), type: "read" }];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            // Modify the file
            await writeFile(join(workspaceRoot, "src/index.ts"), "export const x = 42;");

            const reasons = await manager.validate(fingerprint);

            expect(reasons).toBeDefined();

            expect(reasons!.some((r) => r.type === "file-changed")).toBe(true);
        });

        it("should detect file deletions", async () => {
            expect.assertions(2);

            const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/utils.ts"), type: "read" }];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            // Delete the file
            await rm(join(workspaceRoot, "src/utils.ts"));

            const reasons = await manager.validate(fingerprint);

            expect(reasons).toBeDefined();

            expect(reasons!.some((r) => r.type === "file-deleted")).toBe(true);
        });

        it("should detect previously missing files being created", async () => {
            expect.assertions(2);

            const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src/new-module.ts"), type: "missing" }];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            // Create the file
            await writeFile(join(workspaceRoot, "src/new-module.ts"), "export const z = 3;");

            const reasons = await manager.validate(fingerprint);

            expect(reasons).toBeDefined();

            expect(reasons!.some((r) => r.type === "file-created")).toBe(true);
        });

        it("should detect directory listing changes", async () => {
            expect.assertions(2);

            const accesses: FileAccess[] = [{ path: join(workspaceRoot, "src"), type: "readdir" }];

            const fingerprint = await manager.createFingerprint(accesses, "app:build", {}, {});

            // Add a new file to the directory
            await writeFile(join(workspaceRoot, "src/newfile.ts"), "new content");

            const reasons = await manager.validate(fingerprint);

            expect(reasons).toBeDefined();

            expect(reasons!.some((r) => r.type === "directory-changed")).toBe(true);
        });
    });

    describe("validateCommand", () => {
        it("should return null when command matches", async () => {
            expect.assertions(1);

            const fingerprint = await manager.createFingerprint([], "app:build", { mode: "dev" }, {});

            const result = manager.validateCommand(fingerprint, "app:build", { mode: "dev" });

            expect(result).toBeUndefined();
        });

        it("should detect command argument changes", async () => {
            expect.assertions(2);

            const fingerprint = await manager.createFingerprint([], "app:build", { mode: "dev" }, {});

            const result = manager.validateCommand(fingerprint, "app:build", { mode: "prod" });

            expect(result).toBeDefined();

            expect(result!.type).toBe("args-changed");
        });
    });

    describe("formatMissReasons", () => {
        it("should format cache miss reasons", () => {
            expect.assertions(2);

            const output = manager.formatMissReasons([
                { detail: "src/index.ts", type: "file-changed" },
                { detail: "NODE_ENV", type: "env-changed" },
            ]);

            expect(output).toContain("File modified: src/index.ts");
            expect(output).toContain("Environment variable changed: NODE_ENV");
        });
    });

    describe("modifiedInputs", () => {
        it("populates modifiedInputs when a path is both read and written", async () => {
            expect.assertions(2);

            const { writeFile } = await import("node:fs/promises");
            const { join } = await import("node:path");
            const target = join(workspaceRoot, "round.txt");

            await writeFile(target, "content");

            const fingerprint = await manager.createFingerprint(
                [
                    { path: target, type: "read" },
                    { path: target, type: "write" },
                ],
                "app:build",
                {},
                {},
            );

            expect(fingerprint.modifiedInputs).toHaveLength(1);
            expect(fingerprint.modifiedInputs?.[0]).toBe("round.txt");
        });

        it("keys an unset env name apart from the same name set to an empty string", async () => {
            expect.assertions(2);

            const unset = await manager.createFingerprint([], "app:build", {}, {}, ["FP_TEST_UNSET"]);
            const empty = await manager.createFingerprint([], "app:build", {}, { FP_TEST_UNSET: "" }, ["FP_TEST_UNSET"]);

            expect(unset.envHashes["FP_TEST_UNSET"]).toBeDefined();
            expect(unset.envHashes["FP_TEST_UNSET"]).not.toBe(empty.envHashes["FP_TEST_UNSET"]);
        });

        it("reports an env change when a name goes from unset to empty, and reads the env it is given", async () => {
            expect.assertions(3);

            const fingerprint = await manager.createFingerprint([], "app:build", {}, { FP_TEST_VALUE: "a" }, ["FP_TEST_VALUE"]);

            // Same value in the given env: a hit, even though the parent process does not set it.
            await expect(manager.validate(fingerprint, { FP_TEST_VALUE: "a" })).resolves.toBeUndefined();

            // A different value in the given env: a miss with the env name as the detail.
            const changed = await manager.validate(fingerprint, { FP_TEST_VALUE: "b" });

            expect(changed?.[0]).toStrictEqual(expect.objectContaining({ detail: "FP_TEST_VALUE", type: "env-changed" }));

            // Unset in the given env is a different state from an empty value.
            const empty = await manager.validate(fingerprint, { FP_TEST_VALUE: undefined });

            expect(empty?.[0]).toStrictEqual(expect.objectContaining({ type: "env-changed" }));
        });

        it("omits modifiedInputs when a path was only read", async () => {
            expect.assertions(1);

            const { writeFile } = await import("node:fs/promises");
            const { join } = await import("node:path");
            const target = join(workspaceRoot, "readonly.txt");

            await writeFile(target, "data");

            const fingerprint = await manager.createFingerprint([{ path: target, type: "read" }], "app:build", {}, {});

            expect(fingerprint.modifiedInputs).toBeUndefined();
        });
    });
});
