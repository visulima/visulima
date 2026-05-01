import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const probeCapabilitiesMock = vi.fn();
const closeMock = vi.fn();
let lastReapiOptions: Record<string, unknown> | undefined;

vi.mock(import("@visulima/task-runner"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("@visulima/task-runner")>();

    class MockReapiRemoteCache {
        public constructor(options: Record<string, unknown>) {
            lastReapiOptions = options;
        }

        public async close(): Promise<void> {
            closeMock();
        }

        public async probeCapabilities(): Promise<unknown> {
            return probeCapabilitiesMock();
        }
    }

    return {
        ...actual,
        ReapiRemoteCache: MockReapiRemoteCache as unknown as typeof actual.ReapiRemoteCache,
    };
});

const { cacheDoctorExecute } = await import("../src/commands/cache/doctor-probe");

interface ToolboxShape {
    argument: unknown[];
    logger: { error: ReturnType<typeof vi.fn>; log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
    options: Record<string, unknown>;
    visConfig: Record<string, unknown> | undefined;
    workspaceRoot: string;
}

const buildToolbox = (options: Record<string, unknown>, visConfig?: Record<string, unknown>): ToolboxShape => {
    return {
        argument: [],
        logger: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        options,
        visConfig,
        workspaceRoot: "/tmp/ws",
    };
};

describe("cacheDoctorExecute", () => {
    let originalFetch: typeof globalThis.fetch;
    let originalExitCode: number | string | undefined;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        originalExitCode = process.exitCode;
        process.exitCode = 0;
        probeCapabilitiesMock.mockReset();
        closeMock.mockReset();
        lastReapiOptions = undefined;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        process.exitCode = originalExitCode;
    });

    describe("missing config", () => {
        it("exits with code 1 when no remote cache is configured and no --url is passed", async () => {
            expect.assertions(1);

            await cacheDoctorExecute(buildToolbox({}, undefined) as never);

            expect(process.exitCode).toBe(1);
        });
    });

    describe("HTTP probe", () => {
        it("infers HTTP backend from https:// URL and reports success", async () => {
            expect.assertions(4);

            const fetchMock = vi.fn().mockResolvedValue({ status: 401 });

            globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
            const toolbox = buildToolbox({}, { taskRunnerOptions: { remoteCache: { url: "https://cache.example.com" } } });

            await cacheDoctorExecute(toolbox as never);

            expect(fetchMock).toHaveBeenCalledTimes(1);
            // HEAD is the probe verb so we don't waste bytes pulling an artifact.
            expect((fetchMock.mock.calls[0]?.[1] as { method: string } | undefined)?.method).toBe("HEAD");
            expect(toolbox.logger.log).toHaveBeenCalledTimes(1);
            expect(process.exitCode).toBe(0);
        });

        it("reports failure when fetch throws (e.g. ECONNREFUSED)", async () => {
            expect.assertions(2);

            globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof globalThis.fetch;
            const toolbox = buildToolbox({}, { taskRunnerOptions: { remoteCache: { url: "https://cache.example.com" } } });

            await cacheDoctorExecute(toolbox as never);

            expect(process.exitCode).toBe(1);
            const output = String(toolbox.logger.log.mock.calls[0]?.[0] ?? "");

            expect(output).toContain("ECONNREFUSED");
        });

        it("--url CLI flag overrides config URL", async () => {
            expect.assertions(1);

            const fetchMock = vi.fn().mockResolvedValue({ status: 200 });

            globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
            const toolbox = buildToolbox(
                { url: "https://override.example.com" },
                { taskRunnerOptions: { remoteCache: { url: "https://config.example.com" } } },
            );

            await cacheDoctorExecute(toolbox as never);

            expect(fetchMock.mock.calls[0]?.[0]).toBe("https://override.example.com");
        });

        it("--format=json emits parseable JSON", async () => {
            expect.assertions(3);

            globalThis.fetch = vi.fn().mockResolvedValue({ status: 401 }) as unknown as typeof globalThis.fetch;
            const toolbox = buildToolbox({ format: "json" }, { taskRunnerOptions: { remoteCache: { url: "https://cache.example.com" } } });

            await cacheDoctorExecute(toolbox as never);

            const payload = JSON.parse(String(toolbox.logger.log.mock.calls[0]?.[0])) as Record<string, unknown>;

            expect(payload.ok).toBe(true);
            expect(payload.backend).toBe("http");
            expect(payload.httpStatus).toBe(401);
        });
    });

    describe("REAPI probe", () => {
        it("infers REAPI backend from grpcs:// URL", async () => {
            expect.assertions(3);

            probeCapabilitiesMock.mockResolvedValue({ digestFunctions: ["SHA256"], maxBatchTotalSizeBytes: 4096 });
            const toolbox = buildToolbox({}, { taskRunnerOptions: { remoteCache: { url: "grpcs://cache.example.com:443" } } });

            await cacheDoctorExecute(toolbox as never);

            expect(probeCapabilitiesMock).toHaveBeenCalledTimes(1);
            expect(closeMock).toHaveBeenCalledTimes(1);
            expect(process.exitCode).toBe(0);
        });

        it("--backend=reapi forces REAPI even when URL looks HTTP-shaped", async () => {
            expect.assertions(2);

            probeCapabilitiesMock.mockResolvedValue({ digestFunctions: ["SHA256"], maxBatchTotalSizeBytes: 16 });
            globalThis.fetch = vi.fn() as unknown as typeof globalThis.fetch;
            const toolbox = buildToolbox(
                { backend: "reapi" },
                { taskRunnerOptions: { remoteCache: { url: "https://cache.example.com" } } },
            );

            await cacheDoctorExecute(toolbox as never);

            // Explicit override beats inference, even when the URL would have routed to HTTP.
            expect(probeCapabilitiesMock).toHaveBeenCalledTimes(1);
            expect(globalThis.fetch).not.toHaveBeenCalled();
        });

        it("forwards REAPI-specific config (instanceName, bearerToken, allowInsecureBearer) to the constructor", async () => {
            expect.assertions(3);

            probeCapabilitiesMock.mockResolvedValue({ digestFunctions: ["SHA256"], maxBatchTotalSizeBytes: 16 });
            const toolbox = buildToolbox({}, {
                taskRunnerOptions: {
                    remoteCache: {
                        allowInsecureBearer: true,
                        bearerToken: "token-xyz",
                        instanceName: "team-alpha",
                        url: "grpcs://cache.example.com:443",
                    },
                },
            });

            await cacheDoctorExecute(toolbox as never);

            expect(lastReapiOptions?.bearerToken).toBe("token-xyz");
            expect(lastReapiOptions?.instanceName).toBe("team-alpha");
            expect(lastReapiOptions?.allowInsecureBearer).toBe(true);
        });

        it("reports failure when probeCapabilities throws and still closes the channel", async () => {
            expect.assertions(3);

            probeCapabilitiesMock.mockRejectedValue(new Error("UNAUTHENTICATED: bad token"));
            const toolbox = buildToolbox({ format: "json" }, { taskRunnerOptions: { remoteCache: { url: "grpcs://cache.example.com:443" } } });

            await cacheDoctorExecute(toolbox as never);

            const payload = JSON.parse(String(toolbox.logger.log.mock.calls[0]?.[0])) as Record<string, unknown>;

            expect(payload.ok).toBe(false);
            expect(String(payload.error)).toContain("UNAUTHENTICATED");
            // Channel must close even on failure so the test process doesn't leak gRPC handles.
            expect(closeMock).toHaveBeenCalledTimes(1);
        });
    });
});
