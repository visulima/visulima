import { existsSync, mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { platform } from "node:process";

import { ensureDirSync, writeJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findCacheDir as findCacheDirectory, findCacheDirSync as findCacheDirectorySync } from "../../src";

const isWindows = platform === "win32";

const restoreXdg = (previous: string | undefined): void => {
    if (previous === undefined) {
        delete process.env.XDG_CACHE_HOME;
    } else {
        process.env.XDG_CACHE_HOME = previous;
    }
};

describe("options", () => {
    let distribution: string;

    beforeEach(() => {
        delete process.env.CACHE_DIR;
        distribution = mkdtempSync(join(tmpdir(), "find-cache-dir-options-"));
    });

    afterEach(async () => {
        delete process.env.CACHE_DIR;
        await rm(distribution, { force: true, recursive: true });
    });

    describe("thunk option", () => {
        it("returns a function that joins paths onto the resolved cache directory (async)", async () => {
            expect.assertions(2);

            const packageDirectory = join(distribution, "package");

            ensureDirSync(join(packageDirectory, "node_modules", ".cache", "test"));
            writeJsonSync(join(packageDirectory, "package.json"), { name: "test" });

            const thunk = await findCacheDirectory("test", { cwd: packageDirectory, thunk: true });

            expect(thunk).toBeTypeOf("function");
            expect(thunk?.("manifest.json")).toStrictEqual(join(packageDirectory, "node_modules", ".cache", "test", "manifest.json"));
        });

        it("returns a function that joins paths onto the resolved cache directory (sync)", () => {
            expect.assertions(2);

            const packageDirectory = join(distribution, "package");

            ensureDirSync(join(packageDirectory, "node_modules", ".cache", "test"));
            writeJsonSync(join(packageDirectory, "package.json"), { name: "test" });

            const thunk = findCacheDirectorySync("test", { cwd: packageDirectory, thunk: true });

            expect(thunk).toBeTypeOf("function");
            expect(thunk?.("a", "b")).toStrictEqual(join(packageDirectory, "node_modules", ".cache", "test", "a", "b"));
        });

        it("returns undefined when no cache directory could be resolved", async () => {
            expect.assertions(1);

            const result = await findCacheDirectory("nope", { cwd: "/this_dir_will_never_exist", thunk: true });

            expect(result).toBeUndefined();
        });
    });

    describe("files option", () => {
        it.skipIf(isWindows)("resolves the cache near the common ancestor of the given files", async () => {
            expect.assertions(1);

            const packageDirectory = join(distribution, "workspace", "pkg");

            ensureDirSync(join(packageDirectory, "node_modules"));
            ensureDirSync(join(packageDirectory, "src"));
            writeJsonSync(join(packageDirectory, "package.json"), { name: "test" });

            const result = await findCacheDirectory("test", {
                files: [join(packageDirectory, "src", "a.ts"), join(packageDirectory, "src", "nested", "b.ts")],
            });

            expect(result).toStrictEqual(join(packageDirectory, "node_modules", ".cache", "test"));
        });

        it.skipIf(isWindows)("accepts URL entries", () => {
            expect.assertions(1);

            const packageDirectory = join(distribution, "workspace2", "pkg");

            ensureDirSync(join(packageDirectory, "node_modules"));
            ensureDirSync(join(packageDirectory, "src"));
            writeJsonSync(join(packageDirectory, "package.json"), { name: "test" });

            const result = findCacheDirectorySync("test", {
                files: [new URL(`file://${join(packageDirectory, "src", "a.ts")}`), new URL(`file://${join(packageDirectory, "src", "b.ts")}`)],
            });

            expect(result).toStrictEqual(join(packageDirectory, "node_modules", ".cache", "test"));
        });
    });

    describe("useGlobalCacheFallback option", () => {
        it("falls back to the OS user cache directory when no package.json is found (async)", async () => {
            expect.assertions(1);

            const result = await findCacheDirectory("my-tool", {
                cwd: "/this_dir_will_never_exist",
                useGlobalCacheFallback: true,
            });

            expect(result).toContain("my-tool");
        });

        it("falls back to the OS user cache directory when no package.json is found (sync)", () => {
            expect.assertions(1);

            const result = findCacheDirectorySync("my-tool", {
                cwd: "/this_dir_will_never_exist",
                useGlobalCacheFallback: true,
            });

            expect(result).toContain("my-tool");
        });

        it.skipIf(isWindows || platform === "darwin")("honours $XDG_CACHE_HOME on Linux", async () => {
            expect.assertions(1);

            const previous = process.env.XDG_CACHE_HOME;

            process.env.XDG_CACHE_HOME = distribution;

            try {
                const result = await findCacheDirectory("xdg-tool", {
                    cwd: "/this_dir_will_never_exist",
                    useGlobalCacheFallback: true,
                });

                expect(result).toStrictEqual(join(distribution, "xdg-tool"));
            } finally {
                restoreXdg(previous);
            }
        });

        it.skipIf(isWindows || platform === "darwin" || homedir() === "")("defaults to ~/.cache on Linux without XDG_CACHE_HOME", async () => {
            expect.assertions(1);

            const previous = process.env.XDG_CACHE_HOME;

            delete process.env.XDG_CACHE_HOME;

            try {
                const result = await findCacheDirectory("home-tool", {
                    cwd: "/this_dir_will_never_exist",
                    useGlobalCacheFallback: true,
                });

                expect(result).toStrictEqual(join(homedir(), ".cache", "home-tool"));
            } finally {
                restoreXdg(previous);
            }
        });

        it("creates the global cache directory when create + useGlobalCacheFallback are set", async () => {
            expect.assertions(2);

            const previous = process.env.XDG_CACHE_HOME;

            process.env.XDG_CACHE_HOME = join(distribution, "xdg");

            try {
                const result = await findCacheDirectory("created-tool", {
                    create: true,
                    cwd: "/this_dir_will_never_exist",
                    useGlobalCacheFallback: true,
                });

                expect(result).toBeDefined();
                expect(existsSync(result as string)).toBe(true);
            } finally {
                restoreXdg(previous);
            }
        });
    });

    describe("create option (async non-blocking)", () => {
        it("creates the cache directory asynchronously", async () => {
            expect.assertions(2);

            const packageDirectory = join(distribution, "create-async");

            ensureDirSync(join(packageDirectory, "node_modules"));
            writeJsonSync(join(packageDirectory, "package.json"), { name: "test" });

            const target = join(packageDirectory, "node_modules", ".cache", "test");

            const result = await findCacheDirectory("test", { create: true, cwd: packageDirectory });

            expect(result).toStrictEqual(target);
            expect(existsSync(target)).toBe(true);
        });
    });
});
