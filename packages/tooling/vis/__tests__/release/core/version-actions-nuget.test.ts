import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import type { PublishContext } from "../../../src/release/core/version-actions/interface";
import { NuGetVersionActions } from "../../../src/release/core/version-actions/nuget";
import type { WorkspacePackage } from "../../../src/release/types";

const KEY = "test-key-value";

/** The nuget versionActions packs with `dotnet pack` and pushes with `dotnet nuget push`, with no shell. Dry run returns before any command runs. */
describe.skipIf(process.platform === "win32")(NuGetVersionActions, () => {
    let root: string;
    let previousKey: string | undefined;

    const pkg = (): WorkspacePackage => {
        return {
            dir: root,
            ecosystem: "nuget",
            manifest: { name: "contoso.lib", private: false, version: "1.1.0" },
            manifestPath: join(root, "Lib.csproj"),
            name: "contoso.lib",
            private: false,
            version: "1.1.0",
        };
    };

    /** A fake runner. `pack` writes one `.nupkg` into the `-o` directory, so the real temp-directory flow runs. */
    const fakeRunner = (overrides: { exitCodes?: Record<string, number>; packages?: string[]; stderr?: Record<string, string> } = {}) => {
        const run = vi.fn(async (_cmd: string, argv: string[]) => {
            const verb = argv[0] ?? "";
            const name = verb === "nuget" ? "push" : verb;
            const outputIndex = argv.indexOf("-o");

            if (verb === "pack" && outputIndex !== -1) {
                for (const file of overrides.packages ?? ["Contoso.Lib.1.1.0.nupkg"]) {
                    writeFileSync(join(argv[outputIndex + 1] as string, file), "");
                }
            }

            return { exitCode: overrides.exitCodes?.[name] ?? 0, stderr: overrides.stderr?.[name] ?? "", stdout: "" };
        });

        return { run, runner: { run } as unknown as CommandRunner };
    };

    const context = (overrides: { dryRun?: boolean; runner?: CommandRunner } = {}): PublishContext => {
        return {
            catalogs: { default: {}, named: {} },
            dryRun: overrides.dryRun,
            pkg: pkg(),
            pm: { id: "npm", minVersion: "8.0.0", runner: overrides.runner ?? fakeRunner().runner } as never,
            release: { changeFiles: [], isCascadeBump: false, isDependencyBump: false, isGroupBump: false, name: "contoso.lib", newVersion: "1.1.0", oldVersion: "1.0.0", reasons: ["EXPLICIT"], sources: [], type: "minor" },
            versionedManifestByName: new Map(),
        };
    };

    const listing = (versions: string[]) => Response.json({ versions }, { headers: { "Content-Type": "application/json" }, status: 200 });

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-nuget-publish-")));
        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, "Lib.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\"><PropertyGroup><Version>1.1.0</Version></PropertyGroup></Project>\n");
        previousKey = process.env.NUGET_API_KEY;
        process.env.NUGET_API_KEY = KEY;
        vi.stubGlobal("fetch", vi.fn(async () => listing(["1.0.0"])));
    });

    afterEach(() => {
        if (previousKey === undefined) {
            delete process.env.NUGET_API_KEY;
        } else {
            process.env.NUGET_API_KEY = previousKey;
        }

        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        rmSync(root, { force: true, recursive: true });
    });

    it("dry run reports what would run and runs nothing", async () => {
        expect.hasAssertions();

        const fake = fakeRunner();
        const result = await new NuGetVersionActions().publish(context({ dryRun: true, runner: fake.runner }));

        expect(result).toMatchObject({ published: true });
        expect(result.output).toContain("dotnet pack Lib.csproj");
        expect(fake.run).not.toHaveBeenCalled();
    });

    it("packs, then pushes the one package with the key in argv but not in any output", async () => {
        expect.hasAssertions();

        const fake = fakeRunner();
        const result = await new NuGetVersionActions().publish(context({ runner: fake.runner }));

        expect(result).toMatchObject({ published: true });
        expect(result.output).not.toContain(KEY);

        const pushCall = fake.run.mock.calls.find(([, argv]) => argv[0] === "nuget");

        expect(pushCall?.[1]).toStrictEqual(expect.arrayContaining(["nuget", "push", "--source", "https://api.nuget.org/v3/index.json", "--api-key", KEY]));
        expect(pushCall?.[1][2]).toMatch(/Contoso\.Lib\.1\.1\.0\.nupkg$/);
    });

    it("skips a version the flat container already lists, comparing lowercased without build metadata", async () => {
        expect.hasAssertions();

        vi.stubGlobal("fetch", vi.fn(async () => listing(["1.1.0+build.5"])));
        const fake = fakeRunner();
        const result = await new NuGetVersionActions().publish(context({ runner: fake.runner }));

        expect(result).toMatchObject({ alreadyPublished: true, published: false });
        expect(fake.run).not.toHaveBeenCalledWith("dotnet", expect.arrayContaining(["pack"]), expect.anything());
    });

    it("treats a failed lookup as not published, so the push reports the real error", async () => {
        expect.hasAssertions();

        vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
        const fake = fakeRunner();
        const result = await new NuGetVersionActions().publish(context({ runner: fake.runner }));

        expect(result).toMatchObject({ published: true });
    });

    it("refuses without the API key in the environment, naming the variable and not a value", async () => {
        expect.hasAssertions();

        delete process.env.NUGET_API_KEY;

        await expect(new NuGetVersionActions().publish(context())).rejects.toMatchObject({
            code: "CONFIG_INVALID",
            message: expect.stringContaining("NUGET_API_KEY"),
        });
    });

    it("refuses when the dotnet CLI does not run", async () => {
        expect.hasAssertions();

        const runner = { run: vi.fn(async () => { return { exitCode: 127, stderr: "", stdout: "" }; }) } as unknown as CommandRunner;

        await expect(new NuGetVersionActions().publish(context({ runner }))).rejects.toMatchObject({ code: "CONFIG_INVALID", message: expect.stringContaining("dotnet") });
    });

    it("fails with PUBLISH_FAILED when pack fails", async () => {
        expect.hasAssertions();

        const fake = fakeRunner({ exitCodes: { pack: 1 }, stderr: { pack: "CS1002 error" } });

        await expect(new NuGetVersionActions().publish(context({ runner: fake.runner }))).rejects.toMatchObject({ code: "PUBLISH_FAILED" });
    });

    it("fails with PUBLISH_FAILED and redacts the key when push fails", async () => {
        expect.hasAssertions();

        const fake = fakeRunner({ exitCodes: { push: 1 }, stderr: { push: `rejected key ${KEY}` } });

        const error = await new NuGetVersionActions().publish(context({ runner: fake.runner })).catch((error_: unknown) => error_);

        expect(error).toMatchObject({ code: "PUBLISH_FAILED" });
        expect(String((error as Error).message)).not.toContain(KEY);
        expect(String((error as Error).message)).toContain("***");
    });

    it("fails when pack writes no single package", async () => {
        expect.hasAssertions();

        const fake = fakeRunner({ packages: [] });

        await expect(new NuGetVersionActions().publish(context({ runner: fake.runner }))).rejects.toMatchObject({ code: "PUBLISH_FAILED", message: expect.stringContaining("found 0") });
    });
});
