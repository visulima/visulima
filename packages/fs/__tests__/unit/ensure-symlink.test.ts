import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ensureSymlink from "../../src/ensure-symlink";
import ensureSymlinkSync from "../../src/ensure-symlink-sync";

const distribution: string = temporaryDirectory();

describe.each([
    ["ensureSymlink", ensureSymlink],
    ["ensureSymlinkSync", ensureSymlinkSync],
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

        symlinkSync("foo.txt", "real-symsymlink.txt");
    });

    afterEach(async () => {
        try {
            await rm("foo.txt");
        await rm("real-symsymlink.txt");
        await rm("symsymlink.txt");
        await rm("symsymlink-dir-foo", { recursive: true });
        await rm("real-symsymlink-dir-foo", { recursive: true });
        await rm("empty-dir", { recursive: true });
        await rm("dir-foo", { recursive: true });
        await rm("dir-bar", { recursive: true });
        await rm("real-alpha", { recursive: true });
        } catch (error) {
        }
    });

    it.each([
        ["./foo.txt", "./symlink.txt"],
        // ["./foo.txt", "./dir-foo/symlink.txt"],
        // ["./foo.txt", "./empty-dir/symlink.txt"],
        // ["./foo.txt", "./real-alpha/symlink.txt"],
        // ["./foo.txt", "./real-alpha/real-beta/symlink.txt"],
        // ["./foo.txt", "./real-alpha/real-beta/real-gamma/symlink.txt"],
        // ["./foo.txt", "./alpha/symlink.txt"],
        // ["./foo.txt", "./alpha/beta/symlink.txt"],
        // ["./foo.txt", "./alpha/beta/gamma/symlink.txt"],
        // ["./foo.txt", "./link-foo.txt"],
        // ["./foo.txt", "./symlink.txt"],
        // ["./dir-foo/foo.txt", "./symlink.txt"],
        // [resolve(join(distribution, "./foo.txt")), resolve(join(distribution, "./symlink.txt"))],
        // [resolve(join(distribution, "./dir-foo/foo.txt")), resolve(join(distribution, "./symlink.txt"))],
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
        const isSymlink = lstatSync(destinationPath).isFile();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationContent = readFileSync(destinationPath, "utf8");
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryContents = readdirSync(destinationDirectory);

        expect(isSymlink).toBeTruthy();
        expect(sourceContent).toStrictEqual(destinationContent);
        expect(destinationDirectoryContents).contains(destinationBasename);

        await rm(destinationPath, { recursive: true });
    });

    it.each([
        ["./missing.txt", "./symlink.txt"],
        ["../foo.txt", "./symlink.txt"],
        ["../dir-foo/foo.txt", "./symlink.txt"],
        ["./dir-foo/foo.txt", "./link-foo.txt"],
        ["./missing.txt", "./symlink.txt"],
        ["./missing.txt", "./missing-dir/symlink.txt"],
        // error is thrown if destination path exists
        ["./foo.txt", "./dir-foo/foo.txt"],
        [resolve(join(distribution, "./missing.txt")), resolve(join(distribution, "./symlink.txt"))],
        [resolve(join(distribution, "../foo.txt")), resolve(join(distribution, "./symlink.txt"))],
        [resolve(join(distribution, "../dir-foo/foo.txt")), resolve(join(distribution, "./symlink.txt"))],
    ])("should return error when creating symlink file using src %s and dst %s", async (sourcePath, destinationPath) => {
        expect.assertions(2);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsBefore = existsSync(dirname(destinationPath));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureLink") {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            await expect(() => function_(sourcePath, destinationPath)).rejects.toThrow(Error);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            expect(() => function_(sourcePath, destinationPath)).toThrow(Error);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsAfter = existsSync(dirname(destinationPath));

        expect(destinationDirectoryExistsBefore).toStrictEqual(destinationDirectoryExistsAfter);
    });

    it.each([
        ["./dir-foo", "./symlink-dir-foo"],
        ["../dir-bar", "./dir-foo/symlink-dir-bar"],
        ["./dir-bar", "./dir-foo/symlink-dir-bar"],
        ["./dir-bar", "./empty-dir/symlink-dir-bar"],
        ["./dir-bar", "./real-alpha/symlink-dir-bar"],
        ["./dir-bar", "./real-alpha/real-beta/symlink-dir-bar"],
        ["./dir-bar", "./real-alpha/real-beta/real-gamma/symlink-dir-bar"],
        ["./dir-foo", "./alpha/dir-foo"],
        ["./dir-foo", "./alpha/beta/dir-foo"],
        ["./dir-foo", "./alpha/beta/gamma/dir-foo"],
        ["./dir-foo", "./real-symlink-dir-foo"],
    ])("should create symlink dir using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(3);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureLink") {
            await function_(sourcePath, destinationPath);
        } else {
            function_(sourcePath, destinationPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const sourceContents = readdirSync(sourcePath);
        const destinationDirectory = dirname(destinationPath);
        const destinationBasename = basename(destinationPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const isSymlink = lstatSync(destinationPath).isSymbolicLink();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationContents = readdirSync(destinationPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryContents = readdirSync(destinationDirectory);

        expect(isSymlink).toBeTruthy();
        expect(sourceContents).toStrictEqual(destinationContents);
        expect(destinationDirectoryContents).include(destinationBasename);
    });

    it.each([
        ["./dir-bar", "./real-symlink-dir-foo"],
        ["./missing", "./dir-foo/symlink-dir-missing"],
        // error is thrown if destination path exists
        ["./dir-foo", "./real-alpha/real-beta"],
    ])("should create broken symlink dir using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(3);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureLink") {
            await function_(sourcePath, destinationPath);
        } else {
            function_(sourcePath, destinationPath);
        }

        const destinationDirectory = dirname(destinationPath);
        const destinationBasename = basename(destinationPath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const isSymlink = lstatSync(destinationPath).isSymbolicLink();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryContents = readdirSync(destinationDirectory);

        expect(isSymlink).toBeTruthy();
        expect(destinationDirectoryContents).include(destinationBasename);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(() => readdirSync(destinationPath)).toThrow(Error);
    });

    it.each([
        ["./dir-bar", "./real-symlink-dir-foo"],
        ["./missing", "./dir-foo/symlink-dir-missing"],
        // error is thrown if destination path exists
        ["./dir-foo", "./real-alpha/real-beta"],
    ])("should return error when creating symlink dir using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(1);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsBefore = existsSync(dirname(destinationPath));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureLink") {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            await expect(() => function_(sourcePath, destinationPath)).rejects.toThrow(Error);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            expect(() => function_(sourcePath, destinationPath)).toThrow(Error);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsAfter = existsSync(dirname(destinationPath));

        expect(destinationDirectoryExistsBefore).toStrictEqual(destinationDirectoryExistsAfter);
    });
});
