import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";

import { join } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import copy from "../../../src/copy/copy";
import copySync from "../../../src/copy/copy-sync";

describe.each(["copy", "copySync"])("%s", (name) => {
    let distribution: string;

    beforeEach(() => {
        distribution = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(distribution, { force: true, recursive: true });
    });

    const run = async (source: URL | string, destination: URL | string, options?: Record<string, unknown>): Promise<void> => {
        if (name === "copy") {
            await copy(source, destination, options);
        } else {
            copySync(source, destination, options);
        }
    };

    it("should copy a single file", async () => {
        expect.assertions(2);

        const source = join(distribution, "source.txt");
        const destination = join(distribution, "dest.txt");

        await writeFile(source, "hello");

        await run(source, destination);

        expect(existsSync(destination)).toBe(true);
        expect(readFileSync(destination, "utf8")).toBe("hello");
    });

    it("should copy a directory recursively", async () => {
        expect.assertions(2);

        const source = join(distribution, "src");
        const destination = join(distribution, "out");

        await mkdir(join(source, "nested"), { recursive: true });
        await writeFile(join(source, "a.txt"), "a");
        await writeFile(join(source, "nested", "b.txt"), "b");

        await run(source, destination);

        expect(readFileSync(join(destination, "a.txt"), "utf8")).toBe("a");
        expect(readFileSync(join(destination, "nested", "b.txt"), "utf8")).toBe("b");
    });

    it("should overwrite existing files by default", async () => {
        expect.assertions(1);

        const source = join(distribution, "source.txt");
        const destination = join(distribution, "dest.txt");

        await writeFile(source, "new");
        await writeFile(destination, "old");

        await run(source, destination);

        expect(readFileSync(destination, "utf8")).toBe("new");
    });

    it("should throw AlreadyExistsError when overwrite is false and the destination exists", async () => {
        expect.assertions(2);

        const source = join(distribution, "source.txt");
        const destination = join(distribution, "dest.txt");

        await writeFile(source, "new");
        await writeFile(destination, "old");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "copy") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(copy(source, destination, { overwrite: false })).rejects.toThrow("EEXIST");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => copySync(source, destination, { overwrite: false })).toThrow("EEXIST");
        }

        // Destination is unchanged
        expect(readFileSync(destination, "utf8")).toBe("old");
    });

    it("should skip existing files when overwrite is false and errorOnExist is false", async () => {
        expect.assertions(1);

        const source = join(distribution, "source.txt");
        const destination = join(distribution, "dest.txt");

        await writeFile(source, "new");
        await writeFile(destination, "old");

        await run(source, destination, { errorOnExist: false, overwrite: false });

        expect(readFileSync(destination, "utf8")).toBe("old");
    });

    it("should apply a filter to skip entries", async () => {
        expect.assertions(2);

        const source = join(distribution, "src");
        const destination = join(distribution, "out");

        await mkdir(join(source, "skip"), { recursive: true });
        await writeFile(join(source, "keep.txt"), "keep");
        await writeFile(join(source, "skip", "ignored.txt"), "ignored");

        await run(source, destination, {
            filter: (sourcePath: string) => !sourcePath.includes("skip"),
        });

        expect(existsSync(join(destination, "keep.txt"))).toBe(true);
        expect(existsSync(join(destination, "skip"))).toBe(false);
    });

    it("should throw when the path is invalid", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "copy") {
            // @ts-expect-error - testing invalid input
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(copy(null, "dest")).rejects.toThrow("Path must be a non-empty string or URL.");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => {
                // @ts-expect-error - testing invalid input
                copySync(null, "dest");
            }).toThrow("Path must be a non-empty string or URL.");
        }
    });
});
