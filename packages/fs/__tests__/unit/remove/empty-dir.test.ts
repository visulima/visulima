// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// eslint-disable-next-line unicorn/prevent-abbreviations
import emptyDir from "../../../src/remove/empty-dir";
// eslint-disable-next-line unicorn/prevent-abbreviations
import emptyDirSync from "../../../src/remove/empty-dir-sync";

describe.each([
    ["emptyDir", emptyDir],
    ["emptyDirSync", emptyDirSync],
])("%s", (name, function_) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should create a new dir if it does not exist", async () => {
        expect.assertions(1);

        const path = `${distribution}/new-dir`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "emptyDir") {
            await function_(path);
        } else {
            function_(path);
        }

        expect(existsSync(path)).toBe(true);
    });

    it("should create a new nested dir if it does not exist", async () => {
        expect.assertions(1);

        const path = `${distribution}/new-dir/nested`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "emptyDir") {
            await function_(path);
        } else {
            function_(path);
        }

        expect(existsSync(path)).toBe(true);
    });

    it("should empty nexted dirs and files", async () => {
        expect.assertions(5);

        const path = `${distribution}/new-dir/nested`;
        const path2 = `${distribution}/new-dir/nested/nested2`;
        const file = `${path}/file.txt`;
        const file2 = `${path2}/file.txt`;
        const file3 = `${path2}/file.txt`;

        mkdirSync(path2, { recursive: true });

        writeFileSync(file, "content");

        writeFileSync(file2, "content2");

        writeFileSync(file3, "content3");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "emptyDir") {
            await function_(path);
        } else {
            function_(path);
        }

        expect(existsSync(path)).toBe(true);

        expect(existsSync(path2)).toBe(false);

        expect(existsSync(file)).toBe(false);

        expect(existsSync(file2)).toBe(false);

        expect(existsSync(file3)).toBe(false);
    });
});
