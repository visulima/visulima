import { existsSync } from "node:fs";
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
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        ["string", join(distribution, "file.txt"), async (path: URL | string) => await writeFile(path, "Hello, World!")],
        // eslint-disable-next-line security/detect-non-literal-fs-filename,compat/compat
        ["URL", new URL(`file:///${join(distribution, "file.txt")}`), async (path: URL | string) => await writeFile(path, "Hello, World!")],
        [
            "Symbolic link",
            join(distribution, "symlink.txt"),
            async (path: URL | string) => {
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await writeFile(join(distribution, "temp_file.txt"), "Hello, World!");
                // eslint-disable-next-line security/detect-non-literal-fs-filename
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

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(path)).toBe(false);
    });
});
