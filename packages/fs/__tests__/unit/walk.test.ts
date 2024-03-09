import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { Options } from "../../src";
import { walk } from "../../src";
import type { WalkEntry } from "../../src/walk";

const fixture = resolve(fileURLToPath(import.meta.url), "../../../__fixtures__/walk");

const getEntries = async (root: string, options?: Options): Promise<WalkEntry[]> => {
    const entries: WalkEntry[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for await (const entry of walk(root, options)) {
        entries.push(entry);
    }

    return entries;
};

const assertWalkPaths = async (rootPath: string, expectedPaths: string[], options?: Options): Promise<void> => {
    const root = resolve(fixture, rootPath);
    const entries = await getEntries(root, options);

    const result = expectedPaths.map((path) => resolve(root, path));

    expect(entries).toHaveLength(result.length);
    expect(entries.map(({ path }) => path)).toStrictEqual(expect.arrayContaining(result));
};

const isWindows = process.platform === "win32";

describe("walk", () => {
    it("should return current dir for empty dir", async () => {
        expect.assertions(2);

        // eslint-disable-next-line unicorn/prevent-abbreviations
        const emptyDir = resolve(fixture, "empty_dir");
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
});
