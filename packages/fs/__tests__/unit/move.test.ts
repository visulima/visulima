import fs, { readFileSync, statSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";

import { dirname, join, resolve } from "@visulima/path";
import { temporaryDirectory, temporaryFile, temporaryWriteSync } from "tempy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { move, moveSync, rename, renameSync } from "../../src/move";

const fixtureFileContent = "test content";

describe.each([
    ["moveFileSync", moveSync],
    ["moveFile", move],
])("%s", (_, function_) => {
    let distribution: string;
    let distributionFile: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
        distributionFile = join(distribution, "file.txt");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await writeFile(distributionFile, fixtureFileContent, "utf8");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should move a file", async () => {
        expect.assertions(1);

        const destination = temporaryFile();

        await function_(distributionFile, destination);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(destination, "utf8")).toBe(fixtureFileContent);
    });

    it("should move a file across devices", async () => {
        expect.assertions(1);

        const exdevError = new Error("exdevError") as Error & { code: "EXDEV" };

        exdevError.code = "EXDEV";

        const originalRenameSync = fs.renameSync;

        vi.spyOn(fs, "renameSync").mockImplementation(() => {
            throw exdevError;
        });

        const destination = temporaryFile();

        await function_(distributionFile, destination);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(destination, "utf8")).toBe(fixtureFileContent);

        fs.renameSync = originalRenameSync;
    });

    it("should throw an error if overwriting is not allowed", async () => {
        expect.assertions(1);

        try {
            await function_(join(distribution, "x"), join(distribution, "y"), { overwrite: false });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error.message).toContain("ENOENT: no such file or directory, rename");
        }
    });

    it("should move a file with the `cwd` option", async () => {
        expect.assertions(1);

        const destination = temporaryFile();

        await function_(distributionFile, "unicorn-dir/unicorn.txt", { cwd: destination });

        const movedFile = resolve(destination, "unicorn-dir/unicorn.txt");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(movedFile, "utf8")).toBe(fixtureFileContent);
    });

    it("should set the `directoryMode` option correctly", async () => {
        expect.assertions(1);

        const root = temporaryDirectory();
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        const directory = `${root}/dir`;
        const destination = `${directory}/file`;
        const directoryMode = 0o700;

        await function_(distributionFile, destination, { directoryMode });

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const stat = statSync(directory);

        // eslint-disable-next-line no-bitwise
        expect(stat.mode & directoryMode).toBe(directoryMode);
    });
});

describe.each([
    ["renameFileSync", renameSync],
    ["renameFile", rename],
])("%s", (_, function_) => {
    let distribution: string;
    let distributionFile: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
        distributionFile = join(distribution, "file.txt");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await writeFile(distributionFile, fixtureFileContent, "utf8");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    it("should rename a file", async () => {
        expect.assertions(1);

        const file = temporaryWriteSync(fixtureFileContent, { name: "unicorn.txt" });
        const directory = dirname(file);
        const renamedFile = resolve(directory, "unicorns.txt");

        await function_(file, "unicorns.txt", { cwd: directory });

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(readFileSync(renamedFile, "utf8")).toBe(fixtureFileContent);
    });

    it("should throw an error if renaming to a different directory", async () => {
        expect.assertions(1);

        const file = temporaryWriteSync(distributionFile, { name: "unicorn.txt" });
        const directory = dirname(file);
        const renamedFile = resolve(directory, "dir2/unicorns.txt");

        try {
            await function_(file, renamedFile);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error.message).toBe("`source` and `destination` must be in the same directory");
        }
    });
});
