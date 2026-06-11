import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { resolve } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { walk, walkSync } from "../../../src";
import type { WalkEntry, WalkOptions } from "../../../src/types";

const MATCH_X_RE = /x$/;
const MATCH_Y_RE = /y$/;
const MATCH_Z_RE = /z$/;

const fixture = resolve(fileURLToPath(import.meta.url), "../../../../__fixtures__/walk");

const getEntries = async (root: string, options?: WalkOptions): Promise<WalkEntry[]> => {
    const entries: WalkEntry[] = [];

    for await (const entry of walk(root, options)) {
        entries.push(entry);
    }

    return entries;
};

const assertWalkPaths = async (rootPath: string, expectedPaths: string[], options?: WalkOptions): Promise<void> => {
    const root = resolve(fixture, rootPath);
    const entries = await getEntries(root, options);

    const result = expectedPaths.map((path) => resolve(root, path));

    expect(entries.map(({ path }) => path)).toStrictEqual(expect.arrayContaining(result));
    expect(entries).toHaveLength(result.length);
};

describe(walk, () => {
    it("should return a valid WalkEntry with correct properties and methods", async () => {
        expect.assertions(6);

        const root = resolve(fixture, "single_file");

        for await (const entry of await walk(root)) {
            if (entry.isFile()) {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(entry.isFile()).toBe(true);
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(entry.isDirectory()).toBe(false);
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(entry.isSymbolicLink()).toBe(false);
            } else {
                // Directory entry checks
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(entry.isFile()).toBe(false);
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(entry.isDirectory()).toBe(true);
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(entry.isSymbolicLink()).toBe(false);
            }
        }
    });

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
            match: [MATCH_X_RE, MATCH_Y_RE],
        });
    });

    it("should accepts ext option as glob", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", ["x", "y"], {
            match: ["**/x", "**/y"],
        });
    });

    it("should accepts skip option as regExps", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", [".", "z"], {
            skip: [MATCH_X_RE, MATCH_Y_RE],
        });
    });

    it("should accepts skip option as glob", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", [".", "z"], {
            skip: ["**/x", "**/y"],
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

        await expect(getEntries(root)).rejects.toThrow("ENOENT");
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
            match: [MATCH_X_RE],
            skip: [MATCH_Y_RE, MATCH_Z_RE],
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
            match: ["**/[xy]"],
        });
    });

    it("should handle complex glob patterns in skip option", async () => {
        expect.assertions(2);

        await assertWalkPaths("match", [".", "z"], {
            skip: ["**/[xy]"],
        });
    });

    it("should not crash on symlinks pointing to files with default options", async () => {
        expect.hasAssertions();

        const temporaryDirectory = resolve(fixture, "_tmp_symlink_file_test");

        await mkdir(resolve(temporaryDirectory, "subdir"), { recursive: true });
        await writeFile(resolve(temporaryDirectory, "real-file.txt"), "hello");
        await symlink(resolve(temporaryDirectory, "real-file.txt"), resolve(temporaryDirectory, "link-to-file.txt"));
        await writeFile(resolve(temporaryDirectory, "subdir", "nested.txt"), "world");

        try {
            // Default options: followSymlinks=false, includeSymlinks=true
            // This should NOT throw ENOTDIR when encountering a symlink to a file
            const entries = await getEntries(temporaryDirectory);

            const paths = entries.map(({ path }) => path);

            expect(paths).toContain(resolve(temporaryDirectory, "subdir"));
            expect(paths).toContain(resolve(temporaryDirectory, "real-file.txt"));
            // The symlink entry should be yielded but not recursed into
            expect(paths).toContain(resolve(temporaryDirectory, "link-to-file.txt"));
        } finally {
            await rm(temporaryDirectory, { recursive: true });
        }
    });

    it("should not crash on symlinks pointing to files with includeFiles=false", async () => {
        expect.hasAssertions();

        const temporaryDirectory = resolve(fixture, "_tmp_symlink_nofiles_test");

        await mkdir(resolve(temporaryDirectory, "subdir"), { recursive: true });
        await writeFile(resolve(temporaryDirectory, "real-file.txt"), "hello");
        await symlink(resolve(temporaryDirectory, "real-file.txt"), resolve(temporaryDirectory, "link-to-file.txt"));

        try {
            // includeFiles=false with default includeSymlinks=true
            // Should not crash when the symlink points to a file
            const entries = await getEntries(temporaryDirectory, { includeFiles: false });

            const paths = entries.map(({ path }) => path);

            expect(paths).toContain(resolve(temporaryDirectory));
            expect(paths).toContain(resolve(temporaryDirectory, "subdir"));
            // Symlink to file should still be yielded (includeSymlinks is true)
            expect(paths).toContain(resolve(temporaryDirectory, "link-to-file.txt"));
        } finally {
            await rm(temporaryDirectory, { recursive: true });
        }
    });

    it("walkSync should not crash on symlinks pointing to files", () => {
        expect.hasAssertions();

        const temporaryDirectory = resolve(fixture, "_tmp_symlink_sync_test");

        mkdirSync(resolve(temporaryDirectory, "subdir"), { recursive: true });
        writeFileSync(resolve(temporaryDirectory, "real-file.txt"), "hello");
        symlinkSync(resolve(temporaryDirectory, "real-file.txt"), resolve(temporaryDirectory, "link-to-file.txt"));

        try {
            const entries: WalkEntry[] = [];

            for (const entry of walkSync(temporaryDirectory)) {
                entries.push(entry);
            }

            const paths = entries.map(({ path }) => path);

            expect(paths).toContain(resolve(temporaryDirectory, "subdir"));
            expect(paths).toContain(resolve(temporaryDirectory, "real-file.txt"));
            expect(paths).toContain(resolve(temporaryDirectory, "link-to-file.txt"));
        } finally {
            rmSync(temporaryDirectory, { recursive: true });
        }
    });

    it("should expose entry type methods on a yielded symlink entry", async () => {
        expect.assertions(3);

        const temporaryDirectory = resolve(fixture, "_tmp_symlink_methods_test");

        await mkdir(temporaryDirectory, { recursive: true });
        await writeFile(resolve(temporaryDirectory, "real-file.txt"), "hello");
        await symlink(resolve(temporaryDirectory, "real-file.txt"), resolve(temporaryDirectory, "link-to-file.txt"));

        try {
            const entries = await getEntries(temporaryDirectory, { includeSymlinks: true });
            const symlinkEntry = entries.find((entry) => entry.path === resolve(temporaryDirectory, "link-to-file.txt"));

            // Invoking the lazy type predicates exercises the symlink-entry closures.
            expect(symlinkEntry?.isSymbolicLink()).toBe(true);
            expect(symlinkEntry?.isFile()).toBe(false);
            expect(symlinkEntry?.isDirectory()).toBe(false);
        } finally {
            await rm(temporaryDirectory, { recursive: true });
        }
    });

    it("should resolve a directory symlink target when followSymlinks is true", async () => {
        expect.assertions(2);

        const temporaryDirectory = resolve(fixture, "_tmp_follow_symlink_dir_test");

        await mkdir(resolve(temporaryDirectory, "real-dir"), { recursive: true });
        await writeFile(resolve(temporaryDirectory, "real-dir", "inner.txt"), "hello");
        await symlink(resolve(temporaryDirectory, "real-dir"), resolve(temporaryDirectory, "link-to-dir"));

        try {
            const entries = await getEntries(temporaryDirectory, { followSymlinks: true });
            const paths = entries.map(({ path }) => path);

            // With followSymlinks the link is resolved to its real directory target and recursed into.
            expect(paths).toContain(resolve(temporaryDirectory, "real-dir", "inner.txt"));
            // The resolved real target appears (the symlink path itself is replaced by realpath).
            expect(paths.some((path) => path.endsWith("inner.txt"))).toBe(true);
        } finally {
            await rm(temporaryDirectory, { recursive: true });
        }
    });

    it("should yield a file symlink target when followSymlinks is true", async () => {
        expect.assertions(2);

        const temporaryDirectory = resolve(fixture, "_tmp_follow_symlink_file_test");

        await mkdir(temporaryDirectory, { recursive: true });
        await writeFile(resolve(temporaryDirectory, "real-file.txt"), "hello");
        await symlink(resolve(temporaryDirectory, "real-file.txt"), resolve(temporaryDirectory, "link-to-file.txt"));

        try {
            const entries = await getEntries(temporaryDirectory, { followSymlinks: true });
            const paths = entries.map(({ path }) => path);

            // Regression: previously the resolved file was silently dropped because the
            // original dirent (a symlink) reported isFile() === false after realpath().
            expect(paths).toContain(resolve(temporaryDirectory, "real-file.txt"));
            // The real file is yielded once for itself and once via the resolved symlink
            // (the symlink path is replaced by its realpath when followSymlinks is true).
            expect(paths.filter((path) => path.endsWith("real-file.txt"))).toHaveLength(2);
        } finally {
            await rm(temporaryDirectory, { recursive: true });
        }
    });

    it("should not loop forever on a self-referencing directory symlink when followSymlinks is true", async () => {
        expect.assertions(1);

        const temporaryDirectory = resolve(fixture, "_tmp_follow_symlink_cycle_test");

        await mkdir(resolve(temporaryDirectory, "real-dir"), { recursive: true });
        await writeFile(resolve(temporaryDirectory, "real-dir", "inner.txt"), "hello");
        // A symlink inside real-dir pointing back at real-dir would loop forever
        // without cycle detection.
        await symlink(resolve(temporaryDirectory, "real-dir"), resolve(temporaryDirectory, "real-dir", "loop"));

        try {
            const entries = await getEntries(temporaryDirectory, { followSymlinks: true });
            const paths = entries.map(({ path }) => path);

            expect(paths).toContain(resolve(temporaryDirectory, "real-dir", "inner.txt"));
        } finally {
            await rm(temporaryDirectory, { recursive: true });
        }
    });

    it("should skip a symlink entry when includeSymlinks is false and followSymlinks is false", async () => {
        expect.assertions(2);

        const temporaryDirectory = resolve(fixture, "_tmp_skip_symlink_test");

        await mkdir(temporaryDirectory, { recursive: true });
        await writeFile(resolve(temporaryDirectory, "real-file.txt"), "hello");
        await symlink(resolve(temporaryDirectory, "real-file.txt"), resolve(temporaryDirectory, "link-to-file.txt"));

        try {
            const entries = await getEntries(temporaryDirectory, { followSymlinks: false, includeSymlinks: false });
            const paths = entries.map(({ path }) => path);

            expect(paths).toContain(resolve(temporaryDirectory, "real-file.txt"));
            expect(paths).not.toContain(resolve(temporaryDirectory, "link-to-file.txt"));
        } finally {
            await rm(temporaryDirectory, { recursive: true });
        }
    });

    it("walkSync should expose entry type methods on a yielded symlink entry", () => {
        expect.assertions(3);

        const temporaryDirectory = resolve(fixture, "_tmp_symlink_methods_sync_test");

        mkdirSync(temporaryDirectory, { recursive: true });
        writeFileSync(resolve(temporaryDirectory, "real-file.txt"), "hello");
        symlinkSync(resolve(temporaryDirectory, "real-file.txt"), resolve(temporaryDirectory, "link-to-file.txt"));

        try {
            const entries: WalkEntry[] = [];

            for (const entry of walkSync(temporaryDirectory, { includeSymlinks: true })) {
                entries.push(entry);
            }

            const symlinkEntry = entries.find((entry) => entry.path === resolve(temporaryDirectory, "link-to-file.txt"));

            expect(symlinkEntry?.isSymbolicLink()).toBe(true);
            expect(symlinkEntry?.isFile()).toBe(false);
            expect(symlinkEntry?.isDirectory()).toBe(false);
        } finally {
            rmSync(temporaryDirectory, { recursive: true });
        }
    });
});
