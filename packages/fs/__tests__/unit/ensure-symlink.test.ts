import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from "vitest";
import { join, resolve } from "node:path";
import { rm } from "node:fs/promises";
import { temporaryDirectory } from "tempy";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";

describe.each([["ensureSymlink", ensureSymlink]])("%s", (name, function_) => {
    let distribution: string;

    beforeAll(() => {
        distribution = temporaryDirectory();
    });

    beforeEach(() => {
        writeFileSync("./foo.txt", "foo\n");
        mkdirSync("empty-dir", { recursive: true });
        mkdirSync("dir-foo", { recursive: true });
        writeFileSync("dir-foo/foo.txt", "dir-foo\n");
        mkdirSync("dir-bar", { recursive: true });
        writeFileSync("dir-bar/bar.txt", "dir-bar\n");
        mkdirSync("real-alpha/real-beta/real-gamma", { recursive: true });
        symlinkSync("foo.txt", "real-symlink.txt");
        symlinkSync("dir-foo", "real-symlink-dir-foo");
    });

    afterAll(async () => {
        await rm(distribution, { recursive: true });
    });

    it.each([
        // [[srcpath, dstpath], fs.symlink expect, fse.ensureSymlink expect]
        [["./foo.txt", "./symlink.txt"], "file-success", "file-success"],
        [["../foo.txt", "./empty-dir/symlink.txt"], "file-success", "file-success"],
        [["../foo.txt", "./empty-dir/symlink.txt"], "file-success", "file-success"],
        [["./foo.txt", "./dir-foo/symlink.txt"], "file-success", "file-success"],
        [["./foo.txt", "./empty-dir/symlink.txt"], "file-broken", "file-success"],
        [["./foo.txt", "./real-alpha/symlink.txt"], "file-broken", "file-success"],
        [["./foo.txt", "./real-alpha/real-beta/symlink.txt"], "file-broken", "file-success"],
        [["./foo.txt", "./real-alpha/real-beta/real-gamma/symlink.txt"], "file-broken", "file-success"],
        [["./foo.txt", "./alpha/symlink.txt"], "file-error", "file-success"],
        [["./foo.txt", "./alpha/beta/symlink.txt"], "file-error", "file-success"],
        [["./foo.txt", "./alpha/beta/gamma/symlink.txt"], "file-error", "file-success"],
        [["./foo.txt", "./real-symlink.txt"], "file-error", "file-success"],
        [["./dir-foo/foo.txt", "./real-symlink.txt"], "file-error", "file-error"],
        [["./missing.txt", "./symlink.txt"], "file-broken", "file-error"],
        [["./missing.txt", "./missing-dir/symlink.txt"], "file-error", "file-error"],
        // error is thrown if destination path exists
        [["./foo.txt", "./dir-foo/foo.txt"], "file-error", "file-error"],
        [["./dir-foo", "./symlink-dir-foo"], "dir-success", "dir-success"],
        [["../dir-bar", "./dir-foo/symlink-dir-bar"], "dir-success", "dir-success"],
        [["./dir-bar", "./dir-foo/symlink-dir-bar"], "dir-broken", "dir-success"],
        [["./dir-bar", "./empty-dir/symlink-dir-bar"], "dir-broken", "dir-success"],
        [["./dir-bar", "./real-alpha/symlink-dir-bar"], "dir-broken", "dir-success"],
        [["./dir-bar", "./real-alpha/real-beta/symlink-dir-bar"], "dir-broken", "dir-success"],
        [["./dir-bar", "./real-alpha/real-beta/real-gamma/symlink-dir-bar"], "dir-broken", "dir-success"],
        [["./dir-foo", "./alpha/dir-foo"], "dir-error", "dir-success"],
        [["./dir-foo", "./alpha/beta/dir-foo"], "dir-error", "dir-success"],
        [["./dir-foo", "./alpha/beta/gamma/dir-foo"], "dir-error", "dir-success"],
        [["./dir-foo", "./real-symlink-dir-foo"], "dir-error", "dir-success"],
        [["./dir-bar", "./real-symlink-dir-foo"], "dir-error", "dir-error"],
        [["./missing", "./dir-foo/symlink-dir-missing"], "dir-broken", "dir-error"],
        // error is thrown if destination path exists
        [["./dir-foo", "./real-alpha/real-beta"], "dir-error", "dir-error"],
        [[resolve(join(distribution, "./foo.txt")), "./symlink.txt"], "file-success", "file-success"],
        [[resolve(join(distribution, "./dir-foo/foo.txt")), "./symlink.txt"], "file-success", "file-success"],
        [[resolve(join(distribution, "./missing.txt")), "./symlink.txt"], "file-broken", "file-error"],
        [[resolve(join(distribution, "../foo.txt")), "./symlink.txt"], "file-broken", "file-error"],
        [[resolve(join(distribution, "../dir-foo/foo.txt")), "./symlink.txt"], "file-broken", "file-error"],
    ])("should ", () => {
        expect.assertions(2);
    });
});
