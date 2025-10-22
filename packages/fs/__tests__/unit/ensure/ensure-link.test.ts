import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { basename, dirname, join, resolve } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ensureLink from "../../../src/ensure/ensure-link";
import ensureLinkSync from "../../../src/ensure/ensure-link-sync";

const distribution: string = temporaryDirectory();
const isWindows = process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);

describe.each([
    ["ensureLink", ensureLink],
    ["ensureLinkSync", ensureLinkSync],
])("%s", (name, function_) => {
    beforeEach(async () => {
        writeFileSync("./foo.txt", "foo\n");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(resolve(join(distribution, "./foo.txt")), "foo\n");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(resolve(join(distribution, "./dir-foo")), { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(resolve(join(distribution, "./dir-foo/foo.txt")), "foo\n");

        mkdirSync("empty-dir", { recursive: true });

        mkdirSync("dir-foo", { recursive: true });
        writeFileSync("dir-foo/foo.txt", "dir-foo\n");

        mkdirSync("dir-bar", { recursive: true });
        writeFileSync("dir-bar/bar.txt", "dir-bar\n");

        mkdirSync("real-alpha/real-beta/real-gamma", { recursive: true });

        symlinkSync("foo.txt", "real-symlink.txt", isWindows ? "junction" : null);
    });

    afterEach(async () => {
        // eslint-disable-next-line no-loops/no-loops
        for await (const directory of [
            "./foo.txt",
            "./real-symlink.txt",
            "./empty-dir",
            "./dir-foo",
            "./dir-bar",
            "./real-alpha",
            "./alpha",
            "./link-foo.txt",
            "./link.txt",
            resolve(join(distribution, "./foo.txt")),
            resolve(join(distribution, "./dir-foo")),
            resolve(join(distribution, "./dir-bar")),
            resolve(join(distribution, "./real-alpha")),
            resolve(join(distribution, "./alpha")),
            resolve(join(distribution, "./link-foo.txt")),
            resolve(join(distribution, "./link.txt")),
        ]) {
            try {
                await rm(directory, { recursive: true });
            } catch {
                /* empty */
            }
        }
    });

    it.each([
        ["./foo.txt", "./link.txt"],
        ["./foo.txt", "./dir-foo/link.txt"],
        ["./foo.txt", "./empty-dir/link.txt"],
        ["./foo.txt", "./real-alpha/link.txt"],
        ["./foo.txt", "./real-alpha/real-beta/link.txt"],
        ["./foo.txt", "./real-alpha/real-beta/real-gamma/link.txt"],
        ["./foo.txt", "./alpha/link.txt"],
        ["./foo.txt", "./alpha/beta/link.txt"],
        ["./foo.txt", "./alpha/beta/gamma/link.txt"],
        ["./foo.txt", "./link-foo.txt"],
        ["./foo.txt", "./link.txt"],
        ["./dir-foo/foo.txt", "./link.txt"],
        [resolve(join(distribution, "./foo.txt")), resolve(join(distribution, "./link.txt"))],
        [resolve(join(distribution, "./dir-foo/foo.txt")), resolve(join(distribution, "./link.txt"))],
    ])("should create link file using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(3);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureLink") {
            await function_(sourcePath, destinationPath);
        } else {
            function_(sourcePath, destinationPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const sourceContent = readFileSync(sourcePath, "utf8");
        const destinationDirectory = dirname(destinationPath);
        const destinationBasename = basename(destinationPath);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(lstatSync(destinationPath).isFile()).toBe(true);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(sourceContent).toStrictEqual(readFileSync(destinationPath, "utf8"));
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readdirSync(destinationDirectory)).contains(destinationBasename);
    });

    it.each([
        ["./missing.txt", "./link.txt"],
        ["../foo.txt", "./link.txt"],
        ["../dir-foo/foo.txt", "./link.txt"],
        ["./dir-foo/foo.txt", "./link-foo.txt"],
        ["./missing.txt", "./link.txt"],
        ["./missing.txt", "./missing-dir/link.txt"],
        // error is thrown if destination path exists
        ["./foo.txt", "./dir-foo/foo.txt"],
        [resolve(join(distribution, "./missing.txt")), resolve(join(distribution, "./link.txt"))],
        [resolve(join(distribution, "../foo.txt")), resolve(join(distribution, "./link.txt"))],
        [resolve(join(distribution, "../dir-foo/foo.txt")), resolve(join(distribution, "./link.txt"))],
    ])("should return error when creating link file using src %s and dst %s", async (sourcePath, destinationPath) => {
        expect.assertions(2);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (destinationPath === "./link-foo.txt") {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            writeFileSync(destinationPath, "foo\n");
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsBefore = existsSync(dirname(destinationPath));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureLink") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(sourcePath, destinationPath)).rejects.toThrow(Error);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(sourcePath, destinationPath)).toThrow(Error);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsAfter = existsSync(dirname(destinationPath));

        expect(destinationDirectoryExistsBefore).toStrictEqual(destinationDirectoryExistsAfter);
    });
});
