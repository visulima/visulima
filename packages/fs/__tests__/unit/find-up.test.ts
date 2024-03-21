import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FIND_UP_STOP } from "../../src/constants";
import findUp from "../../src/find/find-up";
import findUpSync from "../../src/find/find-up-sync";

const isWindows = process.platform === "win32";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const testName = {
    barDirectory: "bar",
    baz: "baz.js",
    directoryLink: "directory-link",
    dotDirectory: ".git2",
    fileLink: "file-link",
    fixtureDirectory: "__fixtures__",
    fooDirectory: "foo",
    modulesDirectory: "node_modules",
    packageDirectory: "find-up",
    packageJson: "package.json",
    qux: "qux.js",
};

// These paths are relative to the project root
const relative: Record<string, string> = {
    fixtureDirectory: testName.fixtureDirectory,
    modulesDirectory: testName.modulesDirectory,
};
relative.baz = join(relative.fixtureDirectory, testName.packageDirectory, testName.baz);
relative.qux = join(relative.fixtureDirectory, testName.packageDirectory, testName.qux);
relative.barDirQux = join(relative.fixtureDirectory, testName.packageDirectory, testName.fooDirectory, testName.barDirectory, testName.qux);
relative.barDir = join(relative.fixtureDirectory, testName.packageDirectory, testName.fooDirectory, testName.barDirectory);

const absolute: Record<string, string> = {
    packageDirectory: join(__dirname, "..", ".."),
};
absolute.fixtureDirectory = join(absolute.packageDirectory, testName.fixtureDirectory, testName.packageDirectory);
absolute.packageJson = join(absolute.fixtureDirectory, testName.packageJson);
absolute.baz = join(absolute.fixtureDirectory, testName.baz);
absolute.qux = join(absolute.fixtureDirectory, testName.qux);
absolute.fooDir = join(absolute.fixtureDirectory, testName.fooDirectory);
absolute.barDir = join(absolute.fixtureDirectory, testName.fooDirectory, testName.barDirectory);
absolute.barDirQux = join(absolute.fixtureDirectory, testName.fooDirectory, testName.barDirectory, testName.qux);
absolute.fileLink = join(absolute.fixtureDirectory, testName.fileLink);
absolute.directoryLink = join(absolute.fixtureDirectory, testName.directoryLink);
absolute.dotDirectory = join(absolute.fixtureDirectory, testName.dotDirectory);

