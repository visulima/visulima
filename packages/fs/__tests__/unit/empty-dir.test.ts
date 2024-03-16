// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// eslint-disable-next-line unicorn/prevent-abbreviations
import emptyDir from "../../src/empty-dir";
// eslint-disable-next-line unicorn/prevent-abbreviations
import emptyDirSync from "../../src/empty-dir-sync";

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

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
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

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
    });

    it("should empty nexted dirs and files", async () => {
        expect.assertions(5);

        const path = `${distribution}/new-dir/nested`;
        const path2 = `${distribution}/new-dir/nested/nested2`;
        const file = `${path}/file.txt`;
        const file2 = `${path2}/file.txt`;
        const file3 = `${path2}/file.txt`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(path2, { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(file, "content");
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(file2, "content2");
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(file3, "content3");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "emptyDir") {
            await function_(path);
        } else {
            function_(path);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path2)).toBeFalsy();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(file)).toBeFalsy();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(file2)).toBeFalsy();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(file3)).toBeFalsy();
    });
});
