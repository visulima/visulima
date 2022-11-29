import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
    afterEach, beforeEach, describe, expect, it,
} from "vitest";

import { ensureFile, removeFile } from "../../src/utils/fs";
import { testRoot as uploadRoot } from "../__helpers__/config";
import { cleanup } from "../__helpers__/utils";

describe("utils", () => {
    describe("fs", () => {
        const testRoot = join(uploadRoot, "fs-utils");
        const direction = join(testRoot, "0", "1", "2");
        const filepath = join(direction, "3", "file.ext");

        beforeEach(() => cleanup(testRoot));

        afterEach(() => cleanup(testRoot));

        it("ensureFile(file)", async () => {
            const size = await ensureFile(filepath);

            expect(existsSync(filepath)).toBe(true);

            expect(size).toBe(0);
        });

        it("ensureFile(file, overwrite)", async () => {
            const size = await ensureFile(filepath, true);

            expect(existsSync(filepath)).toBe(true);
            expect(size).toBe(0);
        });

        it("removeFile(path)", async () => {
            await ensureFile(filepath);
            await removeFile(filepath);
            expect(readdirSync(direction, { withFileTypes: true }).filter((dirent) => dirent.isFile())).toHaveLength(0);
        });
    });
});
