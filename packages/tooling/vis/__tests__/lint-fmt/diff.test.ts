import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { changedFilesSince, filterByExtensions } from "../../src/lint-fmt/diff";

let workspaceRoot: string;

const git = (args: string[]): void => {
    execFileSync("git", args, { cwd: workspaceRoot, stdio: "ignore" });
};

const writeFile = (relativePath: string, contents: string): void => {
    const absolute = join(workspaceRoot, relativePath);
    const slash = absolute.lastIndexOf("/");

    if (slash !== -1) {
        mkdirSync(absolute.slice(0, slash), { recursive: true });
    }

    writeFileSync(absolute, contents);
};

describe(filterByExtensions, () => {
    it("keeps files matching the allowed extension set", () => {
        expect.assertions(1);

        const files = ["a.ts", "b.css", "c.tsx", "d.md", "e.JS"];

        expect(filterByExtensions(files, ["ts", "tsx", "js"])).toStrictEqual(["a.ts", "c.tsx", "e.JS"]);
    });

    it("drops files without an extension", () => {
        expect.assertions(1);

        expect(filterByExtensions(["Makefile", "a.ts"], ["ts"])).toStrictEqual(["a.ts"]);
    });

    it("deduplicates the input", () => {
        expect.assertions(1);

        expect(filterByExtensions(["a.ts", "a.ts"], ["ts"])).toStrictEqual(["a.ts"]);
    });
});

describe(changedFilesSince, () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-diff-"));
        git(["init", "-q", "-b", "main"]);
        git(["config", "user.email", "test@example.com"]);
        git(["config", "user.name", "test"]);
        git(["config", "commit.gpgsign", "false"]);
        writeFile("README.md", "init");
        git(["add", "."]);
        git(["commit", "-q", "-m", "init"]);
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("returns committed changes vs the ref", () => {
        expect.assertions(2);

        writeFile("src/a.ts", "export {}");
        git(["add", "."]);
        git(["commit", "-q", "-m", "add a"]);

        const result = changedFilesSince(workspaceRoot, "main~1");

        expect(result).toBeDefined();
        expect(result!.some((f) => f.endsWith("/src/a.ts"))).toBe(true);
    });

    it("includes untracked files", () => {
        expect.assertions(2);

        writeFile("src/new.ts", "export {}");

        const result = changedFilesSince(workspaceRoot, "main");

        expect(result).toBeDefined();
        expect(result!.some((f) => f.endsWith("/src/new.ts"))).toBe(true);
    });

    it("includes unstaged modifications to tracked files", () => {
        expect.assertions(1);

        writeFile("src/b.ts", "export {}");
        git(["add", "."]);
        git(["commit", "-q", "-m", "add b"]);
        writeFile("src/b.ts", "export const x = 1;");

        const result = changedFilesSince(workspaceRoot, "main");

        expect(result!.some((f) => f.endsWith("/src/b.ts"))).toBe(true);
    });

    it("returns undefined for an unknown ref", () => {
        expect.assertions(1);

        expect(changedFilesSince(workspaceRoot, "does-not-exist")).toBeUndefined();
    });

    it("returns an empty array when nothing has changed", () => {
        expect.assertions(1);

        expect(changedFilesSince(workspaceRoot, "main")).toStrictEqual([]);
    });
});
