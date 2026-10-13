import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createShellRunner } from "../../../src/release/core/shell-runner";
import { ComposerVersionActions } from "../../../src/release/core/version-actions/composer";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";

// git hooks export these; a temp repo must not inherit the outer repository.
delete process.env.GIT_DIR;
delete process.env.GIT_INDEX_FILE;
delete process.env.GIT_WORK_TREE;
delete process.env.GIT_PREFIX;

describe("composer version actions", () => {
    let dir: string;

    const git = (...args: string[]): void => {
        execFileSync("git", ["-c", "tag.gpgsign=false", "-c", "commit.gpgsign=false", ...args], { cwd: dir, stdio: "ignore" });
    };

    const context = (overrides: Partial<PublishContext> = {}): PublishContext =>
        ({
            catalogs: {},
            perPackageConfig: { releaseTagPattern: "v{version}" },
            pkg: { dir, ecosystem: "composer", manifest: {}, manifestPath: join(dir, "composer.json"), name: "acme/tool", private: false, version: "1.0.0" },
            pm: { runner: createShellRunner() },
            release: { name: "acme/tool", newVersion: "1.1.0", oldVersion: "1.0.0" },
            versionedManifestByName: new Map(),
            ...overrides,
        }) as unknown as PublishContext;

    beforeEach(() => {
        dir = realpathSync(mkdtempSync(join(tmpdir(), "vis-composer-publish-")));
        git("init", "-q");
        git("config", "user.email", "ci@example.invalid");
        git("config", "user.name", "ci");
        writeFileSync(join(dir, "composer.json"), JSON.stringify({ name: "acme/tool" }));
        git("add", ".");
        git("commit", "-q", "-m", "init");
        git("tag", "v1.0.0");
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("reports a dry run without checking the tag", async () => {
        expect.hasAssertions();

        const result = await new ComposerVersionActions().publish(context({ dryRun: true }));

        expect(result).toMatchObject({ published: true });
        expect(result.output).toContain("would tag v1.1.0");
    });

    // The tag path is POSIX-only: publish refuses on win32 (see the refusal test below).
    it.skipIf(process.platform === "win32")("skips a release whose tag already exists", async () => {
        expect.hasAssertions();

        const result = await new ComposerVersionActions().publish(context({ release: { name: "acme/tool", newVersion: "1.0.0", oldVersion: "0.9.0" } }));

        expect(result).toMatchObject({ alreadyPublished: true, published: false });
    });

    it.skipIf(process.platform === "win32")("reports a free tag for the orchestrator to create", async () => {
        expect.hasAssertions();

        const result = await new ComposerVersionActions().publish(context());

        expect(result).toMatchObject({ published: true });
        expect(result.alreadyPublished).toBeUndefined();
    });

    it.skipIf(process.platform === "win32")("refuses on Windows after the dry run", async () => {
        expect.hasAssertions();

        const pub = context();
        const original = Object.getOwnPropertyDescriptor(process, "platform")!;

        Object.defineProperty(process, "platform", { value: "win32" });

        try {
            await expect(new ComposerVersionActions().publish(pub)).rejects.toMatchObject({ code: "CONFIG_INVALID" });
        } finally {
            Object.defineProperty(process, "platform", original);
        }
    });

    it("reads no published version from the registry", async () => {
        expect.hasAssertions();

        await expect(new ComposerVersionActions().readPublishedVersion({ pkg: context().pkg, pm: context().pm })).resolves.toBeUndefined();
    });
});
