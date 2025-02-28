/**
 * A modified version from `https://github.com/unjs/pathe/blob/main/test/utils.spec.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa <pooya@pi0.io> - Daniel Roe <daniel@roe.dev>
 */
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { dirname, resolve } from "../../src/path";
import { filename, isBinaryPath, isRelative, normalizeAliases, resolveAlias, reverseResolveAlias, toPath } from "../../src/utils";

describe("utils", () => {
    it("toPath", () => {
        expect.assertions(2);

        const fixture = "./foo.js";

        // eslint-disable-next-line compat/compat
        expect(toPath(new URL(fixture, import.meta.url))).toStrictEqual(resolve(dirname(fileURLToPath(import.meta.url)), fixture));
        expect(toPath(fixture)).toStrictEqual(fixture);
    });

    describe("alias", () => {
        const aliases = normalizeAliases({
            "@": "/root",
            "@foo/bar": "@foo/bar/dist/index.mjs",
            "@foo/bar/utils": "@foo/bar/dist/utils.mjs",
            "~": "/root/index.js",
            "~/": "/src",
            "~win": "C:/root/index.js",
            "~win/": "C:/src",
            bingpot: "@/bingpot/index.ts",
            test: "@bingpot/index.ts",
        });

        it("normalizeAliases", () => {
            expect.assertions(1);

            expect(aliases).toMatchInlineSnapshot(`
      {
        "@": "/root",
        "@foo/bar": "@foo/bar/dist/index.mjs",
        "@foo/bar/utils": "@foo/bar/dist/utils.mjs",
        "bingpot": "/root/bingpot/index.ts",
        "test": "@bingpot/index.ts",
        "~": "/root/index.js",
        "~/": "/src",
        "~win": "C:/root/index.js",
        "~win/": "C:/src",
      }
    `);
        });

        describe("resolveAlias", () => {
            it.each(Object.entries(aliases))("should resolve alias from %s to %s", (from, to) => {
                expect.assertions(1);

                expect(resolveAlias(from, aliases)).toBe(to);
            });

            it("should respects path separators", () => {
                expect.assertions(1);

                expect(
                    resolveAlias("~assets/smth.jpg", {
                        "~": "/root",
                        "~assets": "/root/some/dir",
                    }),
                ).toMatchInlineSnapshot('"/root/some/dir/smth.jpg"');
            });

            it("should let the input unchanged", () => {
                expect.assertions(2);

                expect(resolveAlias("foo/bar.js", aliases)).toBe("foo/bar.js");
                expect(resolveAlias("./bar.js", aliases)).toBe("./bar.js");
            });

            it("should respect ending with /", () => {
                expect.assertions(2);

                expect(resolveAlias("~/foo/bar", aliases)).toBe("/src/foo/bar");
                expect(resolveAlias("~win/foo/bar", aliases)).toBe("C:/src/foo/bar");
            });
        });

        describe("reverseResolveAlias", () => {
            it.each(Object.entries(aliases))("should reverse resolve alias to %s from %s", (to, from) => {
                expect.assertions(1);

                expect(reverseResolveAlias(from, aliases)).toBe(to);
            });

            it("respects path separators", () => {
                expect.assertions(1);

                expect(
                    reverseResolveAlias("/root/some/assets/smth.jpg", {
                        "~": "/root",
                        "~assets": "/root/some/assets",
                    }),
                ).toMatchInlineSnapshot('"~assets/smth.jpg"');
            });

            it("unchanged", () => {
                expect.assertions(2);

                expect(reverseResolveAlias("foo/bar.js", aliases)).toBe("foo/bar.js");
                expect(reverseResolveAlias("./bar.js", aliases)).toBe("./bar.js");
            });

            it("respect ending with /", () => {
                expect.assertions(2);

                expect(reverseResolveAlias("/src/foo/bar", aliases)).toBe("~/foo/bar");
                expect(reverseResolveAlias("C:/src/foo/bar", aliases)).toBe("~win/foo/bar");
            });
        });
    });

    describe("filename", () => {
        it.each([
            ["./myfile.html", "myfile"],
            [".\\myfile.html", "myfile"],
            ["/temp/myfile.html", "myfile"],

            ["\\temp\\myfile.html", "myfile"],
            // Windows
            ["C:\\temp\\", undefined],
            ["C:\\temp\\myfile.html", "myfile"],
            // POSIX
            ["test.html", "test"],
        ])("should return the filename from %s", (file, expected) => {
            expect.assertions(1);

            expect(filename(file)).toStrictEqual(expected);
        });
    });

    describe("isRelative", () => {
        it("should return true for a relative path starting with './'", () => {
            expect.assertions(1);

            const path = "./example/path";
            const result = isRelative(path);

            expect(result).toBeTruthy();
        });

        it("should return true for a relative path starting with '../'", () => {
            expect.assertions(1);

            const path = "../example/path";
            const result = isRelative(path);

            expect(result).toBeTruthy();
        });

        it("should return true for a relative path with '..'", () => {
            expect.assertions(1);

            const path = "..";
            const result = isRelative(path);

            expect(result).toBeTruthy();
        });

        it("should return false for a non-relative path", () => {
            expect.assertions(1);

            const path = "/example/path";
            const result = isRelative(path);

            expect(result).toBeFalsy();
        });

        it("should return false for an empty string", () => {
            expect.assertions(1);

            const path = "";
            const result = isRelative(path);

            expect(result).toBeFalsy();
        });

        it("should return false for a path starting with a single dot", () => {
            expect.assertions(1);

            const path = ".example/path";
            const result = isRelative(path);

            expect(result).toBeFalsy();
        });

        it("should return false for a path starting with a backslash", () => {
            expect.assertions(1);

            const path = "\\example\\path";
            const result = isRelative(path);

            expect(result).toBeFalsy();
        });

        it("should return false for a path starting with a forward slash", () => {
            expect.assertions(1);

            const path = "/example/path";
            const result = isRelative(path);

            expect(result).toBeFalsy();
        });
    });

    describe("binary", () => {
        it("should return true for binary file extensions", () => {
            expect.assertions(3);

            expect(isBinaryPath("file.exe")).toBeTruthy();
            expect(isBinaryPath("file.dll")).toBeTruthy();
            expect(isBinaryPath("file.jpg")).toBeTruthy();
        });

        it("should return false for non-binary file extensions", () => {
            expect.assertions(3);

            expect(isBinaryPath("file.txt")).toBeFalsy();
            expect(isBinaryPath("file.js")).toBeFalsy();
            expect(isBinaryPath("file.css")).toBeFalsy();
        });

        it("should be case-insensitive when checking file extensions", () => {
            expect.assertions(3);

            expect(isBinaryPath("file.EXE")).toBeTruthy();
            expect(isBinaryPath("file.DLL")).toBeTruthy();
            expect(isBinaryPath("file.JPG")).toBeTruthy();
        });

        it("should work with file paths with no extension", () => {
            expect.assertions(3);

            expect(isBinaryPath("file")).toBeFalsy();
            expect(isBinaryPath("path/to/file")).toBeFalsy();
            expect(isBinaryPath("path/to/file/")).toBeFalsy();
        });

        it("should work with file paths with multiple extensions", () => {
            expect.assertions(3);

            expect(isBinaryPath("file.tar.gz")).toBeTruthy();
            expect(isBinaryPath("file.min.js")).toBeFalsy();
            expect(isBinaryPath("file.test.spec.ts")).toBeFalsy();
        });
    });
});
