import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { Toolbox } from "../../../src/types/toolbox";

const { ciInfoMock, getEnvMock, hasNewVersionMock } = vi.hoisted(() => {
    return {
        ciInfoMock: { isCI: false },
        getEnvMock: vi.fn(),
        hasNewVersionMock: vi.fn(),
    };
});

vi.mock(import("ci-info"), () => ciInfoMock);

vi.mock(import("../../../src/util/general/runtime-process"), () => {
    return {
        getEnv: getEnvMock,
    };
});

vi.mock(import("../../../src/plugins/update-notifier/has-new-version"), () => {
    return {
        default: hasNewVersionMock,
    };
});

// eslint-disable-next-line import/first
import { updateNotifierPlugin } from "../../../src/plugins/update-notifier/update-notifier-plugin";

interface MakeToolboxOptions {
    argv?: string[];
    // Use union types (not `?:`) so callers can explicitly pass `undefined`
    // to opt out of the "my-cli" / "1.0.0" defaults.
    packageName?: string;
    packageVersion?: string;
}

const makeToolbox = (overrides: MakeToolboxOptions = {}): Toolbox => {
    const logger = {
        debug: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
    };

    const packageName = "packageName" in overrides ? overrides.packageName : "my-cli";
    const packageVersion = "packageVersion" in overrides ? overrides.packageVersion : "1.0.0";

    const toolbox = {
        argv: overrides.argv ?? [],
        logger,
        runtime: {
            getPackageName: () => packageName,
            getPackageVersion: () => packageVersion,
        },
    };

    return toolbox as unknown as Toolbox;
};

const runBefore = async (plugin: ReturnType<typeof updateNotifierPlugin>, toolbox: Toolbox): Promise<void> => {
    const hook = plugin.beforeCommand;

    if (!hook) {
        throw new Error("plugin.beforeCommand is not defined");
    }

    await hook(toolbox);
};

const getFirstCallArgument = (mock: ReturnType<typeof vi.fn>, label: string): unknown => {
    const [args] = mock.mock.calls;

    if (!args) {
        throw new Error(`${label} was not called`);
    }

    return args[0];
};

