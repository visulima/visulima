import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("../../../src/io/logger"), () => {
    return { pail: { error: vi.fn(), info: vi.fn(), notice: vi.fn(), success: vi.fn(), warn: vi.fn() } };
});

const addExecuteMock = vi.fn(async () => undefined);

vi.mock(import("../../../src/commands/add/handler"), () => {
    return { default: addExecuteMock };
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
const runInstallMock = vi.fn(() => 0);
const detectLockfileDriftMock = vi.fn(() => undefined);

vi.mock(import("../../../src/pm/pm-runner"), () => {
    return {
        detectLockfileDrift: detectLockfileDriftMock,
        detectPm: detectPmMock,
        resolveInstaller: resolveInstallerMock,
        runInstall: runInstallMock,
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
        argument: undefined,
        logger: { error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() },
        options: {},
        visConfig: undefined,
        workspaceRoot: undefined,
        ...overrides,
    };
};

describe("install passthrough to add", () => {
    beforeEach(() => {
        addExecuteMock.mockClear();
        scanDepsForTyposquatsMock.mockClear();
        runInstallMock.mockClear();
        detectPmMock.mockClear();
        resolveInstallerMock.mockClear();
    });

    afterEach(() => {
        process.exitCode = undefined;
    });

    it("delegates to add handler when positional args are present", async () => {
        expect.assertions(3);

        const { default: install } = await installModulePromise;

        await install(buildToolbox({ argument: ["react"], options: { dev: true } }) as never);

        expect(addExecuteMock).toHaveBeenCalledTimes(1);
        expect(runInstallMock).not.toHaveBeenCalled();

        const passedToolbox = addExecuteMock.mock.calls[0]?.[0] as { argument: string[]; options: Record<string, unknown> };

        expect(passedToolbox.argument).toStrictEqual(["react"]);
    });

    it("maps install --dev → add saveDev:true (camelCase, the form add reads)", async () => {
        expect.assertions(1);

        const { default: install } = await installModulePromise;

        await install(buildToolbox({ argument: ["react"], options: { dev: true } }) as never);

        const passed = addExecuteMock.mock.calls[0]?.[0] as { options: Record<string, unknown> };

        expect(passed.options.saveDev).toBe(true);
    });

    it("maps install --save-optional → add saveOptional:true", async () => {
        expect.assertions(1);

        const { default: install } = await installModulePromise;

        await install(buildToolbox({ argument: ["lodash"], options: { "save-optional": true } }) as never);

        const passed = addExecuteMock.mock.calls[0]?.[0] as { options: Record<string, unknown> };

        expect(passed.options.saveOptional).toBe(true);
    });

    it("forwards kebab --no-X flags as camelCase X:false (the form add handler reads)", async () => {
        // Belt-and-suspenders: cerebro normalizes --no-X to camelCase X:false at parse,
        // but if a caller hand-rolls the toolbox with the kebab key, we still translate.
        expect.assertions(3);

        const { default: install } = await installModulePromise;

        await install(
            buildToolbox({
                argument: ["lodash"],
                options: {
                    "no-marshall-check": true,
                    "no-socket-check": true,
                    "no-typosquat-check": true,
                },
            }) as never,
        );

        const passed = addExecuteMock.mock.calls[0]?.[0] as { options: Record<string, unknown> };

        expect(passed.options.marshallCheck).toBe(false);
        expect(passed.options.socketCheck).toBe(false);
        expect(passed.options.typosquatCheck).toBe(false);
    });

    it("forwards cerebro-normalized X:false through to add handler", async () => {
        // This is the real wire form: cerebro turns `--no-marshall-check` into
        // `marshallCheck: false` before the handler sees it. The add handler reads
        // `.marshallCheck !== false`, so this is the path that actually matters in prod.
        expect.assertions(3);

        const { default: install } = await installModulePromise;

        await install(
            buildToolbox({
                argument: ["lodash"],
                options: {
                    marshallCheck: false,
                    socketCheck: false,
                    typosquatCheck: false,
                },
            }) as never,
        );

        const passed = addExecuteMock.mock.calls[0]?.[0] as { options: Record<string, unknown> };

        expect(passed.options.marshallCheck).toBe(false);
        expect(passed.options.socketCheck).toBe(false);
        expect(passed.options.typosquatCheck).toBe(false);
    });

    it("leaves default-enabled checks undefined (so add handler's `!== false` test stays truthy)", async () => {
        expect.assertions(3);

        const { default: install } = await installModulePromise;

        await install(buildToolbox({ argument: ["lodash"], options: {} }) as never);

        const passed = addExecuteMock.mock.calls[0]?.[0] as { options: Record<string, unknown> };

        expect(passed.options.marshallCheck).toBeUndefined();
        expect(passed.options.socketCheck).toBeUndefined();
        expect(passed.options.typosquatCheck).toBeUndefined();
    });

    it("runs the original install path when no positional args are present", async () => {
        expect.assertions(2);

        const { default: install } = await installModulePromise;

        await install(buildToolbox({ argument: [], options: {} }) as never);

        expect(addExecuteMock).not.toHaveBeenCalled();
        expect(runInstallMock).toHaveBeenCalledTimes(1);
    });
});
