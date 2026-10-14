import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import execute from "../../../src/commands/create/handler";
import { runDlx } from "../../../src/pm/pm-runner";

vi.mock(import("../../../src/util/catalog"), () => {
    return {
    // The real module loads a native binding; registry resolution is covered by catalog tests.
        getRegistryForPackage: (_name: string, config: { defaultRegistry: string }) => { return { token: undefined, url: config.defaultRegistry }; },
        loadNpmrc: () => { return { authTokens: new Map(), defaultRegistry: "https://registry.npmjs.org", registries: new Map() }; },
    };
});

vi.mock(import("../../../src/pm/pm-runner"), () => {
    return {
        detectPm: vi.fn(() => { return { name: "npm", version: "10.0.0" }; }),
        runDlx: vi.fn(() => 0),
        runInstall: vi.fn(() => 0),
    };
});

/** Run the create handler non-interactively with the given `create` config and no positional input. */
const runBareCreate = async (cwd: string, createConfig: Record<string, unknown>): Promise<void> => {
    await execute({
        argument: undefined,
        logger: console,
        options: { cwd, interactive: false, list: false },
        rawUnknown: [],
        visConfig: { create: { install: false, ...createConfig } },
        workspaceRoot: undefined,
    } as unknown as Parameters<typeof execute>[0]);
};

describe("create.defaultTemplate", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-default-cwd-"));
        vi.mocked(runDlx).mockClear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        rmSync(cwd, { force: true, recursive: true });
    });

    it("runs @org/create when the org has no manifest", async () => {
        expect.assertions(2);

        vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));

        await runBareCreate(cwd, { defaultTemplate: "@vistest-org" });

        expect(runDlx).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runDlx).mock.calls[0]?.[1]).toMatchObject({ package: "@vistest-org/create" });
    });

    it("routes a @org:name default straight to that manifest entry", async () => {
        expect.assertions(3);

        const manifest = {
            createConfig: { templates: [{ description: "Web app", name: "app", source: { kind: "npm", package: "@vistest-org/create-app" } }] },
        };

        vi.stubGlobal("fetch", vi.fn(async () => Response.json(manifest, { status: 200 })));

        await runBareCreate(cwd, { defaultTemplate: "@vistest-org:app" });

        expect(runDlx).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runDlx).mock.calls[0]?.[1]).toMatchObject({ package: "@vistest-org/create-app" });
        // The entry name becomes the default project directory.
        expect(vi.mocked(runDlx).mock.calls[0]?.[1]).toMatchObject({ args: ["app"] });
    });
});