describe(updateNotifierPlugin, () => {
    beforeEach(() => {
        getEnvMock.mockReset();
        hasNewVersionMock.mockReset();
        getEnvMock.mockReturnValue({});
        ciInfoMock.isCI = false;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("exposes the expected plugin shape", () => {
        expect.assertions(3);

        const plugin = updateNotifierPlugin();

        expect(plugin.name).toBe("update-notifier");
        expect(plugin.version).toBe("1.0.0");
        expect(plugin.description).toContain("Checks for package updates");

        expectTypeOf(plugin.beforeCommand).toBeFunction();
    });

    it("skips check when packageName is missing", async () => {
        expect.assertions(2);

        const plugin = updateNotifierPlugin();
        const toolbox = makeToolbox({ packageName: undefined });

        await runBefore(plugin, toolbox);

        expect(toolbox.logger.debug).toHaveBeenCalledWith(expect.stringContaining("package name or version not provided"));
        expect(hasNewVersionMock).not.toHaveBeenCalled();
    });

    it("skips check when packageVersion is missing", async () => {
        expect.assertions(1);

        const plugin = updateNotifierPlugin();
        const toolbox = makeToolbox({ packageVersion: undefined });

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).not.toHaveBeenCalled();
    });

    it("skips check when NO_UPDATE_NOTIFIER env is set", async () => {
        expect.assertions(2);

        getEnvMock.mockReturnValue({ NO_UPDATE_NOTIFIER: "1" });

        const plugin = updateNotifierPlugin();
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(toolbox.logger.debug).toHaveBeenCalledWith(expect.stringContaining("disabled by environment or flags"));
        expect(hasNewVersionMock).not.toHaveBeenCalled();
    });

    it("skips check when NODE_ENV=test", async () => {
        expect.assertions(1);

        getEnvMock.mockReturnValue({ NODE_ENV: "test" });

        const plugin = updateNotifierPlugin();
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).not.toHaveBeenCalled();
    });

    it("skips check when --no-update-notifier is in argv", async () => {
        expect.assertions(1);

        const plugin = updateNotifierPlugin();
        const toolbox = makeToolbox({ argv: ["build", "--no-update-notifier"] });

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).not.toHaveBeenCalled();
    });

    it("skips check when running in CI", async () => {
        expect.assertions(1);

        ciInfoMock.isCI = true;

        const plugin = updateNotifierPlugin();
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).not.toHaveBeenCalled();
    });

    it("runs check when alwaysRun=true, even in CI / test", async () => {
        expect.assertions(1);

        ciInfoMock.isCI = true;
        getEnvMock.mockReturnValue({ NO_UPDATE_NOTIFIER: "1", NODE_ENV: "test" });
        hasNewVersionMock.mockResolvedValue(undefined);

        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).toHaveBeenCalledTimes(1);
    });

    it("does NOT print a box when no new version is available", async () => {
        expect.assertions(3);

        hasNewVersionMock.mockResolvedValue(undefined);

        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).toHaveBeenCalledTimes(1);
        expect(toolbox.logger.error).not.toHaveBeenCalled();
        expect(toolbox.logger.log).not.toHaveBeenCalled();
    });

    it("prints a boxed message via logger.log (not logger.error) when a new version is available", async () => {
        expect.assertions(3);

        hasNewVersionMock.mockResolvedValue("2.0.0");

        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox({ packageName: "my-cli", packageVersion: "1.0.0" });

        await runBefore(plugin, toolbox);

        expect(toolbox.logger.log).toHaveBeenCalledTimes(1);
        expect(toolbox.logger.error).not.toHaveBeenCalled();

        // Box wraps the template, but the core message components must be present.

        const logMock = toolbox.logger.log as unknown as ReturnType<typeof vi.fn>;
        const message = getFirstCallArgument(logMock, "logger.log") as string;

        expect(message).toContain("2.0.0");
    });

    it("does not print a 'Checking for updates...' line on every run", async () => {
        expect.assertions(2);

        hasNewVersionMock.mockResolvedValue(undefined);

        const rawSpy = vi.fn();
        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        (toolbox.logger as any).raw = rawSpy;

        await runBefore(plugin, toolbox);

        expect(rawSpy).not.toHaveBeenCalled();
        expect(toolbox.logger.log).not.toHaveBeenCalled();
    });

    it("passes a request timeout into hasNewVersion", async () => {
        expect.assertions(1);

        hasNewVersionMock.mockResolvedValue(undefined);

        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).toHaveBeenCalledWith(expect.objectContaining({ timeout: expect.any(Number) }));
    });

    it("swallows errors thrown by hasNewVersion and logs them at debug", async () => {
        expect.assertions(2);

        hasNewVersionMock.mockRejectedValue(new Error("network down"));

        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox();

        await expect(runBefore(plugin, toolbox)).resolves.toBeUndefined();
        expect(toolbox.logger.debug).toHaveBeenCalledWith(expect.stringContaining("failed to check for updates"), expect.any(Error));
    });

    it("propagates package name/version into hasNewVersion call", async () => {
        expect.assertions(1);

        hasNewVersionMock.mockResolvedValue(undefined);

        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox({ packageName: "@scope/cli", packageVersion: "3.4.5" });

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).toHaveBeenCalledWith(
            expect.objectContaining({
                alwaysRun: true,
                pkg: { name: "@scope/cli", version: "3.4.5" },
            }),
        );
    });

    it("enables debug flag when CEREBRO_OUTPUT_LEVEL is 256", async () => {
        expect.assertions(1);

        getEnvMock.mockReturnValue({ CEREBRO_OUTPUT_LEVEL: "256" });
        hasNewVersionMock.mockResolvedValue(undefined);

        const plugin = updateNotifierPlugin({ alwaysRun: true });
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).toHaveBeenCalledWith(expect.objectContaining({ debug: true }));
    });

    it("user-supplied options override defaults", async () => {
        expect.assertions(1);

        hasNewVersionMock.mockResolvedValue(undefined);

        const plugin = updateNotifierPlugin({ alwaysRun: true, distTag: "next", updateCheckInterval: 1000 });
        const toolbox = makeToolbox();

        await runBefore(plugin, toolbox);

        expect(hasNewVersionMock).toHaveBeenCalledWith(expect.objectContaining({ distTag: "next", updateCheckInterval: 1000 }));
    });
});
