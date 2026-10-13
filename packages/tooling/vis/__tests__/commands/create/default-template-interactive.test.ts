import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import execute from "../../../src/commands/create/handler";
import { runInteractivePrompts, runTemplatePicker } from "../../../src/commands/create/prompts";
import { runDlx } from "../../../src/pm/pm-runner";

vi.mock(import("../../../src/util/catalog"), () => {
    return {
    // The real module loads a native binding; registry resolution is covered by org-templates-registry.test.ts.
        getRegistryForPackage: (_name: string, config: { defaultRegistry: string }) => { return { token: undefined, url: config.defaultRegistry }; },
        loadNpmrc: () => { return { authTokens: new Map(), defaultRegistry: "https://registry.npmjs.org", registries: new Map() }; },
    };
});

vi.mock(import("../../../src/commands/create/prompts"), () => {
    return {
        runInteractivePrompts: vi.fn(),
        runTemplatePicker: vi.fn(),
    };
});

vi.mock(import("../../../src/pm/pm-runner"), () => {
    return {
        detectPm: vi.fn(() => { return { name: "npm", version: "10.0.0" }; }),
        runDlx: vi.fn(() => 0),
        runInstall: vi.fn(() => 0),
    };
});

const manifest = {
    createConfig: {
        templates: [
            { description: "Web app", name: "app", source: { kind: "npm", package: "@vistest-org/create-app" } },
            { description: "Library", name: "lib", source: { kind: "npm", package: "@vistest-org/create-lib" } },
        ],
    },
};

describe("create.defaultTemplate with the interactive prompts", () => {
    let cwd: string;
    const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-default-tty-"));
        vi.mocked(runDlx).mockClear();
        vi.mocked(runTemplatePicker).mockReset();
        vi.mocked(runInteractivePrompts).mockReset();
        vi.stubGlobal("fetch", vi.fn(async () => Response.json(manifest, { status: 200 })));
        Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
    });

    afterEach(() => {
        vi.unstubAllGlobals();

        if (stdinTty) {
            Object.defineProperty(process.stdin, "isTTY", stdinTty);
        } else {
            delete (process.stdin as { isTTY?: boolean }).isTTY;
        }

        rmSync(cwd, { force: true, recursive: true });
    });

    const bareCreate = async (createConfig: Record<string, unknown>): Promise<void> => {
        await execute({
            argument: undefined,
            logger: console,
            options: { cwd, list: false },
            rawUnknown: [],
            visConfig: { create: { install: false, ...createConfig } },
            workspaceRoot: undefined,
        } as unknown as Parameters<typeof execute>[0]);
    };

    it("shows the org picker before the prompts and runs the picked template", async () => {
        expect.assertions(6);

        vi.mocked(runTemplatePicker).mockResolvedValue("lib");
        vi.mocked(runInteractivePrompts).mockResolvedValue({
            gitInit: false,
            overwrite: false,
            projectName: "my-lib",
            targetDir: "my-lib",
            template: "@vistest-org",
        });

        await bareCreate({ defaultTemplate: "@vistest-org" });

        expect(runTemplatePicker).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runTemplatePicker).mock.calls[0]?.[1].map((choice) => choice.label)).toStrictEqual(["app", "lib"]);
        // The picker owns the terminal before the prompt flow opens its own readline.
        expect(vi.mocked(runTemplatePicker).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(runInteractivePrompts).mock.invocationCallOrder[0] as number);
        expect(vi.mocked(runInteractivePrompts).mock.calls[0]?.[0]).toMatchObject({ presetTemplate: "@vistest-org" });
        expect(runDlx).toHaveBeenCalledTimes(1);
        expect(vi.mocked(runDlx).mock.calls[0]?.[1]).toMatchObject({ package: "@vistest-org/create-lib" });
    });

    it("does not open the org picker when the default is not an organization", async () => {
        expect.assertions(2);

        vi.mocked(runInteractivePrompts).mockResolvedValue({
            gitInit: false,
            overwrite: false,
            projectName: "my-app",
            targetDir: "my-app",
            template: "vite",
        });

        await bareCreate({ defaultTemplate: "vite" });

        expect(runTemplatePicker).not.toHaveBeenCalled();
        expect(vi.mocked(runDlx).mock.calls[0]?.[1]).toMatchObject({ package: "create-vite" });
    });
});
