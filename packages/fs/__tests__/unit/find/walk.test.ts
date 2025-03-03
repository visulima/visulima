import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { resolve } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { walk } from "../../../src";
import type { WalkEntry, WalkOptions } from "../../../src/types";

const fixture = resolve(fileURLToPath(import.meta.url), "../../../../__fixtures__/walk");

const getEntries = async (root: string, options?: WalkOptions): Promise<WalkEntry[]> => {
    const entries: WalkEntry[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const entry of walk(root, options)) {
        entries.push(entry);
    }

    return entries;
};

const assertWalkPaths = async (rootPath: string, expectedPaths: string[], options?: WalkOptions): Promise<void> => {
    const root = resolve(fixture, rootPath);
    const entries = await getEntries(root, options);

    const result = expectedPaths.map((path) => resolve(root, path) as string);

    expect(entries.map(({ path }) => path)).toStrictEqual(expect.arrayContaining(result));
    expect(entries).toHaveLength(result.length);
};

const isWindows = process.platform === "win32" || /^(?:msys|cygwin)$/.test(<string>process.env.OSTYPE);

describe("walk", () => {
    it("should return a valid WalkEntry with correct properties and methods", async () => {
        expect.assertions(6);

        const root = resolve(fixture, "single_file");

        for await (const entry of await walk(root)) {
            if (entry.isFile()) {
                expect(entry.isFile()).toBeTruthy();
                expect(entry.isDirectory()).toBeFalsy();
                expect(entry.isSymbolicLink()).toBeFalsy();
            } else {
                // Directory entry checks
                expect(entry.isFile()).toBeFalsy();
                expect(entry.isDirectory()).toBeTruthy();
                expect(entry.isSymbolicLink()).toBeFalsy();
            }
        }
    });

    it("should return current dir for empty dir", async () => {
        expect.assertions(2);

        // eslint-disable-next-line unicorn/prevent-abbreviations
        const emptyDir = resolve(fixture, "empty_dir");
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await mkdir(emptyDir);

        try {
            await assertWalkPaths("empty_dir", ["."]);
        } finally {
            await rm(emptyDir, { recursive: true });
        }
    });

    it("should return current dir and single file", async () => {
        expect.assertions(2);

        await assertWalkPaths("single_file", [".", "x"]);
    });

    it("should return current dir, subdir, and nested file", async () => {
        expect.assertions(2);

        await assertWalkPaths("nested_single_file", [".", "a", "a/x"]);
    });

    it("should accepts maxDepth option", async () => {
        expect.assertions(2);

        await assertWalkPaths("depth", [".", "a", "a/b", "a/b/c"], { maxDepth: 3 });
    });

    it("should accepts includeDirs option set to false", async () => {
        expect.assertions(2);

        await assertWalkPaths("depth", ["a/b/c/d/x"], { includeDirs: false });
    });

    it("should accepts includeFiles option set to false", async () => {
        expect.assertions(2);

        await assertWalkPaths("depth", [".", "a", "a/b", "a/b/c", "a/b/c/d"], {
            includeFiles: false,
        });
    });

    it("should accepts ext option as strings", async () => {
        expect.assertions(2);

        await assertWalkPaths("ext", ["y.rs", "x.ts"], {
            extensions: [".rs", ".ts"],
        });
    });

    it("should accepts ext option as RegExps", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", ["x", "y"], {
            match: [/x$/, /y$/],
        });
    });

    it("should accepts ext option as glob", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", ["x", "y"], {
            match: isWindows ? ["**\\x", "**\\y"] : ["**/x", "**/y"],
        });
    });

    it("should accepts skip option as regExps", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", [".", "z"], {
            skip: [/x$/, /y$/],
        });
    });

    it("should accepts skip option as glob", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", [".", "z"], {
            skip: isWindows ? ["**\\x", "**\\y"] : ["**/x", "**/y"],
        });
    });

    it("should accepts followSymlinks option set to true", async () => {
        expect.assertions(2);

        await assertWalkPaths("symlink", [".", "a", "a/z", "a", "a/z", "x"], {
            followSymlinks: true,
        });
    });

    it("should accepts followSymlinks option set to false", async () => {
        expect.assertions(2);

        await assertWalkPaths("symlink", [".", "a", "a/z", "b", "x", "y"], {
            followSymlinks: false,
        });
    });

    it("should throw a error for non-existent root", async () => {
        expect.assertions(1);

        const root = resolve(fixture, "non_existent");

        await expect(async () => await getEntries(root)).rejects.toThrow("ENOENT");
    });

    it("should handle maxDepth of 0", async () => {
        expect.assertions(2);

        await assertWalkPaths("depth", ["."], { maxDepth: 0 });
    });

    it("should handle negative maxDepth", async () => {
        expect.assertions(2);

        await assertWalkPaths("depth", [], { maxDepth: -1 });
    });

    it("should combine includeDirs=false and includeFiles=false", async () => {
        expect.assertions(2);

        await assertWalkPaths("depth", [], {
            includeDirs: false,
            includeFiles: false,
        });
    });

    it("should handle multiple extensions correctly", async () => {
        expect.assertions(2);

        await assertWalkPaths("ext", ["x.ts", "y.rs"], {
            extensions: [".ts", ".rs", ".md"],
        });
    });

    it("should combine match and skip patterns", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", ["x"], {
            match: [/x$/],
            skip: [/y$/, /z$/],
        });
    });

    it("should normalize paths with different separators", async () => {
        expect.assertions(4);

        const root = resolve(fixture, "nested_single_file");
        const entries = await getEntries(root);

        expect(entries.length).toBeGreaterThan(0);
        entries.forEach((entry) => {
            expect(entry.path).not.toContain("\\");
        });
    });

    it("should handle symlinks with followSymlinks=true and includeSymlinks=false", async () => {
        expect.assertions(2);

        await assertWalkPaths("symlink", [".", "a", "a/z", "b", "x", "y"], {
            followSymlinks: true,
            includeSymlinks: false,
        });
    });

    it("should handle complex glob patterns in match option", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", ["x", "y"], {
            match: isWindows ? ["**\\[xy]"] : ["**/[xy]"],
        });
    });

    it("should handle complex glob patterns in skip option", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", [".", "z"], {
            skip: isWindows ? ["**\\[xy]"] : ["**/[xy]"],
        });
    });
});
