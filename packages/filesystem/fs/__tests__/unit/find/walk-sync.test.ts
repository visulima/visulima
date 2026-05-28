import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { resolve } from "@visulima/path";
import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import walkSync from "../../../src/find/walk-sync";
import type { WalkEntry, WalkOptions } from "../../../src/types";

const MATCH_X_RE = /x$/;
const MATCH_Y_RE = /y$/;

const fixture = resolve(fileURLToPath(import.meta.url), "../../../../__fixtures__/walk");

const getEntries = (root: string, options?: WalkOptions): WalkEntry[] => {
    const entries: WalkEntry[] = [];

    for (const entry of walkSync(root, options)) {
        entries.push(entry);
    }

    return entries;
};

const assertWalkPaths = (rootPath: string, expectedPaths: string[], options?: WalkOptions): void => {
    const root = resolve(fixture, rootPath);
    const entries = getEntries(root, options);

    const result = expectedPaths.map((path) => resolve(root, path));

    expect(entries.map(({ path }) => path)).toStrictEqual(expect.arrayContaining(result));
    expect(entries).toHaveLength(result.length);
};

describe(walkSync, () => {
    it("should return current dir and single file", () => {
        expect.assertions(2);

        assertWalkPaths("single_file", [".", "x"]);
    });

    it("should return current dir, subdir, and nested file", () => {
        expect.assertions(2);

        assertWalkPaths("nested_single_file", [".", "a", "a/x"]);
    });

    it("should respect maxDepth option", () => {
        expect.assertions(2);

        assertWalkPaths("depth", [".", "a", "a/b", "a/b/c"], { maxDepth: 3 });
    });

    it("should handle maxDepth of 0", () => {
        expect.assertions(2);

        assertWalkPaths("depth", ["."], { maxDepth: 0 });
    });

    it("should handle negative maxDepth and yield nothing", () => {
        expect.assertions(2);

        assertWalkPaths("depth", [], { maxDepth: -1 });
    });

    it("should filter by includeDirs=false", () => {
        expect.assertions(2);

        assertWalkPaths("depth", ["a/b/c/d/x"], { includeDirs: false });
    });

    it("should filter by includeFiles=false", () => {
        expect.assertions(2);

        assertWalkPaths("depth", [".", "a", "a/b", "a/b/c", "a/b/c/d"], { includeFiles: false });
    });

    it("should filter by extensions", () => {
        expect.assertions(2);

        assertWalkPaths("ext", ["y.rs", "x.ts"], { extensions: [".rs", ".ts"] });
    });

    it("should accept match option as RegExp", () => {
        expect.assertions(2);

        assertWalkPaths("match", ["x", "y"], { match: [MATCH_X_RE, MATCH_Y_RE] });
    });

    it("should accept match option as glob string", () => {
        expect.assertions(2);

        assertWalkPaths("match", ["x", "y"], { match: ["**/x", "**/y"] });
    });

    it("should accept skip option as RegExp", () => {
        expect.assertions(2);

        assertWalkPaths("match", [".", "z"], { skip: [MATCH_X_RE, MATCH_Y_RE] });
    });

    it("should accept skip option as glob string", () => {
        expect.assertions(2);

        assertWalkPaths("match", [".", "z"], { skip: ["**/x", "**/y"] });
    });

    it("should throw a WalkError for non-existent root", () => {
        expect.assertions(1);

        const root = resolve(fixture, "non_existent_sync");

        expect(() => getEntries(root)).toThrow("ENOENT");
    });

    it("should throw a TypeError when given an empty path", () => {
        expect.assertions(1);

        expect(() => getEntries("")).toThrow(TypeError);
    });

    describe("symlink handling", () => {
        let temporaryDirectoryPath: string;

        beforeEach(() => {
            temporaryDirectoryPath = temporaryDirectory();
        });

        afterEach(() => {
            rmSync(temporaryDirectoryPath, { force: true, recursive: true });
        });

        it("should not crash on symlinks pointing to files (default options)", () => {
            expect.hasAssertions();

            writeFileSync(resolve(temporaryDirectoryPath, "real-file.txt"), "hello");
            symlinkSync(resolve(temporaryDirectoryPath, "real-file.txt"), resolve(temporaryDirectoryPath, "link-to-file.txt"));

            const paths = getEntries(temporaryDirectoryPath).map(({ path }) => path);

            expect(paths).toContain(resolve(temporaryDirectoryPath, "real-file.txt"));
            expect(paths).toContain(resolve(temporaryDirectoryPath, "link-to-file.txt"));
        });

        it("should skip symlinks when includeSymlinks is false and followSymlinks is false", () => {
            expect.hasAssertions();

            writeFileSync(resolve(temporaryDirectoryPath, "real-file.txt"), "hello");
            symlinkSync(resolve(temporaryDirectoryPath, "real-file.txt"), resolve(temporaryDirectoryPath, "link-to-file.txt"));

            const paths = getEntries(temporaryDirectoryPath, { followSymlinks: false, includeSymlinks: false }).map(({ path }) => path);

            expect(paths).toContain(resolve(temporaryDirectoryPath, "real-file.txt"));
            expect(paths).not.toContain(resolve(temporaryDirectoryPath, "link-to-file.txt"));
        });

        it("should resolve symlinks to directories when followSymlinks=true", () => {
            expect.hasAssertions();

            mkdirSync(resolve(temporaryDirectoryPath, "real-dir"));
            writeFileSync(resolve(temporaryDirectoryPath, "real-dir/inside.txt"), "x");
            symlinkSync(resolve(temporaryDirectoryPath, "real-dir"), resolve(temporaryDirectoryPath, "link-dir"));

            const paths = getEntries(temporaryDirectoryPath, { followSymlinks: true }).map(({ path }) => path);

            // Both the real and linked directories are visited (after realpath resolution)
            expect(paths).toContain(resolve(temporaryDirectoryPath, "real-dir/inside.txt"));
        });

        it("should mark entries with isSymbolicLink for un-followed symlinks", () => {
            expect.hasAssertions();

            writeFileSync(resolve(temporaryDirectoryPath, "target.txt"), "x");
            symlinkSync(resolve(temporaryDirectoryPath, "target.txt"), resolve(temporaryDirectoryPath, "link.txt"));

            const entries = getEntries(temporaryDirectoryPath);
            const link = entries.find((entry) => entry.name === "link.txt");

            expect(link).toBeDefined();
            expect(link?.isSymbolicLink()).toBe(true);
            expect(link?.isFile()).toBe(false);
            expect(link?.isDirectory()).toBe(false);
        });
    });

    it("should expose isFile/isDirectory/isSymbolicLink callbacks on yielded file entries", () => {
        expect.assertions(3);

        const root = resolve(fixture, "ext");
        const entries = getEntries(root, { extensions: [".ts"] });
        const file = entries.find((entry) => entry.name === "x.ts");

        expect(file?.isFile()).toBe(true);
        expect(file?.isDirectory()).toBe(false);
        expect(file?.isSymbolicLink()).toBe(false);
    });

    it("should yield a single entry shaped like WalkEntry for a file given as root", () => {
        expect.assertions(4);

        const root = resolve(fixture, "single_file");
        const entries = getEntries(root);

        const rootEntry = entries.find((entry) => entry.path === root);

        expect(rootEntry).toBeDefined();
        expect(rootEntry?.isDirectory()).toBe(true);
        expect(rootEntry?.isFile()).toBe(false);
        expect(rootEntry?.isSymbolicLink()).toBe(false);
    });

    it("should combine includeDirs=false and includeFiles=false to yield nothing", () => {
        expect.assertions(2);

        assertWalkPaths("depth", [], { includeDirs: false, includeFiles: false });
    });
});
