import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyPreset, defaultCacheForType, loadEnvFile, matchesOs, resolveTargetShell, shouldRunInCI } from "../src/target-options";

describe(applyPreset, () => {
    it("should return the target unchanged when no preset is set", () => {
        expect.assertions(1);

        const target = { options: { interactive: true } };
        const result = applyPreset(target);

        expect(result).toStrictEqual(target);
    });

    it("should apply server preset defaults", () => {
        expect.assertions(4);

        const result = applyPreset({ preset: "server" });

        expect(result.options?.persistent).toBe(true);
        expect(result.options?.interactive).toBe(false);
        expect(result.cache).toBe(false);
        expect(result.options?.runInCI).toBe(false);
    });

    it("should apply utility preset defaults", () => {
        expect.assertions(2);

        const result = applyPreset({ preset: "utility" });

        expect(result.cache).toBe(false);
        expect(result.options?.runInCI).toBe(false);
    });

    it("should let user options override preset defaults", () => {
        expect.assertions(3);

        const result = applyPreset({
            cache: true,
            options: { persistent: false, runInCI: true },
            preset: "server",
        });

        expect(result.cache).toBe(true);
        expect(result.options?.persistent).toBe(false);
        expect(result.options?.runInCI).toBe(true);
    });

    it("should resolve preset from options.preset", () => {
        expect.assertions(2);

        const result = applyPreset({ options: { preset: "utility" } });

        expect(result.cache).toBe(false);
        expect(result.options?.runInCI).toBe(false);
    });

    it("should return unchanged target for unknown preset", () => {
        expect.assertions(1);

        const target = { preset: "unknown" as "server" };
        const result = applyPreset(target);

        expect(result).toStrictEqual(target);
    });
});

describe(matchesOs, () => {
    it("should match all when options are undefined", () => {
        expect.assertions(1);

        expect(matchesOs(undefined, "linux")).toBe(true);
    });

    it("should match all when osType is not set", () => {
        expect.assertions(1);

        expect(matchesOs({}, "linux")).toBe(true);
    });

    it("should match when current OS is in the list", () => {
        expect.assertions(1);

        expect(matchesOs({ osType: "linux" }, "linux")).toBe(true);
    });

    it("should not match when current OS differs", () => {
        expect.assertions(1);

        expect(matchesOs({ osType: "macos" }, "linux")).toBe(false);
    });

    it("should support an array of OS types", () => {
        expect.assertions(2);

        expect(matchesOs({ osType: ["linux", "macos"] }, "linux")).toBe(true);
        expect(matchesOs({ osType: ["macos", "windows"] }, "linux")).toBe(false);
    });
});

describe(shouldRunInCI, () => {
    it("should return true by default when in CI", () => {
        expect.assertions(1);

        expect(shouldRunInCI(undefined, true)).toBe(true);
    });

    it("should return true by default when not in CI", () => {
        expect.assertions(1);

        expect(shouldRunInCI(undefined, false)).toBe(true);
    });

    it("should return false when runInCI is false and in CI", () => {
        expect.assertions(1);

        expect(shouldRunInCI({ runInCI: false }, true)).toBe(false);
    });

    it("should return true when runInCI is false and not in CI", () => {
        expect.assertions(1);

        expect(shouldRunInCI({ runInCI: false }, false)).toBe(true);
    });

    it("should return true when runInCI is 'always'", () => {
        expect.assertions(2);

        expect(shouldRunInCI({ runInCI: "always" }, true)).toBe(true);
        expect(shouldRunInCI({ runInCI: "always" }, false)).toBe(true);
    });

    it("should return true in CI when affected and mode is 'affected'", () => {
        expect.assertions(1);

        expect(shouldRunInCI({ runInCI: "affected" }, true, true)).toBe(true);
    });

    it("should return false in CI when not affected and mode is 'affected'", () => {
        expect.assertions(1);

        expect(shouldRunInCI({ runInCI: "affected" }, true, false)).toBe(false);
    });

    it("should return true when not in CI and mode is 'affected'", () => {
        expect.assertions(1);

        expect(shouldRunInCI({ runInCI: "affected" }, false)).toBe(true);
    });
});

describe(loadEnvFile, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-env-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should parse KEY=value pairs", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, ".env"), "FOO=bar\nBAZ=qux");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.FOO).toBe("bar");
        expect(env.BAZ).toBe("qux");
    });

    it("should strip double quotes from values", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), 'KEY="hello world"');

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.KEY).toBe("hello world");
    });

    it("should strip single quotes from values", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "KEY='hello world'");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env.KEY).toBe("hello world");
    });

    it("should skip comments and empty lines", () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, ".env"), "# comment\n\nKEY=value\n  \n# another comment");

        const env = loadEnvFile(tmpDir, ".env");

        expect(Object.keys(env)).toHaveLength(1);
        expect(env.KEY).toBe("value");
    });

    it("should return empty object for nonexistent file", () => {
        expect.assertions(1);

        const env = loadEnvFile(tmpDir, ".env.missing");

        expect(env).toStrictEqual({});
    });

    it("should handle lines without equals sign", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".env"), "NOEQUALS\nVALID=yes");

        const env = loadEnvFile(tmpDir, ".env");

        expect(env).toStrictEqual({ VALID: "yes" });
    });

    it("should handle absolute envFile paths", () => {
        expect.assertions(1);

        const absPath = join(tmpDir, "abs.env");

        writeFileSync(absPath, "ABS=true");

        const env = loadEnvFile("/unused", absPath);

        expect(env.ABS).toBe("true");
    });
});

describe(resolveTargetShell, () => {
    it("should return undefined when options are undefined", () => {
        expect.assertions(1);

        expect(resolveTargetShell(undefined)).toBeUndefined();
    });

    it("should return windowsShell on windows", () => {
        expect.assertions(1);

        expect(resolveTargetShell({ shell: "/bin/sh", windowsShell: "powershell.exe" }, "windows")).toBe("powershell.exe");
    });

    it("should return unixShell on linux", () => {
        expect.assertions(1);

        expect(resolveTargetShell({ shell: "/bin/sh", unixShell: "/bin/zsh" }, "linux")).toBe("/bin/zsh");
    });

    it("should return unixShell on macos", () => {
        expect.assertions(1);

        expect(resolveTargetShell({ shell: "/bin/sh", unixShell: "/bin/zsh" }, "macos")).toBe("/bin/zsh");
    });

    it("should fall back to generic shell when platform-specific is not set", () => {
        expect.assertions(2);

        expect(resolveTargetShell({ shell: "/bin/bash" }, "linux")).toBe("/bin/bash");
        expect(resolveTargetShell({ shell: "cmd.exe" }, "windows")).toBe("cmd.exe");
    });

    it("should return undefined when no shell options are set", () => {
        expect.assertions(1);

        expect(resolveTargetShell({}, "linux")).toBeUndefined();
    });
});

describe(defaultCacheForType, () => {
    it("should return true for 'build'", () => {
        expect.assertions(1);

        expect(defaultCacheForType("build")).toBe(true);
    });

    it("should return false for 'run'", () => {
        expect.assertions(1);

        expect(defaultCacheForType("run")).toBe(false);
    });

    it("should return true for 'test'", () => {
        expect.assertions(1);

        expect(defaultCacheForType("test")).toBe(true);
    });

    it("should return undefined for undefined type", () => {
        expect.assertions(1);

        expect(defaultCacheForType(undefined)).toBeUndefined();
    });
});
