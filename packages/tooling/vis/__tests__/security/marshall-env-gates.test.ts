import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pailMock = { error: vi.fn(), info: vi.fn(), notice: vi.fn(), success: vi.fn(), warn: vi.fn() };

vi.mock(import("../../src/io/logger"), () => {
    return { pail: pailMock };
});

vi.mock(import("@visulima/fs"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        isAccessibleSync: vi.fn(() => true),
        readJsonSync: vi.fn(() => {
            return { dependencies: { lodash: "4.17.21" } };
        }),
    };
});

const detectPmMock = vi.fn(() => {
    return { name: "pnpm", version: "10.0.0" };
});

vi.mock(import("../../src/pm/pm-runner"), () => {
    return {
        detectLockfileDrift: vi.fn(() => undefined),
        detectPm: detectPmMock,
        resolveInstaller: vi.fn(() => {
            return { name: "pnpm", version: "10.0.0" };
        }),
        runInstall: vi.fn(() => 0),
    };
});

const emitSecurityWarningsMock = vi.fn();
const enforceScriptSecurityMock = vi.fn(() => {
    return { postInstallPackages: [], warnings: [] };
});
const runApprovedScriptsMock = vi.fn();
const checkPmNativeConfigDriftMock = vi.fn(() => {
    return { hasDrift: false };
});
const formatDriftReportMock = vi.fn(() => []);

vi.mock(import("../../src/security/security"), () => {
    return {
        checkPmNativeConfigDrift: checkPmNativeConfigDriftMock,
        emitSecurityWarnings: emitSecurityWarningsMock,
        enforceScriptSecurity: enforceScriptSecurityMock,
        formatDriftReport: formatDriftReportMock,
        runApprovedScripts: runApprovedScriptsMock,
    };
});

const fetchSocketReportsMock = vi.fn(async () => new Map());
const formatSecurityOverviewMock = vi.fn(() => "");
const buildSocketOptionsMock = vi.fn(() => {
    return { apiKey: "x", minimumScore: 50 };
});

vi.mock(import("../../src/security/socket-security"), () => {
    return {
        buildSocketOptions: buildSocketOptionsMock,
        fetchSocketReports: fetchSocketReportsMock,
        formatSecurityOverview: formatSecurityOverviewMock,
    };
});

const pluginPromise = import("../../src/plugins/security-enforcement");

interface ToolboxShape {
    logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
    visConfig: object | undefined;
    workspaceRoot: string | undefined;
}

const buildToolbox = (overrides: Partial<ToolboxShape> = {}): ToolboxShape => {
    return {
        logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        visConfig: {},
        workspaceRoot: "/tmp/ws",
        ...overrides,
    };
};

describe("security-enforcement plugin env-var gates", () => {
    let originalArgv: string[];
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalArgv = process.argv;
        originalEnv = { ...process.env };

        emitSecurityWarningsMock.mockClear();
        enforceScriptSecurityMock.mockClear();
        runApprovedScriptsMock.mockClear();
        fetchSocketReportsMock.mockClear();
        buildSocketOptionsMock.mockClear();

        delete process.env.MARSHALL_DISABLE_INSTALL_SCRIPTS;
        delete process.env.MARSHALL_DISABLE_SOCKET;
        delete process.env.MARSHALL_DISABLE_ALL;
    });

    afterEach(() => {
        process.argv = originalArgv;
        process.env = originalEnv;
    });

    it("beforeCommand runs enforceScriptSecurity when env is unset", async () => {
        expect.assertions(1);

        process.argv = ["node", "vis", "install"];

        const { default: plugin } = await pluginPromise;

        await plugin.beforeCommand!(buildToolbox() as never);

        expect(enforceScriptSecurityMock).toHaveBeenCalledTimes(1);
    });

    it("short-circuits enforceScriptSecurity when MARSHALL_DISABLE_INSTALL_SCRIPTS is set", async () => {
        expect.assertions(2);

        process.argv = ["node", "vis", "install"];
        process.env.MARSHALL_DISABLE_INSTALL_SCRIPTS = "1";

        const { default: plugin } = await pluginPromise;

        await plugin.beforeCommand!(buildToolbox() as never);

        expect(enforceScriptSecurityMock).not.toHaveBeenCalled();
        // emitSecurityWarnings runs regardless — it's the informational arm,
        // not the enforcement arm.
        expect(emitSecurityWarningsMock).toHaveBeenCalledTimes(1);
    });

    it("short-circuits enforceScriptSecurity when MARSHALL_DISABLE_ALL is set", async () => {
        expect.assertions(1);

        process.argv = ["node", "vis", "install"];
        process.env.MARSHALL_DISABLE_ALL = "1";

        const { default: plugin } = await pluginPromise;

        await plugin.beforeCommand!(buildToolbox() as never);

        expect(enforceScriptSecurityMock).not.toHaveBeenCalled();
    });

    it("afterCommand fetches Socket reports when env is unset", async () => {
        expect.assertions(1);

        process.argv = ["node", "vis", "install"];

        const { default: plugin } = await pluginPromise;

        // visConfig with truthy security shape so buildSocketOptions returns options
        await plugin.afterCommand!(buildToolbox({ visConfig: { security: { socket: { apiKey: "x" } } } }) as never);

        expect(fetchSocketReportsMock).toHaveBeenCalledTimes(1);
    });

    it("skips the Socket overview fetch when MARSHALL_DISABLE_SOCKET is set", async () => {
        expect.assertions(1);

        process.argv = ["node", "vis", "install"];
        process.env.MARSHALL_DISABLE_SOCKET = "1";

        const { default: plugin } = await pluginPromise;

        await plugin.afterCommand!(buildToolbox({ visConfig: { security: { socket: { apiKey: "x" } } } }) as never);

        expect(fetchSocketReportsMock).not.toHaveBeenCalled();
    });
});
