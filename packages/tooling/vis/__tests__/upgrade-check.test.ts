import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXCLUDED_COMMANDS, isNewerVersion, shouldCheck } from "../src/upgrade-check";

describe("isNewerVersion", () => {
    it("should detect newer major version", () => {
        expect.assertions(1);

        expect(isNewerVersion("1.0.0", "2.0.0")).toBe(true);
    });

    it("should detect newer minor version", () => {
        expect.assertions(1);

        expect(isNewerVersion("1.0.0", "1.1.0")).toBe(true);
    });

    it("should detect newer patch version", () => {
        expect.assertions(1);

        expect(isNewerVersion("1.0.0", "1.0.1")).toBe(true);
    });

    it("should return false for same version", () => {
        expect.assertions(1);

        expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    });

    it("should return false for older version", () => {
        expect.assertions(1);

        expect(isNewerVersion("2.0.0", "1.0.0")).toBe(false);
    });

    it("should handle prerelease versions", () => {
        expect.assertions(1);

        expect(isNewerVersion("1.0.0-alpha.3", "1.0.0")).toBe(false);
    });

    it("should handle v prefix", () => {
        expect.assertions(1);

        expect(isNewerVersion("v1.0.0", "v1.0.1")).toBe(true);
    });

    it("should handle alpha to alpha comparison", () => {
        expect.assertions(1);

        // Both are 1.0.0 base - not newer
        expect(isNewerVersion("1.0.0-alpha.3", "1.0.0-alpha.4")).toBe(false);
    });

    it("should detect jump from 0.x to 1.x", () => {
        expect.assertions(1);

        expect(isNewerVersion("0.3.0", "1.0.0")).toBe(true);
    });
});

describe("shouldCheck", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("should return false in CI", () => {
        expect.assertions(1);

        process.env.CI = "true";

        expect(shouldCheck("install")).toBe(false);
    });

    it("should return false when VIS_CLI_TEST is set", () => {
        expect.assertions(1);

        process.env.VIS_CLI_TEST = "1";

        expect(shouldCheck("install")).toBe(false);
    });

    it("should return false when VIS_NO_UPDATE_CHECK is 1", () => {
        expect.assertions(1);

        process.env.VIS_NO_UPDATE_CHECK = "1";

        expect(shouldCheck("install")).toBe(false);
    });

    it("should return false for excluded commands", () => {
        expect.assertions(3);

        expect(shouldCheck("upgrade")).toBe(false);
        expect(shouldCheck("implode")).toBe(false);
        expect(shouldCheck("--version")).toBe(false);
    });
});

describe("EXCLUDED_COMMANDS", () => {
    it("should contain upgrade", () => {
        expect.assertions(1);

        expect(EXCLUDED_COMMANDS.has("upgrade")).toBe(true);
    });

    it("should contain implode", () => {
        expect.assertions(1);

        expect(EXCLUDED_COMMANDS.has("implode")).toBe(true);
    });

    it("should contain version flags", () => {
        expect.assertions(2);

        expect(EXCLUDED_COMMANDS.has("--version")).toBe(true);
        expect(EXCLUDED_COMMANDS.has("-V")).toBe(true);
    });

    it("should contain help", () => {
        expect.assertions(2);

        expect(EXCLUDED_COMMANDS.has("help")).toBe(true);
        expect(EXCLUDED_COMMANDS.has("--help")).toBe(true);
    });

    it("should NOT contain install (should check on install)", () => {
        expect.assertions(1);

        expect(EXCLUDED_COMMANDS.has("install")).toBe(false);
    });

    it("should NOT contain check (should check on check)", () => {
        expect.assertions(1);

        expect(EXCLUDED_COMMANDS.has("check")).toBe(false);
    });
});

describe("upgrade check cache", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-upgrade-check-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should write and read cache file", () => {
        expect.assertions(3);

        const cachePath = join(tmpDir, ".upgrade-check.json");
        const cache = {
            lastNoticeAt: 0,
            lastQueryAt: Date.now(),
            latestVersion: "2.0.0",
        };

        writeFileSync(cachePath, JSON.stringify(cache));

        const read = JSON.parse(readFileSync(cachePath, "utf8"));

        expect(read.latestVersion).toBe("2.0.0");
        expect(read.lastQueryAt).toBeGreaterThan(0);
        expect(read.lastNoticeAt).toBe(0);
    });

    it("should handle corrupted cache gracefully", () => {
        expect.assertions(1);

        const cachePath = join(tmpDir, ".upgrade-check.json");

        writeFileSync(cachePath, "not valid json {{{");

        let result;

        try {
            result = JSON.parse(readFileSync(cachePath, "utf8"));
        } catch {
            result = undefined;
        }

        expect(result).toBeUndefined();
    });

    it("should handle missing cache file", () => {
        expect.assertions(1);

        const cachePath = join(tmpDir, ".upgrade-check.json");

        expect(existsSync(cachePath)).toBe(false);
    });
});
