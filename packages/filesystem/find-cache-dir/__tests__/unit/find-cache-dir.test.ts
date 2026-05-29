// eslint-disable-next-line unicorn/prevent-abbreviations
import { chmodSync, constants, existsSync, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { cwd, platform } from "node:process";

import { ensureDirSync, writeJsonSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findCacheDir as findCacheDirectory, findCacheDirSync as findCacheDirectorySync } from "../../src";

// Windows does not support chmod in the same way as Unix
const isWindows = platform === "win32";

describe.each<[string, typeof findCacheDirectory | typeof findCacheDirectorySync]>([
    ["findCacheDirectory", findCacheDirectory],
    ["findCacheDirectorySync", findCacheDirectorySync],
])("%s", (name, function_) => {
    let distribution: string;

    beforeEach(() => {
        distribution = mkdtempSync(join(tmpdir(), "find-cache-dir-"));
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it.skipIf(isWindows)("should return the cache directory path if it exists and is writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache", "test");

        ensureDirSync(testCachePath);
        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(testCachePath);
    });

    it.skipIf(isWindows)("should return the cache directory path if the .cache directory exists and is writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache");

        ensureDirSync(testCachePath);
        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(join(testCachePath, "test"));
    });

    it.skipIf(isWindows)("should return the cache directory path if the node_modules directory exists and is writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules");

        ensureDirSync(testCachePath);
        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(join(testCachePath, ".cache", "test"));
    });

    it.skipIf(isWindows)(
        "should return the current working directory's cache path if the node_modules directory exists and is writable within a monorepo.",
        async () => {
            expect.assertions(2);

            const monorepoPath = join(distribution, "packages", "package");
            const testCachePath = join(monorepoPath, "node_modules");

            ensureDirSync(join(distribution, "node_modules"));
            ensureDirSync(testCachePath);

            writeJsonSync(join(distribution, "package.json"), {
                name: "root",
            });
            writeJsonSync(join(monorepoPath, "package.json"), {
                name: "test",
            });

            let result = function_("test", {
                cwd: monorepoPath,
            });

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (name === "findCacheDirectory") {
                result = await result;
            }

            expect(result).not.toStrictEqual(join(distribution, "node_modules", ".cache", "test"));
            expect(result).toStrictEqual(join(testCachePath, ".cache", "test"));
        },
    );

    it.skipIf(isWindows)("should return undefined if the node_modules directory exists but is not writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules");

        ensureDirSync(testCachePath);
        // Make cacheNameDirectory not writeable
        chmodSync(testCachePath, constants.O_RDONLY);
        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toBeUndefined();

        // Make cacheNameDirectory writeable
        chmodSync(testCachePath, constants.O_RDWR);
    });

    it.skipIf(isWindows)("should return undefined if the .cache directory exists but is not writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache");

        ensureDirSync(testCachePath);
        // Make cacheNameDirectory not writeable
        chmodSync(testCachePath, constants.O_RDONLY);

        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toBeUndefined();

        // Make cacheNameDirectory writeable
        chmodSync(testCachePath, constants.O_RDWR);
    });

    it.skipIf(isWindows)("should return undefined if the path directory exists but is not writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache", "test");

        ensureDirSync(testCachePath);
        // Make cacheNameDirectory not writeable
        chmodSync(testCachePath, constants.O_RDONLY);

        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toBeUndefined();

        // Make cacheNameDirectory writeable
        chmodSync(testCachePath, constants.O_RDWR);
    });

    it("should support CACHE_DIR environment variable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache", "test");

        process.env.CACHE_DIR = dirname(testCachePath);

        ensureDirSync(testCachePath);

        let result = function_("test");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(testCachePath);
    });

    it.each(["0", "1", "false", "true"])("should ignores `%s` for CACHE_DIR environment variable", async (environmentValue: string) => {
        expect.assertions(1);

        process.env.CACHE_DIR = environmentValue;

        const testCachePath = join(distribution, "package", "node_modules", ".cache", "test");

        ensureDirSync(testCachePath);
        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(testCachePath);

        delete process.env.CACHE_DIR;
    });

    it("should throw an error if the root directory could not be found and throwError option is enabled", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(async () =>
                (function_ as typeof findCacheDirectory)("this_dir_will_never_exist", { cwd: "/this_dir_will_never_exist", throwError: true }),
            ).rejects.toThrow("ENOENT: No such file or directory found.");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() =>
                (function_ as typeof findCacheDirectorySync)("this_dir_will_never_exist", { cwd: "/this_dir_will_never_exist", throwError: true }),
            ).toThrow("ENOENT: No such file or directory found.");
        }
    });

    it("should return undefined if the root directory could not be found and throwError option is not enabled", async () => {
        expect.assertions(1);

        let result = function_("this_dir_will_never_exist", { cwd: "/this_dir_will_never_exist" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toBeUndefined();
    });

    it.skipIf(isWindows)("should create the cache directory when the create option is enabled", async () => {
        expect.assertions(2);

        const testCachePath = join(distribution, "package", "node_modules", ".cache", "test");

        ensureDirSync(join(distribution, "package", "node_modules"));
        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test",
        });

        let result = function_("test", {
            create: true,
            cwd: join(distribution, "package"),
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(testCachePath);
        expect(existsSync(testCachePath)).toBe(true);
    });

    it("should fall back to the process working directory when no cwd option is provided", async () => {
        expect.assertions(1);

        delete process.env.CACHE_DIR;

        let result = function_("find-cache-dir-fallback");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(join(cwd(), "node_modules", ".cache", "find-cache-dir-fallback"));
    });
});
