// eslint-disable-next-line unicorn/prevent-abbreviations
import { chmodSync, constants } from "node:fs";
import { rm } from "node:fs/promises";
import { platform } from "node:process";

import { ensureDirSync, writeJsonSync } from "@visulima/fs";
import { dirname, join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findCacheDirectory, findCacheDirectorySync } from "../../src";

// Windows does not support chmod in the same way as Unix
const isWindows = platform === "win32";

describe.each([
    ["findCacheDirectory", findCacheDirectory],
    ["findCacheDirectorySync", findCacheDirectorySync],
])("%s", (name, function_) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
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

    it.skipIf(isWindows)("should return undefined if the node_modules directory exists but is not writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules");

        ensureDirSync(testCachePath);
        // Make cacheNameDirectory not writeable
        // eslint-disable-next-line security/detect-non-literal-fs-filename
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
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        chmodSync(testCachePath, constants.O_RDWR);
    });

    it.skipIf(isWindows)("should return undefined if the .cache directory exists but is not writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache");

        ensureDirSync(testCachePath);
        // Make cacheNameDirectory not writeable
        // eslint-disable-next-line security/detect-non-literal-fs-filename
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
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        chmodSync(testCachePath, constants.O_RDWR);
    });

    it.skipIf(isWindows)("should return undefined if the path directory exists but is not writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache", "test");

        ensureDirSync(testCachePath);
        // Make cacheNameDirectory not writeable
        // eslint-disable-next-line security/detect-non-literal-fs-filename
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
        // eslint-disable-next-line security/detect-non-literal-fs-filename
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
});
