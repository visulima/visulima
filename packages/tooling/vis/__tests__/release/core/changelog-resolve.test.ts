import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { resolveFormatter } from "../../../src/release/core/changelog/resolve";
import type { ChangeFile, PlannedRelease } from "../../../src/release/types";

const mkRelease = (name: string): PlannedRelease => {
    return {
        changeFiles: [],
        isCascadeBump: false,
        isDependencyBump: false,
        isGroupBump: false,
        name,
        newVersion: "1.1.0",
        oldVersion: "1.0.0",
        reasons: ["EXPLICIT"],
        sources: [],
        type: "minor",
    };
};

const mkChangeFile = (body: string): ChangeFile => {
    return {
        body,
        bumps: [],
        path: "/tmp/change.md",
    };
};

describe("resolveFormatter — built-ins", () => {
    it("returns a no-op formatter for setting=false", async () => {
        const formatter = await resolveFormatter(false, "/tmp");
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expect(out).toBe("");
    });

    it("returns the default formatter for setting=undefined", async () => {
        const formatter = await resolveFormatter(undefined, "/tmp");
        const out = await formatter({
            changeFiles: [mkChangeFile("- something happened")],
            date: "2026-01-01",
            release: mkRelease("a"),
            target: "changelog",
        });

        expect(out).toContain("## 1.1.0");
        expect(out).toContain("2026-01-01");
        expect(out).toContain("something happened");
    });

    it("returns the default formatter for setting=\"default\"", async () => {
        const formatter = await resolveFormatter("default", "/tmp");
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expect(out).toContain("## 1.1.0");
    });

    // Bumped timeout: this path spawns real `git` subprocesses (repo-slug detect +
    // per-change-file `git log`) plus a dynamic `import("../remote/detect")`. Fine
    // in isolation, but the cold spawn is slow under full-suite parallel load.
    it("returns the github formatter for setting=\"github\"", async () => {
        const formatter = await resolveFormatter("github", "/tmp");
        const out = await formatter({
            changeFiles: [mkChangeFile("did a thing\n\npr: 42")],
            date: "2026-01-01",
            release: mkRelease("a"),
            target: "changelog",
        });

        expectTypeOf(out).toBeString();

        expect(out).toContain("1.1.0");
    }, 15_000);

    it("returns the keep-a-changelog formatter for setting=\"keep-a-changelog\"", async () => {
        const formatter = await resolveFormatter("keep-a-changelog", "/tmp");
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expectTypeOf(out).toBeString();
    });

    it("aliases \"keepachangelog\" to the same formatter", async () => {
        const formatter = await resolveFormatter("keepachangelog", "/tmp");
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expectTypeOf(out).toBeString();
    });
});

describe("resolveFormatter — tuple form for built-ins", () => {
    it("forwards options to the github factory", async () => {
        const formatter = await resolveFormatter(["github", { repo: "owner/name" }], "/tmp");
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expectTypeOf(out).toBeString();
    });

    it("forwards options to the keep-a-changelog factory", async () => {
        const formatter = await resolveFormatter(["keep-a-changelog", {}], "/tmp");
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expectTypeOf(out).toBeString();
    });

    it("aliases \"keepachangelog\" tuple form", async () => {
        const formatter = await resolveFormatter(["keepachangelog", {}], "/tmp");
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expectTypeOf(out).toBeString();
    });
});

describe("resolveFormatter — custom user module", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-resolve-formatter-"));
    });

    afterEach(async () => {
        const fs = await import("node:fs/promises");

        await fs.rm(cwd, { force: true, recursive: true });
    });

    it("loads a relative module that default-exports a formatter", async () => {
        const file = join(cwd, "my-formatter.mjs");

        writeFileSync(file, "export default (ctx) => `CUSTOM ${ctx.release.newVersion}`;\n");

        const formatter = await resolveFormatter(`./my-formatter.mjs`, cwd);
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expect(out).toBe("CUSTOM 1.1.0");
    });

    it("loads a relative module whose default export is already callable (factory shape)", async () => {
        const file = join(cwd, "factory.mjs");

        writeFileSync(file, "export default (opts) => (ctx) => `FACTORY ${opts.prefix} ${ctx.release.newVersion}`;\n");

        const formatter = await resolveFormatter([`./factory.mjs`, { prefix: "HI" }], cwd);
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expect(out).toBe("FACTORY HI 1.1.0");
    });

    it("falls back to default export when factory call does not return a function (tuple form)", async () => {
        // If the default export *is* the formatter (not a factory) but the user
        // passed tuple form by mistake — calling it with options yields a string,
        // not a function, so resolve.ts returns the original export.
        const file = join(cwd, "noopt.mjs");

        writeFileSync(file, "export default (ctx) => `PLAIN ${ctx.release.newVersion}`;\n");

        const formatter = await resolveFormatter([`./noopt.mjs`, { ignored: true }], cwd);
        const out = await formatter({ changeFiles: [], date: "2026-01-01", release: mkRelease("a"), target: "changelog" });

        expect(out).toBe("PLAIN 1.1.0");
    });

    it("throws when the module's default is not a function", async () => {
        const file = join(cwd, "bad.mjs");

        writeFileSync(file, "export default { not: 'a function' };\n");

        await expect(resolveFormatter(`./bad.mjs`, cwd)).rejects.toThrow(
            /did not export a default function or a callable module/,
        );
    });
});
