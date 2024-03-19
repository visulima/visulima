// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDir from "../../src/ensure-dir";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDirSync from "../../src/ensure-dir-sync";

describe.each([["ensureDir", ensureDir], ["ensureDirSync", ensureDirSync]])("%s", (name, function_) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should create a dir if it does not exist", async () => {
        expect.assertions(1);

        const path = `${distribution}/ensure_dir_not_exist/dir`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            await function_(path);
        } else {
            function_(path);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
    });

    it('should ensure existing dir exists', async () => {
        expect.assertions(1);

        const path = `${distribution}/ensure_dir_exist/dir`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await mkdir(path, { recursive: true });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            await function_(path);
        } else {
            function_(path);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBeTruthy();
    });

    it('should throw a error if input is a file', async () => {
        expect.assertions(1);

        const path = `${distribution}/ensure_dir_file`;
        const filePath = `${path}/file`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await mkdir(path, { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await writeFile(filePath, "Hello, World!");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            await expect(() => function_(filePath)).rejects.toThrow("Ensure path exists, expected 'dir', got 'file'");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            expect(() => function_(filePath)).toThrow("Ensure path exists, expected 'dir', got 'file'");
        }
    });
});
