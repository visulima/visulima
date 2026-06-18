import { existsSync, lstatSync, promises as fs, readlinkSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { shimInstallExecute, shimStatusExecute, shimUninstallExecute } from "../../../src/commands/shim/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const SHIM_NAMES = ["npm", "npx", "pnpm", "pnpx", "yarn", "yarnpkg"];

type LoggerCall = [string, ...unknown[]];

interface FakeToolbox {
    calls: LoggerCall[];
    exitCodes: number[];
    toolbox: unknown;
}

const makeToolbox = (cwd: string, env: Record<string, string | undefined>): FakeToolbox => {
    const calls: LoggerCall[] = [];
    const exitCodes: number[] = [];

    const toolbox = {
        console: {
            error: (...args: unknown[]) => calls.push(["error", ...args]),
            log: (...args: unknown[]) => calls.push(["log", ...args]),
        },
        fs,
        process: {
            arch: process.arch,
            cwd,
            env,
            exit: (code: number) => {
                exitCodes.push(code);
            },
            platform: process.platform,
        },
    };

    return { calls, exitCodes, toolbox };
};

const text = (calls: LoggerCall[]): string => calls.map((c) => c.slice(1).join(" ")).join("\n");

describe("vis shim", () => {
    let workspace: string;
    let launcher: string;

    beforeEach(() => {
        workspace = createTemporaryDirectory("vis-shim-");
        launcher = join(workspace, "fake-launcher");
        writeFileSync(launcher, "#!/bin/sh\n");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspace);
    });

    it("install creates a symlink per PM name pointing at the launcher", async () => {
        expect.hasAssertions();

        const { toolbox } = makeToolbox(workspace, { VIS_LAUNCHER_PATH: launcher });

        await shimInstallExecute(toolbox as never);

        const shimDirectory = join(workspace, ".vis", "shims");

        for (const name of SHIM_NAMES) {
            const link = join(shimDirectory, name);

            expect(lstatSync(link).isSymbolicLink()).toBe(true);
            expect(readlinkSync(link)).toBe(launcher);
        }
    });

    it("install re-points stale links when run twice", async () => {
        expect.hasAssertions();

        const { toolbox } = makeToolbox(workspace, { VIS_LAUNCHER_PATH: launcher });

        await shimInstallExecute(toolbox as never);
        // A second run must not throw on the existing links (rm-then-symlink).
        await shimInstallExecute(toolbox as never);

        expect(readlinkSync(join(workspace, ".vis", "shims", "pnpm"))).toBe(launcher);
    });

    it("install fails clearly when no launcher binary is resolvable", async () => {
        expect.hasAssertions();

        const { calls, exitCodes, toolbox } = makeToolbox(workspace, { VIS_LAUNCHER_PATH: undefined });

        await shimInstallExecute(toolbox as never);

        expect(exitCodes).toStrictEqual([1]);
        expect(text(calls)).toContain("native launcher binary");
        expect(existsSync(join(workspace, ".vis", "shims"))).toBe(false);
    });

    it("status reports not-installed, then installed", async () => {
        expect.hasAssertions();

        const before = makeToolbox(workspace, {});

        await shimStatusExecute(before.toolbox as never);

        expect(text(before.calls)).toContain("not installed");

        const install = makeToolbox(workspace, { VIS_LAUNCHER_PATH: launcher });

        await shimInstallExecute(install.toolbox as never);

        const after = makeToolbox(workspace, {});

        await shimStatusExecute(after.toolbox as never);

        expect(text(after.calls)).toContain("installed in");
    });

    it("uninstall removes the shim dir", async () => {
        expect.hasAssertions();

        const install = makeToolbox(workspace, { VIS_LAUNCHER_PATH: launcher });

        await shimInstallExecute(install.toolbox as never);

        expect(existsSync(join(workspace, ".vis", "shims"))).toBe(true);

        const uninstall = makeToolbox(workspace, {});

        await shimUninstallExecute(uninstall.toolbox as never);

        expect(existsSync(join(workspace, ".vis", "shims"))).toBe(false);
    });
});
