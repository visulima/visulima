/**
 * A modified version from `https://github.com/unjs/pathe/blob/main/test/index.spec.ts`
 *
 * MIT License
 * Copyright (c) Pooya Parsa &lt;pooya@pi0.io> - Daniel Roe &lt;daniel@roe.dev>
 */
import { describe, expect, it } from "vitest";

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
]);

describe("resolve with catastrophic process.cwd() failure", () => {
    it("still works", () => {
        expect.assertions(2);

        const originalCwd = process.cwd;

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
    it("delimiter should equal : on linux and ; on windows", () => {
        expect.assertions(1);

        expect(delimiter).toBe(/^win/i.test(globalThis.process.platform) ? ";" : ":");
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
