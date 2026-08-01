/**
 * Runtime-portability suite executed inside `workerd` (the Cloudflare Workers
 * runtime) via `@cloudflare/vitest-pool-workers`.
 *
 * `@visulima/path` advertises itself as a runtime-agnostic, always-POSIX
 * drop-in for `node:path`. These specs pin that promise down on a runtime that
 * has no real working directory, reports `process.platform` as `"linux"`
 * regardless of the host OS, and only exposes `node:*` builtins behind the
 * `nodejs_compat` compatibility flag.
 */
import { describe, expect, it } from "vitest";

import defaultExport, { posix, win32 } from "../../src/index";
import {
    basename,
    delimiter,
    dirname,
    extname,
    format,
    isAbsolute,
    join,
    matchesGlob,
    normalize,
    parse,
    relative,
    resolve,
    sep as separator,
    toNamespacedPath,
} from "../../src/path";

describe("workerd runtime", () => {
    it("runs inside workerd and not on the host platform", () => {
        expect.assertions(2);

        const workerNavigator = Reflect.get(globalThis, "navigator") as { userAgent?: string } | undefined;

        expect(workerNavigator?.userAgent).toBe("Cloudflare-Workers");
        // workerd always reports "linux" no matter what the host OS is.
        expect(process.platform).toBe("linux");
    });

    it("resolves the `node:url` import site that `src/utils.ts` depends on", async () => {
        expect.assertions(2);

        const nodeUrl = await import("node:url");

        expect(nodeUrl.fileURLToPath).toBeTypeOf("function");
        expect(nodeUrl.fileURLToPath(new URL("file:///srv/a.txt"))).toBe("/srv/a.txt");
    });

    it("resolves the `node:path` import site that `src/index.ts` types against", async () => {
        expect.assertions(1);

        const nodePath = await import("node:path");

        expect(nodePath.join).toBeTypeOf("function");
    });
});

describe("workerd path constants", () => {
    it("forces the POSIX separator and delimiter", () => {
        expect.assertions(2);

        expect(separator).toBe("/");
        expect(delimiter).toBe(":");
    });
});

describe("workerd join", () => {
    it("joins and normalises POSIX segments", () => {
        expect.assertions(4);

        expect(join("a", "b")).toBe("a/b");
        expect(join("/foo", "bar", "baz/asdf", "quux", "..")).toBe("/foo/bar/baz/asdf");
        expect(join("foo", "", "bar")).toBe("foo/bar");
        expect(join("/a/", "/b/", "/c")).toBe("/a/b/c");
    });

    it("folds backslash input into POSIX form", () => {
        expect.assertions(2);

        expect(join(String.raw`C:\foo`, "bar")).toBe("C:/foo/bar");
        expect(join(String.raw`foo\bar`, "baz")).toBe("foo/bar/baz");
    });

    it("returns the current directory for an empty join", () => {
        expect.assertions(1);

        expect(join()).toBe(".");
    });
});

describe("workerd normalize", () => {
    it("collapses redundant segments", () => {
        expect.assertions(4);

        expect(normalize("/foo/bar//baz/asdf/quux/..")).toBe("/foo/bar/baz/asdf");
        expect(normalize("")).toBe(".");
        expect(normalize("./")).toBe("./");
        expect(normalize("foo/../../bar")).toBe("../bar");
    });

    it("keeps UNC and drive roots intact", () => {
        expect.assertions(2);

        expect(normalize("//server/share")).toBe("//server/share");
        expect(normalize("C:\\work\\\\foo\\bar\\..\\")).toBe("C:/work/foo/");
    });
});

describe("workerd resolve", () => {
    it("resolves absolute inputs without consulting the working directory", () => {
        expect.assertions(3);

        expect(resolve("/foo/bar", "./baz")).toBe("/foo/bar/baz");
        expect(resolve("/foo/bar", "/srv/file/")).toBe("/srv/file");
        expect(resolve("C:/foo", "bar")).toBe("C:/foo/bar");
    });

    /**
     * `resolve()` with only relative segments is the one call that needs a real
     * `process.cwd()`. workerd has no working directory of its own, so the
     * documented contract is: never throw, never interpolate `undefined`, and
     * always hand back an absolute POSIX path — falling back to the `"/"` root
     * when the runtime cannot supply a cwd.
     */
    it("returns an absolute path for relative-only segments", () => {
        expect.assertions(4);

        const resolved = resolve("a", "b");

        expect(resolved).toBeTypeOf("string");
        expect(isAbsolute(resolved)).toBe(true);
        expect(resolved).not.toContain("undefined");
        expect(resolved.endsWith("/a/b")).toBe(true);
    });

    it("returns an absolute path when called with no arguments at all", () => {
        expect.assertions(3);

        const resolved = resolve();

        expect(resolved).toBeTypeOf("string");
        expect(isAbsolute(resolved)).toBe(true);
        expect(resolved).not.toContain("undefined");
    });

    it("collapses a bare drive to its drive root", () => {
        expect.assertions(1);

        expect(resolve("C:/temp/..")).toBe("C:/");
    });
});

