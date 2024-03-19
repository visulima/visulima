import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ensureFile from "../../src/ensure-file";
import ensureFileSync from "../../src/ensure-file-sync";

describe.each([
    ["ensureFile", ensureFile],
    ["ensureFileSync", ensureFileSync],
])("%s", (name, function_) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should create a file if it does not exist", async () => {
        expect.assertions(1);

        const path = `${distribution}/test.txt`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureFile") {
            await function_(path);
        } else {
            function_(path);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
    });

    it("should create a file in a child dir if it does not exist", async () => {
        expect.assertions(1);

        const path = `${distribution}/ensure_dir_not_exist/test.txt`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureFile") {
            await function_(path);
        } else {
            function_(path);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
    });

    it("should ensure existing file exists", async () => {
        expect.assertions(1);

        const path = `${distribution}/test.text`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await writeFile(path, "Hello, World!");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureFile") {
            await function_(path);
        } else {
            function_(path);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
    });

    it("should throw a error if input is a dir", async () => {
        expect.assertions(1);

        const path = `${distribution}/ensure_dir_file`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await mkdir(path, { recursive: true });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureFile") {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            await expect(() => function_(path)).rejects.toThrow("Ensure path exists, expected 'file', got 'dir'");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            expect(() => function_(path)).toThrow("Ensure path exists, expected 'file', got 'dir'");
        }
    });
});
