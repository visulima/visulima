import { existsSync, promises as fs, readFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decideShim } from "../../../src/commands/shim/dispatch";
import { shimInstallExecute, shimStatusExecute, shimUninstallExecute } from "../../../src/commands/shim/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

describe(decideShim, () => {
    it("dispatches on agreement, refuses a top-level mismatch", () => {
        expect.hasAssertions();

        expect(decideShim("pnpm", "pnpm", "install", false)).toBe("dispatch");
        expect(decideShim("npm", "pnpm", "install", false)).toBe("refuse");
    });

    it("falls through (dispatch) on a nested mismatch", () => {
        expect.hasAssertions();

        expect(decideShim("npm", "pnpm", "install", true)).toBe("dispatch");
    });

    it("lets transparent verbs and runner shims through despite a mismatch", () => {
        expect.hasAssertions();

        expect(decideShim("npm", "pnpm", "create", false)).toBe("dispatch");
        expect(decideShim("npx", "pnpm", "anything", false)).toBe("dispatch");
    });

    it("dispatches when there is no pin", () => {
        expect.hasAssertions();

        expect(decideShim("yarn", undefined, "install", false)).toBe("dispatch");
    });
});

const SHIM_NAMES = ["npm", "npx", "pnpm", "pnpx", "yarn", "yarnpkg"];

const makeToolbox = (cwd: string): { calls: string[]; exitCodes: number[]; toolbox: unknown } => {
    const calls: string[] = [];
    const exitCodes: number[] = [];

    return {
        calls,
        exitCodes,
        toolbox: {
            console: {
                error: (...a: unknown[]) => calls.push(`error ${a.join(" ")}`),
                log: (...a: unknown[]) => calls.push(a.join(" ")),
            },
            fs,
            process: {
                argv: [process.execPath, "/fake/dist/bin.js"],
                cwd,
                env: {},
                exit: (code: number) => {
                    exitCodes.push(code);
                },
                platform: process.platform,
            },
        },
    };
};

describe("vis shim", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = createTemporaryDirectory("vis-shim-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspace);
    });

    it("install writes a wrapper per PM name that calls __pm-shim", async () => {
        expect.hasAssertions();

        await shimInstallExecute(makeToolbox(workspace).toolbox as never);

        const shimDirectory = join(workspace, ".vis", "shims");

        for (const name of SHIM_NAMES) {
            const file = join(shimDirectory, process.platform === "win32" ? `${name}.cmd` : name);

            expect(existsSync(file)).toBe(true);
            expect(readFileSync(file, "utf8")).toContain(`__pm-shim ${name}`);
        }
    });

    it("status reports not-installed, then installed; uninstall removes the dir", async () => {
        expect.hasAssertions();

        const before = makeToolbox(workspace);

        await shimStatusExecute(before.toolbox as never);

        expect(before.calls.join("\n")).toContain("not installed");

        await shimInstallExecute(makeToolbox(workspace).toolbox as never);

        const after = makeToolbox(workspace);

        await shimStatusExecute(after.toolbox as never);

        expect(after.calls.join("\n")).toContain("installed in");

        await shimUninstallExecute(makeToolbox(workspace).toolbox as never);

        expect(existsSync(join(workspace, ".vis", "shims"))).toBe(false);
    });
});
