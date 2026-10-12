import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createShellRunner } from "../../../src/release/core/shell-runner";
import { GoVersionActions } from "../../../src/release/core/version-actions/go";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";

/**
 * The Go publish step: a dry run returns first, an existing tag skips the release,
 * and a free tag is reported for the orchestrator to create. vis never tags here.
 */
// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

describe("go version actions", () => {
    let dir: string;

    const git = (...args: string[]): void => {
        execFileSync("git", ["-c", "tag.gpgsign=false", "-c", "commit.gpgsign=false", ...args], { cwd: dir, stdio: "ignore" });
    };

    const context = (overrides: Partial<PublishContext> = {}): PublishContext =>
        ({
            catalogs: {},
            perPackageConfig: { releaseTagPattern: "v{version}" },
            pkg: { dir, ecosystem: "go", manifest: {}, manifestPath: join(dir, "go.mod"), name: "github.com/acme/tool", private: false, version: "1.0.0" },
            pm: { runner: createShellRunner() },
            release: { name: "github.com/acme/tool", newVersion: "1.1.0", oldVersion: "1.0.0" },
            versionedManifestByName: new Map(),
            ...overrides,
        }) as unknown as PublishContext;

    beforeEach(() => {
        dir = realpathSync(mkdtempSync(join(tmpdir(), "vis-go-publish-")));
        git("init", "-q");
        git("config", "user.email", "ci@example.invalid");
        git("config", "user.name", "ci");
        writeFileSync(join(dir, "go.mod"), "module github.com/acme/tool\n");
        git("add", ".");
        git("commit", "-q", "-m", "init");
        git("tag", "v1.0.0");
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("returns before any check on a dry run", async () => {
        expect.hasAssertions();

        const result = await new GoVersionActions().publish(context({ dryRun: true }));

        expect(result.published).toBe(true);
        expect(result.output).toContain("would tag v1.1.0");
    });

    it("skips a release whose tag already exists", async () => {
        expect.hasAssertions();

        const result = await new GoVersionActions().publish(context({ release: { name: "github.com/acme/tool", newVersion: "1.0.0", oldVersion: "1.0.0" } as never }));

        expect(result.alreadyPublished).toBe(true);
        expect(result.published).toBe(false);
    });

    it("reports a free tag as published without creating it", async () => {
        expect.hasAssertions();

        const result = await new GoVersionActions().publish(context());
        const tags = execFileSync("git", ["tag", "--list"], { cwd: dir }).toString();

        expect(result.published).toBe(true);
        expect(tags.trim()).toBe("v1.0.0");
    });

    it("tags a subdirectory module with its prefixed pattern", async () => {
        expect.hasAssertions();

        const result = await new GoVersionActions().publish(
            context({ perPackageConfig: { releaseTagPattern: "lib/core/v{version}" } }),
        );

        expect(result.published).toBe(true);
        expect(result.output).toContain("lib/core/v1.1.0");
    });
});
