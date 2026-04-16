import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildIgnoreMatcher, filterIgnoredFiles } from "../src/ignore-matcher";

let tmp: string;

beforeEach(async () => {
    tmp = await mkdtemp(resolve(tmpdir(), "secret-scanner-ignore-test-"));
});

afterEach(async () => {
    await rm(tmp, { force: true, recursive: true });
});

describe(buildIgnoreMatcher, () => {
    it("returns undefined when no options are provided", () => {
        expect.assertions(1);

        expect(buildIgnoreMatcher(undefined)).toBeUndefined();
    });

    it("returns undefined when walk has neither files nor patterns", () => {
        expect.assertions(1);

        expect(buildIgnoreMatcher({ walk: {} })).toBeUndefined();
    });

    it("builds a matcher from inline patterns", () => {
        expect.assertions(2);

        const matcher = buildIgnoreMatcher({ walk: { excludePatterns: ["*.log", "dist/**"] } });

        expect(matcher?.ignores("deploy.log")).toBe(true);
        expect(matcher?.ignores("src/app.ts")).toBe(false);
    });

    it("builds a matcher from an ignore-style file", async () => {
        expect.assertions(2);

        const ignoreFile = resolve(tmp, ".secretsignore");

        await writeFile(ignoreFile, "fixtures/**\n*.env\n");

        const matcher = buildIgnoreMatcher({ walk: { excludeFromFiles: [ignoreFile] } });

        expect(matcher?.ignores("fixtures/leak.txt")).toBe(true);
        expect(matcher?.ignores("production.env")).toBe(true);
    });

    it("merges patterns from files and inline lists", async () => {
        expect.assertions(2);

        const ignoreFile = resolve(tmp, ".custom-ignore");

        await writeFile(ignoreFile, "*.tmp\n");

        const matcher = buildIgnoreMatcher({
            walk: {
                excludeFromFiles: [ignoreFile],
                excludePatterns: ["*.log"],
            },
        });

        expect(matcher?.ignores("cache.tmp")).toBe(true);
        expect(matcher?.ignores("deploy.log")).toBe(true);
    });

    it("silently skips missing ignore files", () => {
        expect.assertions(1);

        const matcher = buildIgnoreMatcher({
            walk: {
                excludeFromFiles: [resolve(tmp, "does-not-exist.ignore")],
                excludePatterns: ["*.log"],
            },
        });

        // Matcher still builds from the patterns we did get.
        expect(matcher?.ignores("deploy.log")).toBe(true);
    });
});

describe(filterIgnoredFiles, () => {
    it("passes files through unchanged when the matcher is undefined", () => {
        expect.assertions(1);

        const files = ["src/a.ts", "src/b.ts"];

        expect(filterIgnoredFiles(files, undefined, process.cwd())).toStrictEqual(files);
    });

    it("drops files the matcher matches", () => {
        expect.assertions(1);

        const matcher = buildIgnoreMatcher({ walk: { excludePatterns: ["*.log"] } });

        expect(filterIgnoredFiles(["src/app.ts", "deploy.log", "src/app.test.ts"], matcher, process.cwd())).toStrictEqual(["src/app.ts", "src/app.test.ts"]);
    });

    it("keeps files that resolve outside the cwd", () => {
        expect.assertions(1);

        const matcher = buildIgnoreMatcher({ walk: { excludePatterns: ["**"] } });
        // `../outside.ts` relative-resolves to `..` → skipped through the "starts with `..`" guard.
        const kept = filterIgnoredFiles(["../outside.ts"], matcher, resolve(tmp));

        expect(kept).toStrictEqual(["../outside.ts"]);
    });
});