describe("workerd relative", () => {
    it("computes relative paths between absolute paths", () => {
        expect.assertions(3);

        expect(relative("/data/orandea/test/aaa", "/data/orandea/impl/bbb")).toBe("../../impl/bbb");
        expect(relative("/a/b/c", "/a/b/c")).toBe("");
        expect(relative("/a/b", "/a/b/c/d")).toBe("c/d");
    });

    it("returns the target verbatim across differing drive letters", () => {
        expect.assertions(1);

        expect(relative("C:/a/b", "D:/c/d")).toBe("D:/c/d");
    });
});

describe("workerd dirname", () => {
    it("returns the parent directory", () => {
        expect.assertions(4);

        expect(dirname("/foo/bar/baz/asdf/quux")).toBe("/foo/bar/baz/asdf");
        expect(dirname("/foo")).toBe("/");
        expect(dirname("foo")).toBe(".");
        expect(dirname("C:/temp/file.txt")).toBe("C:/temp");
    });
});

describe("workerd basename", () => {
    it("returns the trailing segment", () => {
        expect.assertions(3);

        expect(basename("/foo/bar/baz/asdf/quux.html")).toBe("quux.html");
        expect(basename("/foo/bar/baz/asdf/quux.html", ".html")).toBe("quux");
        expect(basename(String.raw`C:\foo\bar.txt`)).toBe("bar.txt");
    });
});

describe("workerd extname", () => {
    it("returns the trailing extension", () => {
        expect.assertions(4);

        expect(extname("index.html")).toBe(".html");
        expect(extname("index.coffee.md")).toBe(".md");
        expect(extname("/path/to/file.tar.gz")).toBe(".gz");
        expect(extname("index")).toBe("");
    });
});

describe("workerd isAbsolute", () => {
    it("classifies POSIX, UNC and drive-letter paths", () => {
        expect.assertions(5);

        expect(isAbsolute("/foo/bar")).toBe(true);
        expect(isAbsolute("//server")).toBe(true);
        expect(isAbsolute("C:/foo")).toBe(true);
        expect(isAbsolute("bar/baz")).toBe(false);
        expect(isAbsolute(".")).toBe(false);
    });
});

describe("workerd parse and format", () => {
    it("parses a path into its components", () => {
        expect.assertions(1);

        expect(parse("/home/user/dir/file.txt")).toStrictEqual({
            base: "file.txt",
            dir: "/home/user/dir",
            ext: ".txt",
            name: "file",
            root: "/",
        });
    });

    it("round-trips parse into format", () => {
        expect.assertions(1);

        const parsed = parse("/home/user/dir/file.txt");

        expect(format({ base: parsed.base, dir: parsed.dir })).toBe("/home/user/dir/file.txt");
    });

    it("formats from root, name and ext", () => {
        expect.assertions(2);

        expect(format({ base: "file.txt", root: "/" })).toBe("/file.txt");
        expect(format({ ext: ".txt", name: "file" })).toBe("file.txt");
    });
});

describe("workerd toNamespacedPath", () => {
    it("folds a namespaced Windows path into POSIX form", () => {
        expect.assertions(2);

        expect(toNamespacedPath(String.raw`C:\foo\bar`)).toBe("C:/foo/bar");
        expect(toNamespacedPath("/foo/bar")).toBe("/foo/bar");
    });
});

describe("workerd matchesGlob", () => {
    it("matches globs through the bundled matcher", () => {
        expect.assertions(2);

        expect(matchesGlob("/foo/bar.js", "**/*.js")).toBe(true);
        expect(matchesGlob("/foo/bar.ts", "**/*.js")).toBe(false);
    });
});

describe("workerd posix and win32 namespaces", () => {
    it("aliases both namespaces onto the same POSIX implementation", () => {
        expect.assertions(3);

        expect(posix).toBe(win32);
        expect(posix.sep).toBe("/");
        expect(win32.sep).toBe("/");
    });

    it("produces identical output from both namespaces", () => {
        expect.assertions(3);

        expect(win32.join("a", "b")).toBe("a/b");
        expect(posix.join("a", "b")).toBe("a/b");
        expect(win32.normalize(String.raw`a\b\..\c`)).toBe("a/c");
    });

    it("exposes the same implementation through the default export", () => {
        expect.assertions(2);

        expect(defaultExport.sep).toBe("/");
        expect(defaultExport.join("a", "b")).toBe("a/b");
    });
});
