import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverComposerProjects } from "../../../src/release/core/composer-projects";

// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

describe("composer projects discovery", () => {
    let dir: string;

    const write = (relative: string, content: unknown): void => {
        mkdirSync(dirname(join(dir, relative)), { recursive: true });
        writeFileSync(join(dir, relative), typeof content === "string" ? content : JSON.stringify(content));
    };

    const git = (...args: string[]): void => {
        execFileSync("git", ["-c", "tag.gpgsign=false", "-c", "commit.gpgsign=false", ...args], { cwd: dir, stdio: "ignore" });
    };

    const discover = (claimedDirs: string[] = []) => discoverComposerProjects({ claimedDirs: new Set(claimedDirs), cwd: dir });

    beforeEach(() => {
        dir = realpathSync(mkdtempSync(join(tmpdir(), "vis-composer-discover-")));
        git("init", "-q");
        git("config", "user.email", "ci@example.invalid");
        git("config", "user.name", "ci");
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("releases the root package at its highest vX.Y.Z tag", async () => {
        expect.hasAssertions();

        write("composer.json", { name: "acme/tool", require: { php: "^8.2" } });
        git("add", ".");
        git("commit", "-q", "-m", "init");
        git("tag", "v1.2.0");
        git("tag", "v1.10.1");
        git("tag", "1.99.0");

        const [project] = await discover();

        expect(project?.name).toBe("acme/tool");
        expect(project?.package.version).toBe("1.10.1");
        expect(project?.perPackage).toMatchObject({ releaseTagPattern: "v{version}", versionActions: "composer" });
    });

    it("starts a package with no tag at 0.0.0", async () => {
        expect.hasAssertions();

        write("composer.json", { name: "acme/tool" });

        const [project] = await discover();

        expect(project?.package.version).toBe("0.0.0");
    });

    it("does not release a composer.json without a name", async () => {
        expect.hasAssertions();

        write("composer.json", { description: "an application" });

        await expect(discover()).resolves.toStrictEqual([]);
    });

    it("refuses a version key, because Packagist would ignore it", async () => {
        expect.hasAssertions();

        write("composer.json", { name: "acme/tool", version: "1.0.0" });

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a named package in a subdirectory", async () => {
        expect.hasAssertions();

        write("composer.json", { name: "acme/root" });
        write("packages/sub/composer.json", { name: "acme/sub" });

        await expect(discover()).rejects.toThrow("Packagist reads a package from its repository root");
    });

    it("refuses a name that is not vendor/package", async () => {
        expect.hasAssertions();

        write("composer.json", { name: "Acme/Tool" });

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses a composer.json that is not valid JSON", async () => {
        expect.hasAssertions();

        write("composer.json", "{ name: ");

        await expect(discover()).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("skips vendor directories and claimed directories", async () => {
        expect.hasAssertions();

        write("composer.json", { name: "acme/root" });
        write("vendor/other/lib/composer.json", { name: "other/lib" });
        write("node_modules/x/composer.json", { name: "x/y" });

        const projects = await discover();

        expect(projects.map((project) => project.name)).toStrictEqual(["acme/root"]);
        await expect(discover([dir])).resolves.toStrictEqual([]);
    });
});
