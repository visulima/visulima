// eslint-disable-next-line unicorn/prevent-abbreviations
import { existsSync } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDir from "../../../src/ensure/ensure-dir";
// eslint-disable-next-line unicorn/prevent-abbreviations
import ensureDirSync from "../../../src/ensure/ensure-dir-sync";

const EXPECTED_DIR_ERROR_RE = /Ensure path exists, expected 'dir'/;

describe.each([
    ["ensureDir", ensureDir],
    ["ensureDirSync", ensureDirSync],
])("%s", (name, function_) => {
    let distribution: string;

    beforeEach(() => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { force: true, recursive: true });
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

        expect(existsSync(path)).toBe(true);
    });

    it("should create deeply nested directories from scratch", async () => {
        expect.assertions(1);

        const path = `${distribution}/a/b/c/d/e/f/g`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            await function_(path);
        } else {
            function_(path);
        }

        expect(existsSync(path)).toBe(true);
    });

    it("should ensure existing dir exists", async () => {
        expect.assertions(1);

        const path = `${distribution}/ensure_dir_exist/dir`;

        await mkdir(path, { recursive: true });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            await function_(path);
        } else {
            function_(path);
        }

        expect(existsSync(path)).toBe(true);
    });

    it("should be idempotent when invoked twice on the same path", async () => {
        expect.assertions(2);

        const path = `${distribution}/idempotent/sub`;

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            await function_(path);
            await function_(path);
        } else {
            function_(path);
            function_(path);
        }

        expect(existsSync(path)).toBe(true);
        expect(existsSync(`${distribution}/idempotent`)).toBe(true);
    });

    it("should throw a error if input is a file", async () => {
        expect.assertions(1);

        const path = `${distribution}/ensure_dir_file`;
        const filePath = `${path}/file`;

        await mkdir(path, { recursive: true });

        await writeFile(filePath, "Hello, World!");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(filePath)).rejects.toThrow("Ensure path exists, expected 'dir', got 'file'");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => {
                function_(filePath);
            }).toThrow("Ensure path exists, expected 'dir', got 'file'");
        }
    });

    it("should throw when path is a symlink to a file", async () => {
        expect.assertions(1);

        const target = `${distribution}/target.txt`;
        const link = `${distribution}/link`;

        await writeFile(target, "hi");
        await symlink(target, link);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(link)).rejects.toThrow(EXPECTED_DIR_ERROR_RE);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => {
                function_(link);
            }).toThrow(EXPECTED_DIR_ERROR_RE);
        }
    });

    it("should accept a URL input pointing at an existing directory", async () => {
        expect.assertions(1);

        const path = `${distribution}/url_dir`;

        await mkdir(path, { recursive: true });

        const url = new URL(`file://${path}`);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            await function_(url);
        } else {
            function_(url);
        }

        expect(existsSync(path)).toBe(true);
    });

    it("should throw TypeError when called with an invalid path", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureDir") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_("" as any)).rejects.toThrow(TypeError);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => {
                function_("");
            }).toThrow(TypeError);
        }
    });
});
