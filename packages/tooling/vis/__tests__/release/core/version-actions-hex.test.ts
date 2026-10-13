import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { HexVersionActions } from "../../../src/release/core/version-actions/hex";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import type { WorkspacePackage } from "../../../src/release/types";

/**
 * The `hex` versionActions publishes with `mix hex.publish --yes` in the package
 * directory. A version the registry already lists is skipped without a publish.
 */
describe.skipIf(process.platform === "win32")(HexVersionActions, () => {
    let root: string;

    const pkg = (): WorkspacePackage => {
        return {
            dir: root,
            ecosystem: "hex",
            manifest: { name: "a", private: false, version: "1.0.0" },
            manifestPath: join(root, "mix.exs"),
            name: "a",
            private: false,
            version: "1.0.0",
        };
    };

    const runnerWith = (exitCode = 0): { run: ReturnType<typeof vi.fn>; runner: CommandRunner } => {
        // Only the publish fails; the `mix --version` probe still succeeds.
        const run = vi.fn(async (_cmd: string, argv: string[]) => { return { exitCode: argv[0] === "hex.publish" ? exitCode : 0, stderr: "boom", stdout: "" }; });

        return { run, runner: { run } as unknown as CommandRunner };
    };

    const context = (overrides: { dryRun?: boolean; runner: CommandRunner }): PublishContext =>
        ({
            catalogs: { default: {}, named: {} },
            dryRun: overrides.dryRun,
            pkg: pkg(),
            pm: { id: "npm", minVersion: "8.0.0", runner: overrides.runner } as never,
            release: {
                changeFiles: [],
                isCascadeBump: false,
                isDependencyBump: false,
                isGroupBump: false,
                name: "a",
                newVersion: "1.1.0",
                oldVersion: "1.0.0",
                reasons: ["EXPLICIT"],
                sources: [],
                type: "minor",
            },
        }) as unknown as PublishContext;

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-hex-publish-")));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        rmSync(root, { force: true, recursive: true });
    });

    it("dry run describes the publish and runs nothing", async () => {
        expect.hasAssertions();

        const { run, runner } = runnerWith();
        const result = await new HexVersionActions().publish(context({ dryRun: true, runner }));

        expect(result).toMatchObject({ published: true });
        expect(result.output).toContain("mix hex.publish --yes");
        expect(run).not.toHaveBeenCalled();
    });

    it("publishes with argv and no shell, in the package directory", async () => {
        expect.hasAssertions();

        vi.stubGlobal("fetch", vi.fn(async () => new Response("{\"releases\":[{\"version\":\"1.0.0\"}]}", { status: 200 })));

        const { run, runner } = runnerWith();
        const result = await new HexVersionActions().publish(context({ runner }));

        expect(result).toMatchObject({ published: true });
        expect(run).toHaveBeenCalledWith("mix", ["hex.publish", "--yes"], { cwd: root, silent: false });
    });

    it("skips a version the registry already lists, without publishing", async () => {
        expect.hasAssertions();

        vi.stubGlobal("fetch", vi.fn(async () => new Response("{\"releases\":[{\"version\":\"1.1.0\"}]}", { status: 200 })));

        const { run, runner } = runnerWith();
        const result = await new HexVersionActions().publish(context({ runner }));

        expect(result).toMatchObject({ alreadyPublished: true, published: false });
        expect(run).not.toHaveBeenCalledWith("mix", ["hex.publish", "--yes"], expect.anything());
    });

    it("reports a failed publish as PUBLISH_FAILED", async () => {
        expect.hasAssertions();

        vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));

        await expect(new HexVersionActions().publish(context({ runner: runnerWith(1).runner }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });
    });
});