describe.each([
    ["findUp", findUp],
    ["findUpSync", findUpSync],
])("%s", (name: string, function_) => {
    // eslint-disable-next-line unicorn/prevent-abbreviations
    let tempDir: string;

    beforeEach(async () => {
        tempDir = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true });
    });

    it("should find child file", async () => {
        expect.assertions(1);

        let foundPath = function_(testName.packageJson);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(join(__dirname, "..", "..", "package.json"));
    });

    it("should find child directory", async () => {
        expect.assertions(1);

        let foundPath = function_(testName.fixtureDirectory, { type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(join(absolute.packageDirectory, testName.fixtureDirectory));
    });

    it("should find explicit type file", async () => {
        expect.assertions(2);

        let foundPath = function_(testName.packageJson);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(join(__dirname, "..", "..", "package.json"));

        foundPath = function_(testName.packageJson, { type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toBeUndefined();
    });

    it("should find a dot file", async () => {
        expect.assertions(1);

        let foundPath = function_(testName.dotDirectory, { cwd: absolute.fixtureDirectory, type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.dotDirectory);
    });

    it("should handle absolute directory", async () => {
        expect.assertions(1);

        let foundPath = function_(absolute.barDir, { cwd: tempDir, type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.barDir);
    });

    it.each([
        [testName.packageJson, { cwd: temporaryDirectory() }], // custom cwd
        ["somenonexistentfile.js"],
        [resolve("somenonexistentfile.js")], // absolute path
        [testName.baz, { cwd: relative.barDir, stopAt: absolute.fooDir }], // cousin file, custom cwd with stopAt
    ])("should return a undefined if no %s file is found", async (path, options) => {
        expect.assertions(1);

        let foundPath = function_(path, options);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toBeUndefined();
    });

    it("should find a ancestor directory", async () => {
        expect.assertions(1);

        let foundPath = function_(absolute.fixtureDirectory, { cwd: relative.barDir, type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.fixtureDirectory);
    });

    it("should find a cousin directory with cwd", async () => {
        expect.assertions(1);

        let foundPath = function_(absolute.barDir, { cwd: relative.fixtureDirectory, type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.barDir);
    });

    it("should find a nested descendant directory with cwd", async () => {
        expect.assertions(1);

        let foundPath = function_(absolute.barDir, { cwd: relative.modulesDirectory, type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.barDir);
    });

    it("should find a nested descendant directory", async () => {
        expect.assertions(1);

        let foundPath = function_(absolute.barDir, { type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.barDir);
    });

    it("should find a nested descendant file", async () => {
        expect.assertions(1);

        let foundPath = function_(relative.baz, { cwd: join(__dirname, "..", "..") });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(join(__dirname, "..", "..", relative.baz));
    });

    it("should support finding a cousin file", async () => {
        expect.assertions(1);

        let foundPath = function_(testName.baz, { cwd: relative.barDir });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.baz);
    });

    it("should support finding a cousin file with the stopAt option equals to foundPath", async () => {
        expect.assertions(1);

        let foundPath = function_(testName.baz, { cwd: relative.barDir, stopAt: absolute.baz });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.baz);
    });

    it.each([
        [["fake", testName.baz], { cwd: join(relative.fixtureDirectory, testName.packageDirectory) }, absolute.baz], // second child file
        [[testName.qux, testName.baz], { cwd: join(relative.fixtureDirectory, testName.packageDirectory) }, absolute.qux], // first child file
        [[testName.baz], { cwd: join(relative.fixtureDirectory, testName.packageDirectory) }, absolute.baz], // first child file
    ])("should support a string array as it input", async (path, options, expected) => {
        expect.assertions(1);

        let foundPath = function_(path, options);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(expected);
    });

    // eslint-disable-next-line vitest/no-disabled-tests
    it.runIf(!isWindows).skip("should support symbolic links", async () => {
        expect.assertions(4);

        const cwd = absolute.fixtureDirectory;

        let foundPath = await function_(testName.fileLink, { cwd });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.fileLink);

        foundPath = await function_(testName.fileLink, { cwd, followSymlinks: false });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toBeUndefined();

        foundPath = await function_(testName.directoryLink, { cwd, type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.directoryLink);

        foundPath = await function_(testName.directoryLink, { cwd, followSymlinks: false, type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toBeUndefined();
    });

    it.each([
        [
            (directory: string): string => {
                expect(directory).toStrictEqual(absolute.fixtureDirectory);

                return directory;
            },
            { cwd: absolute.fixtureDirectory, type: "directory" },
            absolute.fixtureDirectory,
            2,
        ],
        [() => ".", { cwd: absolute.fixtureDirectory, type: "directory" }, absolute.fixtureDirectory],
        // [async (): Promise<string> => 'package.json', { cwd: absolute.fixtureDirectory }, join(absolute.fixtureDirectory, "package.json")],
        [() => "..", { cwd: absolute.fixtureDirectory, type: "directory" }, join(absolute.fixtureDirectory, "..")],
        [
            (directory: string) => (directory === absolute.fixtureDirectory ? undefined : ""),
            { cwd: absolute.fixtureDirectory, type: "directory" },
            join(absolute.fixtureDirectory, ".."),
        ],
        [
            (directory: string) => (directory === absolute.fixtureDirectory ? "package.json" : undefined),
            { cwd: absolute.fixtureDirectory },
            absolute.packageJson,
        ],
    ])("should handle a matcher function", async (path, options, expected, assertions = 1) => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(assertions);

        let foundPath = function_(path, options);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(expected);
    });

    it("should should throw a error if it happens in matcher", async () => {
        expect.assertions(3);

        const visited = new Set<string>();

        const matcher = (directory: string) => {
            visited.add(directory);

            throw new Error("Some rejection");
        };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            await expect(() => function_(matcher, { cwd: absolute.fixtureDirectory })).rejects.toThrow("Some rejection");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect,@typescript-eslint/no-unsafe-return
            expect(() => function_(matcher, { cwd: absolute.fixtureDirectory })).toThrow("Some rejection");
        }

        expect(visited).toStrictEqual(new Set([absolute.fixtureDirectory]));
        expect(visited.size).toBe(1);
    });

    it("should should stop early if FIND_UP_STOP in matcher is return", async () => {
        expect.assertions(3);

        const visited = new Set<string>();

        const matcher = (directory: string): typeof FIND_UP_STOP => {
            visited.add(directory);

            return FIND_UP_STOP;
        };

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(function_(matcher, { cwd: absolute.fixtureDirectory })).resolves.toBeUndefined();
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(function_(matcher, { cwd: absolute.fixtureDirectory })).toBeUndefined();
        }

        expect(visited).toStrictEqual(new Set([absolute.fixtureDirectory]));
        expect(visited.size).toBe(1);
    });
});
