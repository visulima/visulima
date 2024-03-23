import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findCacheDirectory, findCacheDirectorySync } from "../../src";
import { ensureDirSync, writeJsonSync } from "@visulima/fs";
import { join } from "node:path";

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

    it("should return the cache directory path if it exists and is writeable", async () => {
        expect.assertions(1);

        const testCachePath = join(distribution, "package", "node_modules", ".cache", "test");

        ensureDirSync(testCachePath);
        writeJsonSync(join(distribution, "package", "package.json"), {
            name: "test"
        })

        let result = function_("test", {
            cwd: join(distribution, "package"),
        });

        if (name === "findCacheDirectory") {
            result = await result;
        }

        expect(result).toStrictEqual(testCachePath);
    });
});
