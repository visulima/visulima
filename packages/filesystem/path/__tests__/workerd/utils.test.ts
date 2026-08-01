/**
 * Platform-detection and URL-helper portability specs for `workerd`.
 *
 * The interesting cases here are the ones where `process` is only partially
 * present: workerd exposes a `process` shim behind `nodejs_compat`, bundlers
 * frequently inject a stub such as `{ platform: "browser" }`, and sandboxed
 * runtimes can expose `process.cwd` while making the call itself throw. None of
 * those shapes may crash a path library.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { isAbsolute, resolve, sep as separator } from "../../src/path";
import { filename, isBinaryPath, isRelative, isWindows, normalizeAliases, resolveAlias, reverseResolveAlias, toPath } from "../../src/utils";

describe("workerd isWindows", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("reports false on the stock workerd runtime", () => {
        expect.assertions(1);

        // workerd reports `process.platform === "linux"` even when the host is
        // Windows or macOS, so path behaviour must never key off the host OS.
        expect(isWindows()).toBe(false);
    });

    it("reports false when there is no process global at all", () => {
        expect.assertions(1);

        vi.stubGlobal("process", undefined);

        expect(isWindows()).toBe(false);
    });

    it("does not throw when process exists without an env object", () => {
        expect.assertions(1);

        // A bare `{}` is what minimal bundler/runtime shims provide.
        vi.stubGlobal("process", {});

        expect(isWindows()).toBe(false);
    });

    it("does not throw when process reports a platform but has no env object", () => {
        expect.assertions(1);

        vi.stubGlobal("process", { platform: "linux" });

        expect(isWindows()).toBe(false);
    });

    it("honours a stubbed win32 platform", () => {
        expect.assertions(2);

        vi.stubGlobal("process", { env: {}, platform: "win32" });

        expect(isWindows()).toBe(true);

        vi.stubGlobal("process", { env: {}, platform: "cygwin" });

        expect(isWindows()).toBe(true);
    });

    it("honours the OSTYPE escape hatch", () => {
        expect.assertions(2);

        vi.stubGlobal("process", { env: { OSTYPE: "msys" }, platform: "linux" });

        expect(isWindows()).toBe(true);

        vi.stubGlobal("process", { env: { OSTYPE: "darwin" }, platform: "linux" });

        expect(isWindows()).toBe(false);
    });
});

describe("workerd platform independence", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps POSIX behaviour even when the platform claims win32", () => {
        expect.assertions(3);

        vi.stubGlobal("process", { cwd: () => String.raw`C:\Windows\path\only`, env: {}, platform: "win32" });

        // `sep` is a module constant and is POSIX by contract on every platform.
        expect(separator).toBe("/");
        expect(resolve("/foo", "bar")).toBe("/foo/bar");
        expect(resolve("a")).toBe("C:/Windows/path/only/a");
    });

    it("falls back to the root when the runtime has no cwd function", () => {
        expect.assertions(2);

        vi.stubGlobal("process", { env: {}, platform: "linux" });

        expect(resolve("a", "b")).toBe("/a/b");
        expect(isAbsolute(resolve("a", "b"))).toBe(true);
    });

    /**
     * Sandboxed runtimes (workerd behind some flag combinations, Deno without
     * `--allow-sys`) expose `process.cwd` but throw when it is called. `resolve()`
     * already documents that it "handles relative paths to be safe (might happen
     * when process.cwd() fails)" — so the failure must be absorbed, not rethrown.
     */
    it("falls back to the root when cwd() throws", () => {
        expect.assertions(2);

        vi.stubGlobal("process", {
            cwd: () => {
                throw new Error("Not implemented");
            },
            env: {},
            platform: "linux",
        });

        expect(() => resolve("a", "b")).not.toThrow();
        expect(resolve("a", "b")).toBe("/a/b");
    });

    it("falls back to the root when cwd() returns a non-string", () => {
        expect.assertions(1);

        vi.stubGlobal("process", { cwd: () => undefined, env: {}, platform: "linux" });

        expect(resolve("a", "b")).toBe("/a/b");
    });
});

describe("workerd toPath", () => {
    it("converts a file URL to a POSIX path", () => {
        expect.assertions(2);

        expect(toPath(new URL("file:///srv/foo/bar.txt"))).toBe("/srv/foo/bar.txt");
        expect(toPath("/srv/foo/bar.txt")).toBe("/srv/foo/bar.txt");
    });

    it("percent-decodes file URLs", () => {
        expect.assertions(1);

        expect(toPath(new URL("file:///srv/a%20b/c.txt"))).toBe("/srv/a b/c.txt");
    });

    it("folds backslashes in plain string input", () => {
        expect.assertions(1);

        expect(toPath(String.raw`C:\foo\bar.txt`)).toBe("C:/foo/bar.txt");
    });
});

describe("workerd utils helpers", () => {
    it("extracts filenames", () => {
        expect.assertions(3);

        expect(filename("/foo/bar/baz.txt")).toBe("baz");
        expect(filename(String.raw`C:\foo\bar.tar.gz`)).toBe("bar.tar");
        expect(filename("")).toBeUndefined();
    });

    it("detects binary extensions", () => {
        expect.assertions(2);

        expect(isBinaryPath("/foo/bar.png")).toBe(true);
        expect(isBinaryPath("/foo/bar.ts")).toBe(false);
    });

    it("detects relative paths", () => {
        expect.assertions(3);

        expect(isRelative("./foo")).toBe(true);
        expect(isRelative("..")).toBe(true);
        expect(isRelative("/foo")).toBe(false);
    });

    it("normalises and resolves aliases", () => {
        expect.assertions(3);

        const aliases = normalizeAliases({ "@": "/root", "~": "/root/index.js" });

        expect(aliases).toStrictEqual({ "@": "/root", "~": "/root/index.js" });
        expect(resolveAlias("@/foo/bar", aliases)).toBe("/root/foo/bar");
        expect(reverseResolveAlias("/root/foo/bar", aliases)).toBe("@/foo/bar");
    });
});
