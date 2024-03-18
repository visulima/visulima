import { lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import ensureLink from "../../src/ensure-link";
import ensureLinkSync from "../../src/ensure-link-sync";

describe.each([
    ["ensureLink", ensureLink],
    ["ensureLinkSync", ensureLinkSync],
])("%s", (name, function_) => {
    let distribution: string;

    beforeAll(() => {
        distribution = temporaryDirectory();
    });

    beforeEach(() => {
        writeFileSync("./foo.txt", "foo\n");
        mkdirSync("empty-dir", { recursive: true });
        mkdirSync("dir-foo", { recursive: true });
        writeFileSync("dir-foo/foo.txt", "dir-foo\n");
        mkdirSync("dir-bar", { recursive: true });
        writeFileSync("dir-bar/bar.txt", "dir-bar\n");
        mkdirSync("real-alpha/real-beta/real-gamma", { recursive: true });
        symlinkSync("foo.txt", "real-symlink.txt");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
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
        [resolve(join(distribution, "./foo.txt")), "./link.txt"],
        [resolve(join(distribution, "./dir-foo/foo.txt")), "./link.txt"],
    ])("should create link file using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(1);

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
        const isSymlink = lstatSync(destinationPath).isFile();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationContent = readFileSync(destinationPath, "utf8");
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryContents = readdirSync(destinationDirectory);

        expect(isSymlink).toBeTruthy();
        expect(sourceContent).toStrictEqual(destinationContent);
        expect(destinationDirectoryContents).contains(destinationBasename);
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
        [resolve(join(distribution, "./missing.txt")), "./link.txt"],
        [resolve(join(distribution, "../foo.txt")), "./link.txt"],
        [resolve(join(distribution, "../dir-foo/foo.txt")), "./link.txt"],
    ])("should return error when creating link file using src %s and dst %s", async (sourcePath, destinationPath) => {});
});
