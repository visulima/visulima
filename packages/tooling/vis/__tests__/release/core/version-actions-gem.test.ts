import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { GemVersionActions } from "../../../src/release/core/version-actions/gem";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import type { WorkspacePackage } from "../../../src/release/types";

/** The gem versionActions builds with `gem build` and pushes with `gem push`, with no shell. Dry run returns before any command runs. */
describe.skipIf(process.platform === "win32")(GemVersionActions, () => {
    let root: string;

    const pkg = (): WorkspacePackage => {
        return {
            dir: root,
            ecosystem: "gem",
            manifest: { name: "core", private: false, version: "1.0.0" },
            manifestPath: join(root, "core.gemspec"),
            name: "core",
            private: false,
            version: "1.0.0",
        };
    };

    const runner = (exitCodes: Record<string, number> = {}) => {
        const run = vi.fn(async (_cmd: string, argv: string[]) => {
            const key = argv[0] ?? "";

            return { exitCode: exitCodes[key] ?? 0, stderr: "", stdout: "" };
        });

        return { run, runner: { run } as unknown as CommandRunner };
    };

    const context = (overrides: { dryRun?: boolean; runner?: CommandRunner } = {}): PublishContext => {
        return {
            catalogs: { default: {}, named: {} },
            dryRun: overrides.dryRun,
            pkg: pkg(),
            pm: { id: "npm", minVersion: "8.0.0", runner: overrides.runner ?? runner().runner } as never,
            release: { changeFiles: [], isCascadeBump: false, isDependencyBump: false, isGroupBump: false, name: "core", newVersion: "1.1.0", oldVersion: "1.0.0", reasons: ["EXPLICIT"], sources: [], type: "minor" },
            versionedManifestByName: new Map(),
        };
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-gem-publish-")));
        writeFileSync(join(root, "core.gemspec"), "Gem::Specification.new do |spec|\n  spec.name = \"core\"\n  spec.version = \"1.1.0\"\nend\n");
        vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { headers: { "Content-Type": "application/json" }, status: 200 })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        rmSync(root, { force: true, recursive: true });
    });

    it("names the commands on a dry run and runs nothing", async () => {
        expect.hasAssertions();

        const { run, runner: r } = runner();
        const result = await new GemVersionActions().publish(context({ dryRun: true, runner: r }));

        expect(result.output).toContain("gem build core.gemspec and gem push core-1.1.0.gem");
        expect(run).not.toHaveBeenCalled();
    });

    it("builds then pushes the built file as argv", async () => {
        expect.hasAssertions();

        const { run, runner: r } = runner();
        const result = await new GemVersionActions().publish(context({ runner: r }));

        expect(result.published).toBe(true);
        expect(run.mock.calls.map((call) => [call[0], call[1]])).toStrictEqual([
            ["gem", ["--version"]],
            ["gem", ["build", "core.gemspec"]],
            ["gem", ["push", "core-1.1.0.gem"]],
        ]);
    });

    it("skips a version RubyGems already lists", async () => {
        expect.hasAssertions();

        vi.stubGlobal("fetch", vi.fn(async () => new Response("[{\"number\":\"1.1.0\"}]", { headers: { "Content-Type": "application/json" }, status: 200 })));
        const { run, runner: r } = runner();
        const result = await new GemVersionActions().publish(context({ runner: r }));

        expect(result).toMatchObject({ alreadyPublished: true, published: false });
        expect(run.mock.calls.map((call) => call[1]?.[0])).not.toContain("push");
    });

    it("reports a failed push as PUBLISH_FAILED and still removes the built file", async () => {
        expect.hasAssertions();

        const { runner: r } = runner({ push: 1 });

        await expect(new GemVersionActions().publish(context({ runner: r }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });
    });

    it("refuses when the gem command is missing", async () => {
        expect.hasAssertions();

        const failing = { run: vi.fn(async () => { throw new Error("ENOENT"); }) } as unknown as CommandRunner;

        await expect(new GemVersionActions().publish(context({ runner: failing }))).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("refuses on win32 after the dry run", async () => {
        expect.hasAssertions();

        const original = process.platform;

        Object.defineProperty(process, "platform", { value: "win32" });

        try {
            await expect(new GemVersionActions().publish(context())).rejects.toMatchObject({ code: "CONFIG_INVALID" });
            await expect(new GemVersionActions().publish(context({ dryRun: true }))).resolves.toMatchObject({ published: true });
        } finally {
            Object.defineProperty(process, "platform", { value: original });
        }
    });
});
