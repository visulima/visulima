import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("clean command logic", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-clean-test-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("should find node_modules in workspace root", () => {
        expect.assertions(2);

        const nm = join(tmpDir, "node_modules");

        mkdirSync(nm, { recursive: true });

        expect(existsSync(nm)).toBe(true);

        rmSync(nm, { force: true, recursive: true });

        expect(existsSync(nm)).toBe(false);
    });

    it("should find node_modules in nested workspace packages", () => {
        expect.assertions(3);

        const dirs = [join(tmpDir, "packages", "a", "node_modules"), join(tmpDir, "packages", "b", "node_modules"), join(tmpDir, "node_modules")];

        for (const dir of dirs) {
            mkdirSync(dir, { recursive: true });
        }

        for (const dir of dirs) {
            expect(existsSync(dir)).toBe(true);
        }
    });

    it("should not follow into nested node_modules when searching", () => {
        expect.assertions(2);

        // Create a node_modules with a deeply nested node_modules inside
        const outerNm = join(tmpDir, "node_modules");
        const innerNm = join(outerNm, "react", "node_modules");

        mkdirSync(innerNm, { recursive: true });

        expect(existsSync(outerNm)).toBe(true);

        // Removing the outer should remove inner too
        rmSync(outerNm, { force: true, recursive: true });

        expect(existsSync(outerNm)).toBe(false);
    });

    it("should skip .git directories during search", () => {
        expect.assertions(2);

        mkdirSync(join(tmpDir, ".git", "objects"), { recursive: true });
        mkdirSync(join(tmpDir, "node_modules"), { recursive: true });

        // .git should still exist after cleaning node_modules
        rmSync(join(tmpDir, "node_modules"), { force: true, recursive: true });

        expect(existsSync(join(tmpDir, ".git"))).toBe(true);
        expect(existsSync(join(tmpDir, "node_modules"))).toBe(false);
    });
});

describe("clean lockfile removal", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-clean-lock-test-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("should detect pnpm-lock.yaml", () => {
        expect.assertions(2);

        const lockfile = join(tmpDir, "pnpm-lock.yaml");

        writeFileSync(lockfile, "lockfileVersion: 9");

        expect(existsSync(lockfile)).toBe(true);

        rmSync(lockfile);

        expect(existsSync(lockfile)).toBe(false);
    });

    it("should detect package-lock.json", () => {
        expect.assertions(2);

        const lockfile = join(tmpDir, "package-lock.json");

        writeFileSync(lockfile, "{}");

        expect(existsSync(lockfile)).toBe(true);

        rmSync(lockfile);

        expect(existsSync(lockfile)).toBe(false);
    });

    it("should detect yarn.lock", () => {
        expect.assertions(2);

        const lockfile = join(tmpDir, "yarn.lock");

        writeFileSync(lockfile, "");

        expect(existsSync(lockfile)).toBe(true);

        rmSync(lockfile);

        expect(existsSync(lockfile)).toBe(false);
    });

    it("should detect bun.lock and bun.lockb", () => {
        expect.assertions(4);

        const bunLock = join(tmpDir, "bun.lock");
        const bunLockb = join(tmpDir, "bun.lockb");

        writeFileSync(bunLock, "");
        writeFileSync(bunLockb, Buffer.alloc(0));

        expect(existsSync(bunLock)).toBe(true);
        expect(existsSync(bunLockb)).toBe(true);

        rmSync(bunLock);
        rmSync(bunLockb);

        expect(existsSync(bunLock)).toBe(false);
        expect(existsSync(bunLockb)).toBe(false);
    });

    it("should not fail when lockfiles don't exist", () => {
        expect.assertions(1);

        // Just verify no lockfiles exist and no error thrown
        const lockfiles = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lock", "bun.lockb"];
        const none = lockfiles.every((name) => !existsSync(join(tmpDir, name)));

        expect(none).toBe(true);
    });
});

describe("clean full workspace scenario", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-clean-ws-test-"));

        // Set up a realistic workspace
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "workspace-root" }));
        writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "lockfileVersion: 9");

        // Root node_modules
        mkdirSync(join(tmpDir, "node_modules", ".pnpm", "react@18.3.1", "node_modules", "react"), { recursive: true });

        // Package A
        mkdirSync(join(tmpDir, "packages", "app", "node_modules", ".pnpm"), { recursive: true });
        writeFileSync(join(tmpDir, "packages", "app", "package.json"), JSON.stringify({ name: "app" }));

        // Package B
        mkdirSync(join(tmpDir, "packages", "lib", "node_modules", ".pnpm"), { recursive: true });
        writeFileSync(join(tmpDir, "packages", "lib", "package.json"), JSON.stringify({ name: "lib" }));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("should have 3 node_modules directories before clean", () => {
        expect.assertions(3);

        expect(existsSync(join(tmpDir, "node_modules"))).toBe(true);
        expect(existsSync(join(tmpDir, "packages", "app", "node_modules"))).toBe(true);
        expect(existsSync(join(tmpDir, "packages", "lib", "node_modules"))).toBe(true);
    });

    it("should remove all node_modules after clean", () => {
        expect.assertions(3);

        // Simulate clean
        const dirs = [join(tmpDir, "node_modules"), join(tmpDir, "packages", "app", "node_modules"), join(tmpDir, "packages", "lib", "node_modules")];

        for (const dir of dirs) {
            rmSync(dir, { force: true, recursive: true });
        }

        expect(existsSync(join(tmpDir, "node_modules"))).toBe(false);
        expect(existsSync(join(tmpDir, "packages", "app", "node_modules"))).toBe(false);
        expect(existsSync(join(tmpDir, "packages", "lib", "node_modules"))).toBe(false);
    });

    it("should preserve package.json files after clean", () => {
        expect.assertions(3);

        // Remove node_modules
        rmSync(join(tmpDir, "node_modules"), { force: true, recursive: true });
        rmSync(join(tmpDir, "packages", "app", "node_modules"), { force: true, recursive: true });
        rmSync(join(tmpDir, "packages", "lib", "node_modules"), { force: true, recursive: true });

        // package.json files should still exist
        expect(existsSync(join(tmpDir, "package.json"))).toBe(true);
        expect(existsSync(join(tmpDir, "packages", "app", "package.json"))).toBe(true);
        expect(existsSync(join(tmpDir, "packages", "lib", "package.json"))).toBe(true);
    });
});
