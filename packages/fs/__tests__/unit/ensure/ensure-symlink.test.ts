import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";

import { basename, dirname, join, relative, resolve } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ensureFile from "../../../src/ensure/ensure-file";
import ensureSymlink from "../../../src/ensure/ensure-symlink";
import ensureSymlinkSync from "../../../src/ensure/ensure-symlink-sync";

const distribution: string = temporaryDirectory();
const isWindows = process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);

describe.each([
    ["ensureSymlink", ensureSymlink],
    ["ensureSymlinkSync", ensureSymlinkSync],
])("%s", (name, function_) => {
    beforeEach(async () => {
        writeFileSync("./sym-foo.txt", "foo\n");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(resolve(join(distribution, "./sym-foo.txt")), "sym-foo\n");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(resolve(join(distribution, "./sym-dir-foo")), { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(resolve(join(distribution, "./sym-dir-foo/foo.txt")), "sym-foo\n");

        mkdirSync("./sym-empty-dir", { recursive: true });

        mkdirSync("./sym-dir-foo", { recursive: true });
        writeFileSync("./sym-dir-foo/foo.txt", "sym-dir-foo\n");

        mkdirSync("./sym-dir-bar", { recursive: true });
        writeFileSync("./sym-dir-bar/bar.txt", "sym-dir-bar\n");

        mkdirSync("./sym-real-alpha/real-beta/real-gamma", { recursive: true });

        symlinkSync("./sym-foo.txt", "./sym-real-symlink.txt", isWindows ? "junction" : null);
        symlinkSync("./sym-dir-foo", "./sym-real-symlink-dir-foo", isWindows ? "junction" : null);
    });

    afterEach(async () => {
        // eslint-disable-next-line no-loops/no-loops
        for await (const directory of [
            "./sym-foo.txt",
            "./sym-link-foo.txt",
            "./sym-real-symlink.txt",
            "./sym-real-symlink-dir-foo",
            "./sym-symlink-dir-foo",
            "./sym-symlink.txt",
            "./sym-empty-dir",
            "./sym-dir-foo",
            "./sym-dir-bar",
            "./sym-real-alpha",
            "./sym-alpha",
        ]) {
            try {
                await rm(directory, { recursive: true });
            } catch {
                /* empty */
            }
        }
    });

    // @TODO: Fix the following tests on windows
    it.skipIf(isWindows).each([
        ["./sym-foo.txt", "./sym-symlink.txt"],
        ["./sym-foo.txt", "./sym-dir-foo/symlink.txt"],
        ["./sym-foo.txt", "./sym-empty-dir/symlink.txt"],
        ["./sym-foo.txt", "./sym-real-alpha/symlink.txt"],
        ["./sym-foo.txt", "./sym-real-alpha/real-beta/symlink.txt"],
        ["./sym-foo.txt", "./sym-real-alpha/real-beta/real-gamma/symlink.txt"],
        ["./sym-foo.txt", "./sym-alpha/symlink.txt"],
        ["./sym-foo.txt", "./sym-alpha/beta/symlink.txt"],
        ["./sym-foo.txt", "./sym-alpha/beta/gamma/symlink.txt"],
        ["./sym-foo.txt", "./sym-link-foo.txt"],
        ["./sym-foo.txt", "./sym-symlink.txt"],
        ["./sym-dir-foo/foo.txt", "./sym-symlink.txt"],
        [resolve(join(distribution, "./sym-foo.txt")), resolve(join(distribution, "./sym-symlink.txt"))],
        [resolve(join(distribution, "./sym-dir-foo/foo.txt")), resolve(join(distribution, "./sym-symlink-2.txt"))],
    ])("should create symlink file using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(4);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(sourcePath)).toBe(true);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
            await function_(sourcePath, destinationPath);
        } else {
            function_(sourcePath, destinationPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const sourceContent = readFileSync(sourcePath, "utf8");
        const destinationDirectory = dirname(destinationPath);
        const destinationBasename = basename(destinationPath);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(lstatSync(destinationPath).isSymbolicLink()).toBe(true);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(sourceContent).toStrictEqual(readFileSync(destinationPath, "utf8"));

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readdirSync(destinationDirectory)).contains(destinationBasename);
    });

    it.each([
        ["./sym-missing.txt", "./sym-symlink.txt"],
        ["../foo.txt", "./sym-symlink.txt"],
        ["../dir-foo/foo.txt", "./sym-symlink.txt"],
        ["./sym-missing.txt", "./sym-symlink.txt"],
        ["./sym-missing.txt", "./sym-missing-dir/symlink.txt"],
        ["./sym-dir-foo/foo.txt", "./sym-real-symlink.txt"],
        // error is thrown if destination path exists
        ["./sym-foo.txt", "./sym-dir-foo/foo.txt"],
        [resolve(join(distribution, "./sym-missing.txt")), resolve(join(distribution, "./sym-symlink.txt"))],
        [resolve(join(distribution, "../foo.txt")), resolve(join(distribution, "./sym-symlink.txt"))],
        [resolve(join(distribution, "../dir-foo/foo.txt")), resolve(join(distribution, "./sym-symlink.txt"))],
    ])("should return error when creating symlink file using src %s and dst %s", async (sourcePath, destinationPath) => {
        expect.assertions(2);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsBefore = existsSync(dirname(destinationPath));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
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

    it.each([
        ["./sym-dir-foo", "./sym-symlink-dir-foo"],
        ["./sym-dir-bar", "./sym-dir-foo/symlink-dir-bar"],
        ["./sym-dir-bar", "./sym-empty-dir/symlink-dir-bar"],
        ["./sym-dir-bar", "./sym-real-alpha/symlink-dir-bar"],
        ["./sym-dir-bar", "./sym-real-alpha/real-beta/symlink-dir-bar"],
        ["./sym-dir-bar", "./sym-real-alpha/real-beta/real-gamma/symlink-dir-bar"],
        ["./sym-dir-foo", "./sym-alpha/dir-foo"],
        ["./sym-dir-foo", "./sym-alpha/beta/dir-foo"],
        ["./sym-dir-foo", "./sym-alpha/beta/gamma/dir-foo"],
        ["./sym-dir-foo", "./sym-real-symlink-dir-foo"],
    ])("should create symlink dir using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(3);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
            await function_(sourcePath, destinationPath);
        } else {
            function_(sourcePath, destinationPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const sourceContents = readdirSync(sourcePath);
        const destinationDirectory = dirname(destinationPath);
        const destinationBasename = basename(destinationPath);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(lstatSync(destinationPath).isSymbolicLink()).toBe(true);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(sourceContents).toStrictEqual(readdirSync(destinationPath));
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readdirSync(destinationDirectory)).include(destinationBasename);
    });

    it.each([
        ["./sym-dir-bar", "./sym-real-symlink-dir-foo"],
        ["./sym-missing", "./sym-dir-foo/symlink-dir-missing"],
        // error is thrown if destination path exists
        ["./sym-dir-foo", "./sym-real-alpha/real-beta"],
    ])("should create broken symlink dir using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(sourcePath, destinationPath)).rejects.toThrow(Error);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(sourcePath, destinationPath)).toThrow(Error);
        }
    });

    it.each([
        ["./sym-dir-bar", "./sym-real-symlink-dir-foo"],
        ["./sym-missing", "./sym-dir-foo/symlink-dir-missing"],
        // error is thrown if destination path exists
        ["./sym-dir-foo", "./sym-real-alpha/real-beta"],
    ])("should return error when creating symlink dir using source %s and destination %s", async (sourcePath, destinationPath) => {
        expect.assertions(2);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const destinationDirectoryExistsBefore = existsSync(dirname(destinationPath));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
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

    it("can create a symbolic link twice when the target exists", async () => {
        expect.assertions(5);

        // a directory with a file, as `destination` or `target`
        const targetDirectory = join(distribution, "target-directory");
        const targetFileName = "target-file";
        const targetDirectoryFile = join(targetDirectory, targetFileName);

        await ensureFile(targetDirectoryFile);
        // a directory to put the symbolic link in (the `source`)
        const linkDirectory = join(distribution, "link-directory");
        const symbolicLinkPath = join(linkDirectory, "link");
        const targetFileViaSymbolicLink = join(symbolicLinkPath, targetFileName);
        const relativeSymbolicLinkReference = relative(dirname(symbolicLinkPath), targetDirectory);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(targetDirectoryFile)).toBe(true);

        // first time, setting up with a relative reference
        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
            await function_(relativeSymbolicLinkReference, symbolicLinkPath);
        } else {
            function_(relativeSymbolicLinkReference, symbolicLinkPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(symbolicLinkPath)).toBe(true);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(targetFileViaSymbolicLink)).toBe(true);

        // second time, setting up with an absolute reference
        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
            await function_(targetDirectory, symbolicLinkPath);
        } else {
            function_(targetDirectory, symbolicLinkPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(symbolicLinkPath)).toBe(true);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(targetFileViaSymbolicLink)).toBe(true);
    });

    it("can ensure a symbolic link a second time with a relative path", async () => {
        expect.assertions(5);

        // a directory with a file, as `destination` or `target`
        const targetDirectory = join(distribution, "target-directory");
        const targetFileName = "target-file";
        const targetDirectoryFile = join(targetDirectory, targetFileName);

        await ensureFile(targetDirectoryFile);
        // a directory to put the symbolic link in (the `source`)
        const linkDirectory = join(distribution, "link-directory");
        const symbolicLinkPath = join(linkDirectory, "link");
        const targetFileViaSymbolicLink = join(symbolicLinkPath, targetFileName);
        const relativeSymbolicLinkReference = relative(dirname(symbolicLinkPath), targetDirectory);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(targetDirectoryFile)).toBe(true);

        // first time, setting up with a relative reference
        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
            await function_(relativeSymbolicLinkReference, symbolicLinkPath);
        } else {
            function_(relativeSymbolicLinkReference, symbolicLinkPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(symbolicLinkPath)).toBe(true);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(targetFileViaSymbolicLink)).toBe(true);

        // second time, setting up with an absolute reference
        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "ensureSymlink") {
            await function_(relativeSymbolicLinkReference, symbolicLinkPath);
        } else {
            function_(relativeSymbolicLinkReference, symbolicLinkPath);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(symbolicLinkPath)).toBe(true);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(existsSync(targetFileViaSymbolicLink)).toBe(true);
    });
});
