import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canSafelyOverwrite, isEmptyDir, isValidPackageName, resolveTargetDir, toValidPackageName } from "../../../src/commands/create/utils";

describe(isValidPackageName, () => {
    it("should accept valid names", () => {
        expect.assertions(4);

        expect(isValidPackageName("my-package")).toBe(true);
        expect(isValidPackageName("package123")).toBe(true);
        expect(isValidPackageName("my.package")).toBe(true);
        expect(isValidPackageName("my_package")).toBe(true);
    });

    it("should accept scoped names", () => {
        expect.assertions(1);

        expect(isValidPackageName("@scope/my-package")).toBe(true);
    });

    it("should reject empty names", () => {
        expect.assertions(1);

        expect(isValidPackageName("")).toBe(false);
    });

    it("should reject names with uppercase", () => {
        expect.assertions(1);

        expect(isValidPackageName("MyPackage")).toBe(false);
    });

    it("should reject names starting with dot or underscore", () => {
        expect.assertions(2);

        expect(isValidPackageName(".hidden")).toBe(false);
        expect(isValidPackageName("_private")).toBe(false);
    });

    it("should reject incomplete scoped names", () => {
        expect.assertions(2);

        expect(isValidPackageName("@scope/")).toBe(false);
        expect(isValidPackageName("@scope")).toBe(false);
    });

    it("should reject names that conflict with Node.js core modules", () => {
        expect.assertions(2);

        expect(isValidPackageName("http")).toBe(false);
        expect(isValidPackageName("node_modules")).toBe(false);
    });

    it("should reject names with special characters", () => {
        expect.assertions(2);

        expect(isValidPackageName("my package")).toBe(false);
        expect(isValidPackageName("excited!")).toBe(false);
    });

    it("should reject names longer than 214 characters", () => {
        expect.assertions(1);

        expect(isValidPackageName("a".repeat(215))).toBe(false);
    });
});

describe(toValidPackageName, () => {
    it("should lowercase the name", () => {
        expect.assertions(1);

        expect(toValidPackageName("MyProject")).toBe("myproject");
    });

    it("should replace spaces with hyphens", () => {
        expect.assertions(1);

        expect(toValidPackageName("my project")).toBe("my-project");
    });

    it("should replace special characters with hyphens", () => {
        expect.assertions(1);

        expect(toValidPackageName("my@project!")).toBe("my-project");
    });

    it("should strip leading dots, underscores, and hyphens", () => {
        expect.assertions(1);

        expect(toValidPackageName("._-myproject")).toBe("myproject");
    });

    it("should collapse consecutive hyphens", () => {
        expect.assertions(1);

        expect(toValidPackageName("my---project")).toBe("my-project");
    });
});

describe(isEmptyDir, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-utils-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should return true for non-existent directories", () => {
        expect.assertions(1);

        expect(isEmptyDir(join(tmpDir, "nonexistent"))).toBe(true);
    });

    it("should return true for empty directories", () => {
        expect.assertions(1);

        const dir = join(tmpDir, "empty");

        mkdirSync(dir);

        expect(isEmptyDir(dir)).toBe(true);
    });

    it("should return true for directories with only ignored files", () => {
        expect.assertions(1);

        const dir = join(tmpDir, "ignored");

        mkdirSync(dir);
        writeFileSync(join(dir, ".DS_Store"), "");
        writeFileSync(join(dir, ".gitkeep"), "");

        expect(isEmptyDir(dir)).toBe(true);
    });

    it("should return false for directories with real files", () => {
        expect.assertions(1);

        const dir = join(tmpDir, "notempty");

        mkdirSync(dir);
        writeFileSync(join(dir, "package.json"), "{}");

        expect(isEmptyDir(dir)).toBe(false);
    });
});

describe(canSafelyOverwrite, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-overwrite-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should return true for non-existent directory", () => {
        expect.assertions(1);

        expect(canSafelyOverwrite(join(tmpDir, "nope"))).toBe(true);
    });

    it("should return false for non-empty directory", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "file.txt"), "content");

        expect(canSafelyOverwrite(tmpDir)).toBe(false);
    });
});

describe(resolveTargetDir, () => {
    it("should resolve to absolute path and derive package name", () => {
        expect.assertions(2);

        const result = resolveTargetDir("My Project", "/home/user");

        expect(result.targetDir).toBe("/home/user/My Project");
        expect(result.packageName).toBe("my-project");
    });
});
