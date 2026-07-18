/**
 * A modified version from `https://github.com/unjs/pathe/blob/main/test/index.spec.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa &lt;pooya@pi0.io> - Daniel Roe &lt;daniel@roe.dev>
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import normalizeWindowsPath from "../../src/normalize-windows-path";
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
    normalizeString,
    parse,
    relative,
    resolve,
    sep as separator,
    toNamespacedPath,
} from "../../src/path";
import { runTest } from "../helpers";

runTest("normalizeWindowsPath", normalizeWindowsPath, {
    ".\\foo\\bar": "./foo/bar",

    // POSIX
    "/foo/bar": "/foo/bar",
    "\\foo\\bar": "/foo/bar",
    // Windows
    "c:\\foo\\bar": "C:/foo/bar",
});

runTest("isAbsolute", isAbsolute, {
    ".": false,
    "//server": true,
    "/baz/..": true,
    // POSIX
    "/foo/bar": true,

    "\\\\server": true,
    "bar/baz": false,
    "bar\\baz": false,
    // Windows
    "C:": false,
    "C:.": false,
    "C:.\\temp\\": false,
    "C:/": true,
    "C:/foo/..": true,
    "quax/": false,
});

// @ts-expect-error - TODO: fix typing
runTest("normalizeString", normalizeString, {
    "./foo/be/bar/../ab/test": "foo/be/ab/test",
    "./foobar/../a": "a",
    "/a/../": "",
    "/a/./": "a",
    // POSIX
    "/foo/bar": "foo/bar",
    "/foo/bar/../..well-known/baz": "foo/..well-known/baz",
    "/foo/bar/.././baz": "foo/baz",
    "/foo/bar/../.well-known/baz": "foo/.well-known/baz",
    // './foobar./../a/./': 'a',

    [normalizeWindowsPath("C:\\a\\..\\")]: "C:",
    [normalizeWindowsPath(String.raw`.\myfile.html`)]: "myfile.html",
    [normalizeWindowsPath(String.raw`\temp\myfile.html`)]: "temp/myfile.html",
    [normalizeWindowsPath(String.raw`C:\temp\..\..well-known\Users`)]: "C:/..well-known/Users",
    [normalizeWindowsPath(String.raw`C:\temp\..\.\Users`)]: "C:/Users",
    [normalizeWindowsPath(String.raw`C:\temp\..\.well-known\Users`)]: "C:/.well-known/Users",
    // Windows
    [normalizeWindowsPath(String.raw`C:\temp\..`)]: "C:",
    [normalizeWindowsPath(String.raw`C:\temp\myfile.html`)]: "C:/temp/myfile.html",
});

runTest("basename", basename, [
    // POSIX
    ["/temp/myfile.html", "myfile.html"],
    ["./myfile.html", "myfile.html"],
    ["./myfile.html", ".html", "myfile"],
    ["./undefined", undefined, "undefined"],

    // When the extension equals the *entire path argument*, Node returns "".
    ["test.html", "test.html", ""],
    // But when the basename is reached via a directory, an extension that
    // matches the whole basename leaves it untouched instead of returning "".
    ["/foo/test.html", "test.html", "test.html"],
    ["a/xtest.html", "test.html", "x"],

    // Windows
    [String.raw`C:\temp\myfile.html`, "myfile.html"],
    [String.raw`\temp\myfile.html`, "myfile.html"],
    [String.raw`.\myfile.html`, "myfile.html"],
    [String.raw`.\myfile.html`, ".html", "myfile"],
    [String.raw`.\undefined`, undefined, "undefined"],
]);

runTest("dirname", dirname, {
    "./myfile.html": ".",
    ".\\myfile.html": ".",
    "/temp/": "/",
    "/temp/myfile.html": "/temp",

    "\\temp\\myfile.html": "/temp",
    "C:.\\temp\\": "C:.",
    "C:.\\temp\\bar\\": "C:./temp",
    // Windows
    "C:\\temp\\": "C:/",
    "C:\\temp\\myfile.html": "C:/temp",
    // POSIX
    "test.html": ".",
});

runTest("extname", extname, {
    ".": "",
    "..": "",

    "..foo": ".foo",
    "./": "",
    "./myfile.html": ".html",
    ".\\myfile.html": ".html",
    ".foo": "",
    // A dotfile addressed through a directory has no extension (matches
    // node:path); the separator must not satisfy the required leading char.
    "/x/.gitignore": "",
    "a/.foo": "",
    "src/.env": "",
    ".\\dir\\.env": "",
    // POSIX
    "/temp/myfile.html": ".html",
    // '...': '.', // TODO: Edge case behavior of Node?

    "\\temp\\myfile.html": ".html",
    // Windows
    "C:\\temp\\myfile.html": ".html",
    "foo.123": ".123",
});

// @ts-expect-error - TODO: fix typing
runTest("format", format, [
    // POSIX
    [{ base: "file.txt", dir: "/home/user/dir", root: "/ignored" }, "/home/user/dir/file.txt"],
    [{ base: "file.txt", ext: "ignored", root: "/" }, "/file.txt"],
    [{ ext: ".txt", name: "file", root: "/" }, "/file.txt"],
    [{ ext: ".txt", name: "file" }, "file.txt"],

    // Missing name/ext must not leak the string "undefined" (regression for
    // `(name as string) + (ext as string)` producing e.g. "fooundefined").
    [{ dir: "/a", name: "foo" }, "/a/foo"],
    [{ dir: "/a", ext: ".txt" }, "/a/.txt"],
    [{ name: "foo" }, "foo"],
    [{ ext: ".txt" }, ".txt"],

    // format is pure concatenation like node:path: ".." segments are kept and a
    // relative dir is not absolutized by a sibling root.
    [{ base: "f", dir: "/a/..", root: "/" }, "/a/../f"],
    [{ base: "f", dir: "sub", root: "/" }, "sub/f"],

    // Windows
    [{ base: "file.txt", name: "file" }, "file.txt"],
    [{ base: "file.txt", dir: String.raw`C:\path\dir` }, "C:/path/dir/file.txt"],
]);

runTest("join", join, [
    ["."],
    [undefined, "."],
    ["", "."],
    ["./", "./"],
    ["", "/foo", "/foo"],
    ["/foo", "//bar", "/foo/bar"],
    ["/", "/path", "/path"],
    ["/test//", "//path", "/test/path"],
    ["some/nodejs/deep", "../path", "some/nodejs/path"],
    ["./some/local/unix/", "../path", "some/local/path"],
    [String.raw`./some\current\mixed`, String.raw`..\path`, "some/current/path"],
    ["../some/relative/destination", String.raw`..\path`, "../some/relative/path"],
    ["some/nodejs/deep", "../path", "some/nodejs/path"],
    ["/foo", "bar", "baz/asdf", "quux", "..", "/foo/bar/baz/asdf"],

    [String.raw`C:\foo`, "bar", String.raw`baz\asdf`, "quux", "..", "C:/foo/bar/baz/asdf"],
    [String.raw`some/nodejs\windows`, "../path", "some/nodejs/path"],
    [String.raw`some\windows\only`, String.raw`..\path`, "some/windows/path"],
    // UNC paths
    [String.raw`\\server\share\file`, String.raw`..\path`, "//server/share/path"],
    [String.raw`\\.\c:\temp\file`, String.raw`..\path`, "//./c:/temp/path"],
    [String.raw`\\server/share/file`, "../path", "//server/share/path"],
    [String.raw`//server/share/file`, "../path", "//server/share/path"],
]);

runTest("normalize", normalize, {
    // POSIX
    "": ".",
    "./": "./",
    "./../": "../",
    "./../dep/": "../dep/",
    ".//windows\\unix/mixed/": "windows/unix/mixed/",
    "./a/..": ".",
    "./a/../": "./",
    "/": "/",
    "/a/..": "/",
    "/foo/bar//baz/asdf/quux/..": "/foo/bar/baz/asdf",
    "/windows\\unix/mixed": "/windows/unix/mixed",
    "\\\\.\\c:\\temp\\file\\..\\path": "//./c:/temp/path",

    "\\\\.\\foo\\bar": "//./foo/bar",
    "\\\\C:\\foo\\bar": "//C:/foo/bar",
    "\\\\server/share/file/../path": "//server/share/path",
    // UNC
    "\\\\server\\share\\file\\..\\path": "//server/share/path",
    "\\windows//unix/mixed": "/windows/unix/mixed",
    "\\windows\\..\\unix/mixed/": "/unix/mixed/",

    "C:////temp\\\\/\\/\\/foo/bar": "C:/temp/foo/bar",
    "c:/windows/../nodejs/path": "C:/nodejs/path",

    "c:/windows/nodejs/path": "C:/windows/nodejs/path",
    // Windows
    "C:\\": "C:/",
    "C:\\temp\\..": "C:/",
    "C:\\temp\\\\foo\\bar\\..\\": "C:/temp/foo/",

    "c:\\windows\\..\\nodejs\\path": "C:/nodejs/path",
    "c:\\windows\\nodejs\\path": "C:/windows/nodejs/path",
    "happiness/a./../": "happiness/",
    "happiness/ab/../": "happiness/",
    "path//dep\\": "path/dep/",
});

// eslint-disable-next-line vitest/require-top-level-describe
it("parse", () => {
    expect.assertions(10);

    // POSIX
    expect(parse("/home/user/dir/file.txt")).toStrictEqual({
        base: "file.txt",
        dir: "/home/user/dir",
        ext: ".txt",
        name: "file",
        root: "/",
    });
    expect(parse("./dir/file")).toStrictEqual({
        base: "file",
        dir: "./dir",
        ext: "",
        name: "file",
        root: "",
    });

    // Windows
    expect(parse(String.raw`C:\path\dir\file.txt`)).toStrictEqual({
        base: "file.txt",
        dir: "C:/path/dir",
        ext: ".txt",
        name: "file",
        root: "C:/",
    });
    expect(parse(String.raw`.\dir\file`)).toStrictEqual({
        base: "file",
        dir: "./dir",
        ext: "",
        name: "file",
        root: "",
    });
    // Windows path can have spaces
    expect(parse(String.raw`C:\pa th\dir\file.txt`)).toStrictEqual({
        base: "file.txt",
        dir: "C:/pa th/dir",
        ext: ".txt",
        name: "file",
        root: "C:/",
    });
    // Test with normalized windows path
    expect(parse("C:/path/dir/file.txt")).toStrictEqual({
        base: "file.txt",
        dir: "C:/path/dir",
        ext: ".txt",
        name: "file",
        root: "C:/",
    });
    expect(parse("C:/pa th/dir/file.txt")).toStrictEqual({
        base: "file.txt",
        dir: "C:/pa th/dir",
        ext: ".txt",
        name: "file",
        root: "C:/",
    });
    // Windows path can have spaces
    expect(parse(String.raw`C:\pa th\dir\file.txt`)).toStrictEqual({
        base: "file.txt",
        dir: "C:/pa th/dir",
        ext: ".txt",
        name: "file",
        root: "C:/",
    });
    // Test with normalized windows path
    expect(parse("C:/path/dir/file.txt")).toStrictEqual({
        base: "file.txt",
        dir: "C:/path/dir",
        ext: ".txt",
        name: "file",
        root: "C:/",
    });
    expect(parse("C:/pa th/dir/file.txt")).toStrictEqual({
        base: "file.txt",
        dir: "C:/pa th/dir",
        ext: ".txt",
        name: "file",
        root: "C:/",
    });
});

runTest("relative", relative, [
    // POSIX
    ["/data/orandea/test/aaa", "/data/orandea/impl/bbb", "../../impl/bbb"],
    ["/", "/foo/bar", "foo/bar"],
    ["/foo", "/", ".."],
    [() => process.cwd(), "./dist/client/b-scroll.d.ts", "dist/client/b-scroll.d.ts"],

    // Windows
    [String.raw`C:\orandea\test\aaa`, String.raw`C:\orandea\impl\bbb`, "../../impl/bbb"],
    [String.raw`C:\orandea\test\aaa`, String.raw`c:\orandea\impl\bbb`, "../../impl/bbb"],
    ["C:\\", String.raw`C:\foo\bar`, "foo/bar"],
    // A from-path that collapses to the drive root still yields a clean relative
    // path (no spurious ".." from the "C:/" -> ["C:", ""] split).
    ["C:/temp/..", "C:/foo", "foo"],
    [String.raw`C:\foo`, "C:\\", ".."],
    [String.raw`C:\foo`, String.raw`d:\bar`, "D:/bar"],
    [() => process.cwd().replaceAll("\\", "/"), "./dist/client/b-scroll.d.ts", "dist/client/b-scroll.d.ts"],
    [() => process.cwd(), "./dist/client/b-scroll.d.ts", "dist/client/b-scroll.d.ts"],
]);

runTest("resolve", resolve, [
    // POSIX
    ["/", "/path", "/path"],
    ["/", "", undefined, null, "", "/path", "/path"],
    ["/foo/bar", "./baz", "/foo/bar/baz"],
    ["/foo/bar", "./baz", undefined, null, "", "/foo/bar/baz"],
    ["/foo/bar", "..", ".", "./baz", "/foo/baz"],
    ["/foo/bar", "/tmp/file/", "/tmp/file"],
    ["wwwroot", "static_files/png/", "../gif/image.gif", () => `${process.cwd().replaceAll("\\", "/")}/wwwroot/static_files/gif/image.gif`],

    // Windows
    [String.raw`C:\foo\bar`, String.raw`.\baz`, "C:/foo/bar/baz"],
    [String.raw`\foo\bar`, String.raw`.\baz`, "/foo/bar/baz"],
    [String.raw`\foo\bar`, "..", ".", String.raw`.\baz`, "/foo/baz"],
    [String.raw`\foo\bar`, "\\tmp\\file\\", "/tmp/file"],
    [String.raw`\foo\bar`, undefined, null, "", "\\tmp\\file\\", "/tmp/file"],
    [String.raw`\foo\bar`, undefined, null, "", "\\tmp\\file\\", undefined, null, "", "/tmp/file"],
    ["wwwroot", "static_files\\png\\", String.raw`..\gif\image.gif`, () => `${process.cwd().replaceAll("\\", "/")}/wwwroot/static_files/gif/image.gif`],
    [String.raw`C:\Windows\path\only`, "../../reports", "C:/Windows/reports"],
    [String.raw`C:\Windows\long\path\mixed/with/unix`, "../..", String.raw`..\../reports`, "C:/Windows/long/reports"],
    // Collapsing to a bare drive yields the drive root "C:/", never "/C:".
    ["C:/", "C:/"],
    [String.raw`C:\temp\..`, "C:/"],
    ["C:/temp/..", "C:/"],
    [String.raw`C:\temp`, "..", "C:/"],
]);

describe("resolve with catastrophic process.cwd() failure", () => {
    it("still works", () => {
        expect.assertions(2);

        const originalCwd = process.cwd; // eslint-disable-line @typescript-eslint/unbound-method, vitest/unbound-method

        process.cwd = () => "";

        expect(resolve(".", "./")).toBe(".");
        expect(resolve("..", "..")).toBe("../..");

        process.cwd = originalCwd;
    });
});

runTest("toNamespacedPath", toNamespacedPath, {
    // POSIX
    "/foo/bar": "/foo/bar",

    // Windows
    "\\foo\\bar": "/foo/bar",
    "C:\\foo\\bar": "C:/foo/bar",
});

describe("constants", () => {
    it("delimiter should always equal ':' (POSIX) regardless of platform", () => {
        expect.assertions(1);

        expect(delimiter).toBe(":");
    });

    it("sep should equal /", () => {
        expect.assertions(1);

        expect(separator).toBe("/");
    });
});

describe(matchesGlob, () => {
    it("should match a glob pattern", () => {
        expect.assertions(1);

        expect(matchesGlob("/foo/bar", "/foo/**")).toBe(true);
    });

    it("should not match a glob pattern", () => {
        expect.assertions(1);

        expect(matchesGlob("/foo/bar", "/bar/**")).toBe(false);
    });

    it("should match a glob pattern with String.raw input", () => {
        expect.assertions(1);

        expect(matchesGlob(String.raw`\foo\bar`, "/foo/**")).toBe(true);
    });
});

describe("normalizeString allowAboveRoot", () => {
    it("should keep leading '..' segments when result is still empty", () => {
        expect.assertions(3);

        // When allowAboveRoot is true and the accumulated result is empty, the
        // bare ".." branch (without a leading "/") is taken.
        expect(normalizeString("..", true)).toBe("..");
        expect(normalizeString("../foo", true)).toBe("../foo");
        expect(normalizeString("../../foo", true)).toBe("../../foo");
    });

    it("should drop leading '..' segments when allowAboveRoot is false", () => {
        expect.assertions(2);

        expect(normalizeString("..", false)).toBe("");
        expect(normalizeString("../foo", false)).toBe("foo");
    });
});

describe("cwd fallback in resolve", () => {
    const originalCwd = process.cwd; // eslint-disable-line @typescript-eslint/unbound-method, vitest/unbound-method

    afterEach(() => {
        process.cwd = originalCwd;
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("should fall back to '/' when process.cwd is not a function", async () => {
        expect.assertions(1);

        // Simulate a runtime where process exists but process.cwd is unavailable.
        vi.stubGlobal("process", { ...process, cwd: undefined });
        vi.resetModules();

        const { resolve: freshResolve } = await import("../../src/path");

        expect(freshResolve("foo", "bar")).toBe("/foo/bar");
    });
});

describe("lowercase drive from process.cwd()", () => {
    const originalCwd = process.cwd; // eslint-disable-line @typescript-eslint/unbound-method, vitest/unbound-method

    afterEach(() => {
        process.cwd = originalCwd;
    });

    it("should uppercase the drive letter when resolving relative inputs", () => {
        expect.assertions(1);

        process.cwd = () => String.raw`c:\Users\test`;

        expect(resolve("foo")).toBe("C:/Users/test/foo");
    });

    it("should keep relative() relative despite a lowercase cwd drive", () => {
        expect.assertions(2);

        process.cwd = () => String.raw`c:\Users\test`;

        expect(relative(".", "C:/Users/test/x")).toBe("x");
        expect(relative("C:/Users/test", "./x")).toBe("x");
    });
});

describe("delimiter platform resolution", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("should stay ':' even when the platform reports Windows", async () => {
        expect.assertions(1);

        vi.resetModules();
        vi.stubGlobal("process", { ...process, platform: "win32" });

        const pathModule = await import("../../src/path");

        // Unlike node:path, the delimiter is forced to POSIX ':' on every
        // platform so that path behaviour is consistent cross-OS (mirrors sep).
        expect(pathModule.delimiter).toBe(":");
    });

    it("should stay ':' when the platform is undefined", async () => {
        expect.assertions(1);

        vi.resetModules();
        vi.stubGlobal("process", { ...process, platform: undefined });

        const pathModule = await import("../../src/path");

        expect(pathModule.delimiter).toBe(":");
    });
});
