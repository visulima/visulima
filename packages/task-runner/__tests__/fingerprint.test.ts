import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { FingerprintManager } from "../src/fingerprint";
import type { FileAccess } from "../src/file-access-tracker";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `fp-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

describe("FingerprintManager", () => {
    let workspaceRoot: string;
    let manager: FingerprintManager;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();
        manager = new FingerprintManager(workspaceRoot);

        // Create some test files
        await mkdir(join(workspaceRoot, "src"), { recursive: true });
        await writeFile(join(workspaceRoot, "src/index.ts"), "export const x = 1;");
        await writeFile(join(workspaceRoot, "src/utils.ts"), "export const y = 2;");
        await writeFile(join(workspaceRoot, "package.json"), '{"name":"test"}');
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    describe("createFingerprint", () => {
        it("should create fingerprint from file accesses", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src/index.ts"), type: "read" },
                { path: join(workspaceRoot, "package.json"), type: "stat" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            expect(Object.keys(fingerprint.fileHashes)).toHaveLength(2);
            expect(fingerprint.fileHashes["src/index.ts"]).toBeDefined();
            expect(fingerprint.fileHashes["package.json"]).toBeDefined();
            expect(fingerprint.commandHash).toBeDefined();
        });

        it("should track missing files", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src/nonexistent.ts"), type: "missing" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            expect(fingerprint.missingFiles).toContain("src/nonexistent.ts");
        });

        it("should track directory listings", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src"), type: "readdir" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            expect(fingerprint.directoryListings["src"]).toBeDefined();
            expect(fingerprint.directoryListings["src"]).toContain("index.ts");
            expect(fingerprint.directoryListings["src"]).toContain("utils.ts");
        });

        it("should include env var hashes with wildcard patterns", async () => {
            const envVars = {
                VITE_API_URL: "http://localhost:3000",
                VITE_MODE: "dev",
                NODE_ENV: "development",
            };

            const fingerprint = await manager.createFingerprint(
                [],
                "app:build",
                {},
                envVars,
                ["VITE_*"],
            );

            expect(fingerprint.envHashes["VITE_API_URL"]).toBeDefined();
            expect(fingerprint.envHashes["VITE_MODE"]).toBeDefined();
            expect(fingerprint.envHashes["NODE_ENV"]).toBeUndefined();
        });

        it("should exclude untracked env vars from fingerprint", async () => {
            const envVars = {
                VITE_API_URL: "http://localhost:3000",
                VITE_SECRET: "should-be-excluded",
                VITE_MODE: "dev",
            };

            const fingerprint = await manager.createFingerprint(
                [],
                "app:build",
                {},
                envVars,
                ["VITE_*"],
                ["VITE_SECRET"],
            );

            expect(fingerprint.envHashes["VITE_API_URL"]).toBeDefined();
            expect(fingerprint.envHashes["VITE_MODE"]).toBeDefined();
            expect(fingerprint.envHashes["VITE_SECRET"]).toBeUndefined();
        });

        it("should not affect fingerprint when untracked env var changes", async () => {
            const envVars1 = {
                VITE_API_URL: "http://localhost:3000",
                CI_BUILD_ID: "build-1",
            };

            const envVars2 = {
                VITE_API_URL: "http://localhost:3000",
                CI_BUILD_ID: "build-2",
            };

            const fp1 = await manager.createFingerprint(
                [],
                "app:build",
                {},
                envVars1,
                ["VITE_*", "CI_BUILD_ID"],
                ["CI_BUILD_ID"],
            );

            const fp2 = await manager.createFingerprint(
                [],
                "app:build",
                {},
                envVars2,
                ["VITE_*", "CI_BUILD_ID"],
                ["CI_BUILD_ID"],
            );

            // VITE_API_URL should be the same
            expect(fp1.envHashes["VITE_API_URL"]).toBe(fp2.envHashes["VITE_API_URL"]);
            // CI_BUILD_ID should not be present in either fingerprint
            expect(fp1.envHashes["CI_BUILD_ID"]).toBeUndefined();
            expect(fp2.envHashes["CI_BUILD_ID"]).toBeUndefined();
        });

        it("should produce different command hashes for different args", async () => {
            const fp1 = await manager.createFingerprint(
                [],
                "app:build",
                { mode: "dev" },
                {},
            );

            const fp2 = await manager.createFingerprint(
                [],
                "app:build",
                { mode: "prod" },
                {},
            );

            expect(fp1.commandHash).not.toBe(fp2.commandHash);
        });
    });

    describe("validate", () => {
        it("should return null when fingerprint is still valid", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src/index.ts"), type: "read" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            const reasons = await manager.validate(fingerprint);

            expect(reasons).toBeNull();
        });

        it("should detect file content changes", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src/index.ts"), type: "read" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            // Modify the file
            await writeFile(join(workspaceRoot, "src/index.ts"), "export const x = 42;");

            const reasons = await manager.validate(fingerprint);

            expect(reasons).not.toBeNull();
            expect(reasons!.some((r) => r.type === "file-changed")).toBe(true);
        });

        it("should detect file deletions", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src/utils.ts"), type: "read" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            // Delete the file
            await rm(join(workspaceRoot, "src/utils.ts"));

            const reasons = await manager.validate(fingerprint);

            expect(reasons).not.toBeNull();
            expect(reasons!.some((r) => r.type === "file-deleted")).toBe(true);
        });

        it("should detect previously missing files being created", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src/new-module.ts"), type: "missing" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            // Create the file
            await writeFile(join(workspaceRoot, "src/new-module.ts"), "export const z = 3;");

            const reasons = await manager.validate(fingerprint);

            expect(reasons).not.toBeNull();
            expect(reasons!.some((r) => r.type === "file-created")).toBe(true);
        });

        it("should detect directory listing changes", async () => {
            const accesses: FileAccess[] = [
                { path: join(workspaceRoot, "src"), type: "readdir" },
            ];

            const fingerprint = await manager.createFingerprint(
                accesses,
                "app:build",
                {},
                {},
            );

            // Add a new file to the directory
            await writeFile(join(workspaceRoot, "src/newfile.ts"), "new content");

            const reasons = await manager.validate(fingerprint);

            expect(reasons).not.toBeNull();
            expect(reasons!.some((r) => r.type === "directory-changed")).toBe(true);
        });
    });

    describe("validateCommand", () => {
        it("should return null when command matches", async () => {
            const fingerprint = await manager.createFingerprint(
                [],
                "app:build",
                { mode: "dev" },
                {},
            );

            const result = manager.validateCommand(fingerprint, "app:build", { mode: "dev" });

            expect(result).toBeNull();
        });

        it("should detect command argument changes", async () => {
            const fingerprint = await manager.createFingerprint(
                [],
                "app:build",
                { mode: "dev" },
                {},
            );

            const result = manager.validateCommand(fingerprint, "app:build", { mode: "prod" });

            expect(result).not.toBeNull();
            expect(result!.type).toBe("args-changed");
        });
    });

    describe("formatMissReasons", () => {
        it("should format cache miss reasons", () => {
            const output = manager.formatMissReasons([
                { type: "file-changed", detail: "src/index.ts" },
                { type: "env-changed", detail: "NODE_ENV" },
            ]);

            expect(output).toContain("File modified: src/index.ts");
            expect(output).toContain("Environment variable changed: NODE_ENV");
        });
    });
});
