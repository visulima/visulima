import { existsSync, mkdirSync } from "node:fs";
import { symlink, writeFile } from "node:fs/promises";

import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { describe, expect, it } from "vitest";

import remove from "../../../src/remove/remove";
import removeSync from "../../../src/remove/remove-sync";

const distribution = temporaryDirectory();
const isWindows = process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);

describe.each([
    ["remove", remove],
    ["removeSync", removeSync],
])("%s", (name, function_) => {
    it.each([
        [
            "string",
            join(distribution, "file.txt"),
            async (path: URL | string) => {
                await writeFile(path, "Hello, World!");
            },
        ],
        [
            "URL",
            new URL(`file:///${join(distribution, "file.txt")}`),
            async (path: URL | string) => {
                await writeFile(path, "Hello, World!");
            },
        ],
        [
            "Symbolic link",
            join(distribution, "symlink.txt"),
            async (path: URL | string) => {
                await writeFile(join(distribution, "temp_file.txt"), "Hello, World!");

                await symlink(join(distribution, "temp_file.txt"), path, isWindows ? "junction" : null);
            },
        ],
    ])("should remove a file (%s)", async (_, path: URL | string, write) => {
        expect.assertions(1);

        await write(path);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "remove") {
            await function_(path);
        } else {
            function_(path);
        }

        expect(existsSync(path)).toBe(false);
    });

    it.each([
        ["empty options", {}],
        ["explicit undefined retryDelay", { retryDelay: undefined }],
        ["explicit undefined maxRetries", { maxRetries: undefined }],
        ["both undefined", { maxRetries: undefined, retryDelay: undefined }],
        ["defined maxRetries", { maxRetries: 2 }],
        ["defined retryDelay", { retryDelay: 5 }],
        ["both defined", { maxRetries: 1, retryDelay: 1 }],
    ])("should remove a directory when options carry undefined retry fields (%s)", async (_, options) => {
        expect.assertions(1);

        // Regression for an upstream Node ≥22.3 behaviour: passing
        // `retryDelay: undefined` or `maxRetries: undefined` to
        // `fs.rm`/`fs.rmSync` throws `ERR_INVALID_ARG_TYPE`. The
        // surrounding try/catch in `remove`/`removeSync` previously
        // swallowed that throw and silently turned the call into a
        // no-op — the directory was never removed.
        const targetDirectory = join(distribution, `regression-${name}-${String(Object.keys(options).length)}-${Date.now()}`);

        mkdirSync(targetDirectory, { recursive: true });
        await writeFile(join(targetDirectory, "marker.txt"), "x");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "remove") {
            await function_(targetDirectory, options);
        } else {
            function_(targetDirectory, options);
        }

        expect(existsSync(targetDirectory)).toBe(false);
    });
});
