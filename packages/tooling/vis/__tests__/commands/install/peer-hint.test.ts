import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PEER_HINT } from "../../../src/util/peer-warnings";

const pailMock = { error: vi.fn(), info: vi.fn(), notice: vi.fn(), success: vi.fn(), warn: vi.fn() };

vi.mock(import("../../../src/io/logger"), () => {
    return { pail: pailMock };
});

const scanDepsForTyposquatsMock = vi.fn(async () => true);

vi.mock(import("../../../src/security/typosquats"), () => {
    return { scanDepsForTyposquats: scanDepsForTyposquatsMock };
});

const detectPmMock = vi.fn(() => {
    return { name: "pnpm", version: "10.0.0" };
});
const resolveInstallerMock = vi.fn(() => {
    return { name: "pnpm", version: "10.0.0" };
});
const detectLockfileDriftMock = vi.fn(() => undefined);

// runInstallCaptured is the single seam — the test injects PM output here
// and asserts the hint plumbing reads it correctly.
const runInstallCapturedMock = vi.fn(async () => {
    return { code: 0, output: "" };
});

vi.mock(import("../../../src/pm/pm-runner"), () => {
    return {
        detectLockfileDrift: detectLockfileDriftMock,
        detectPm: detectPmMock,
        resolveInstaller: resolveInstallerMock,
        runInstallCaptured: runInstallCapturedMock,
    };
});

const installModulePromise = import("../../../src/commands/install/handler");

interface ToolboxShape {
    argument: string[] | undefined;
    logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
    options: Record<string, unknown>;
    visConfig: undefined;
    workspaceRoot: string | undefined;
}

const buildToolbox = (overrides: Partial<ToolboxShape> = {}): ToolboxShape => {
    return {
        argument: [],
        logger: { error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
        options: {},
        visConfig: undefined,
        workspaceRoot: undefined,
        ...overrides,
    };
};

describe("install peer-dep hint surfacing", () => {
    beforeEach(() => {
        pailMock.error.mockClear();
        pailMock.info.mockClear();
        pailMock.notice.mockClear();
        pailMock.success.mockClear();
        pailMock.warn.mockClear();
        runInstallCapturedMock.mockClear();
        runInstallCapturedMock.mockResolvedValue({ code: 0, output: "" });
        scanDepsForTyposquatsMock.mockClear();
        scanDepsForTyposquatsMock.mockResolvedValue(true);
    });

    afterEach(() => {
        process.exitCode = undefined;
    });

    it("surfaces PEER_HINT when the install output contains a pnpm peer warning", async () => {
        expect.assertions(1);

        runInstallCapturedMock.mockResolvedValueOnce({
            code: 0,
            output: " WARN  Issues with peer dependencies found\n",
        });

        const { default: install } = await installModulePromise;

        await install(buildToolbox() as never);

        expect(pailMock.info).toHaveBeenCalledWith(PEER_HINT);
    });

    it("surfaces PEER_HINT for npm ERESOLVE output", async () => {
        expect.assertions(1);

        runInstallCapturedMock.mockResolvedValueOnce({
            code: 0,
            output: "npm WARN ERESOLVE overriding peer dependency\n",
        });

        const { default: install } = await installModulePromise;

        await install(buildToolbox() as never);

        expect(pailMock.info).toHaveBeenCalledWith(PEER_HINT);
    });

    it("does not surface the hint on clean install output", async () => {
        expect.assertions(1);

        runInstallCapturedMock.mockResolvedValueOnce({
            code: 0,
            output: "Done in 4.2s.\n+ react 19.2.0\n",
        });

        const { default: install } = await installModulePromise;

        await install(buildToolbox() as never);

        expect(pailMock.info).not.toHaveBeenCalledWith(PEER_HINT);
    });

    it("does not surface the hint when the install failed (non-zero exit)", async () => {
        // Failure noise often contains peer-dep words too; the hint is meant
        // as a recovery nudge after a *successful* install, so we suppress
        // it on failure to keep the user focused on the actual error.
        expect.assertions(2);

        runInstallCapturedMock.mockResolvedValueOnce({
            code: 1,
            output: " WARN  Issues with peer dependencies found\n",
        });

        const { default: install } = await installModulePromise;

        await install(buildToolbox() as never);

        expect(pailMock.info).not.toHaveBeenCalledWith(PEER_HINT);
        expect(process.exitCode).toBe(1);
    });

    it("does not surface the hint under --silent even when warnings are present", async () => {
        expect.assertions(1);

        runInstallCapturedMock.mockResolvedValueOnce({
            code: 0,
            output: " WARN  Issues with peer dependencies found\n",
        });

        const { default: install } = await installModulePromise;

        await install(buildToolbox({ options: { silent: true } }) as never);

        expect(pailMock.info).not.toHaveBeenCalledWith(PEER_HINT);
    });
});
