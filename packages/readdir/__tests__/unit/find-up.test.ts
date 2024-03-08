import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// eslint-disable-next-line import/no-extraneous-dependencies
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import findUp from "../../src/find-up";
import findUpSync from "../../src/find-up-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const testName = {
    barDirectory: "bar",
    baz: "baz.js",
    directoryLink: "directory-link",
    dotDirectory: ".git",
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
relative.baz = join(relative.fixtureDirectory, testName.baz);
relative.qux = join(relative.fixtureDirectory, testName.qux);
relative.barDirQux = join(relative.fixtureDirectory, testName.fooDirectory, testName.barDirectory, testName.qux);
relative.barDir = join(relative.fixtureDirectory, testName.fooDirectory, testName.barDirectory);

const absolute: Record<string, string> = {
    packageDirectory: join(__dirname, "..", ".."),
};
absolute.packageJson = join(absolute.packageDirectory, testName.packageJson);
absolute.fixtureDirectory = join(absolute.packageDirectory, testName.fixtureDirectory, testName.packageDirectory);
absolute.baz = join(absolute.fixtureDirectory, testName.baz);
absolute.qux = join(absolute.fixtureDirectory, testName.qux);
absolute.fooDir = join(absolute.fixtureDirectory, testName.fooDirectory);
absolute.barDir = join(absolute.fixtureDirectory, testName.fooDirectory, testName.barDirectory);
absolute.barDirQux = join(absolute.fixtureDirectory, testName.fooDirectory, testName.barDirectory, testName.qux);
absolute.fileLink = join(absolute.fixtureDirectory, testName.fileLink);
absolute.directoryLink = join(absolute.fixtureDirectory, testName.directoryLink);
absolute.dotDirectory = join(__dirname, testName.dotDirectory);

describe.each([
    ["findUp", findUp],
    ["findUpSync", findUpSync],
])("%s", (name: string, function_) => {
    let distribution: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should find child file", async () => {
        expect.assertions(1);

        let foundPath = function_(testName.packageJson);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.packageJson);
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

        let foundPath = function_(testName.packageJson, { type: "file" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toStrictEqual(absolute.packageJson);

        foundPath = function_(testName.packageJson, { type: "directory" });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "findUp") {
            foundPath = await foundPath;
        }

        expect(foundPath).toBeUndefined();
    });

    // eslint-disable-next-line vitest/no-commented-out-tests
    // it.runIf(!isWindows)("should support symbolic links", async () => {
    //     expect.assertions(4);
    //
    //     const cwd = absolute.fixtureDirectory;
    //
    //     let foundPath = await function_(testName.fileLink, { cwd });
    //
    //     // eslint-disable-next-line vitest/no-conditional-in-test
    //     if (name === "findUp") {
    //         foundPath = await foundPath;
    //     }
    //
    //     expect(foundPath).toStrictEqual(absolute.fileLink);
    //
    //     foundPath = await function_(testName.fileLink, { cwd, followSymlinks: false });
    //
    //     // eslint-disable-next-line vitest/no-conditional-in-test
    //     if (name === "findUp") {
    //         foundPath = await foundPath;
    //     }
    //
    //     expect(foundPath).toBeUndefined();
    //
    //     foundPath = await function_(testName.directoryLink, { cwd, type: "directory" });
    //
    //     // eslint-disable-next-line vitest/no-conditional-in-test
    //     if (name === "findUp") {
    //         foundPath = await foundPath;
    //     }
    //
    //     expect(foundPath).toStrictEqual(absolute.directoryLink);
    //
    //     foundPath = await function_(testName.directoryLink, { cwd, followSymlinks: false, type: "directory" });
    //
    //     // eslint-disable-next-line vitest/no-conditional-in-test
    //     if (name === "findUp") {
    //         foundPath = await foundPath;
    //     }
    //
    //     expect(foundPath).toBeUndefined();
    // });
});
