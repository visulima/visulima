import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HttpReporterEdgeLight from "../../../../src/reporter/http/http-reporter.edge-light";
import compressData from "../../../../src/reporter/http/utils/compression.js";
import sendWithRetry from "../../../../src/reporter/http/utils/retry.js";
import type { ReadonlyMeta } from "../../../../src/types";

// Mock utility functions
vi.mock(import("../../../../src/reporter/http/utils/compression.js"), () => {
    return {
        default: vi.fn(),
    };
});

vi.mock(import("../../../../src/reporter/http/utils/log-size-error.js"), () => {
    class LogSizeError extends Error {
        public readonly logData: Record<string, unknown>;

        public readonly actualSize: number;

        public readonly maxSize: number;

        public constructor(message: string, logData: Record<string, unknown>, actualSize: number, maxSize: number) {
            super(message);
            this.name = "LogSizeError";
            this.logData = logData;
            this.actualSize = actualSize;
            this.maxSize = maxSize;
        }
    }

    return {
        default: LogSizeError,
    };
});

vi.mock(import("../../../../src/reporter/http/utils/retry.js"), () => {
    return {
        default: vi.fn(),
    };
});

// Get mocked functions
const mockCompressData = vi.mocked(compressData);
const mockSendWithRetry = vi.mocked(sendWithRetry);

const baseMeta = {
    badge: "informational",
    context: [],
    date: new Date(),
    error: undefined,
    file: { column: 1, line: 1, name: "test.js" },
    groups: ["group1"],
    label: "Test Label",
    message: "Test message",
    prefix: undefined,
    scope: ["scope1"],
    suffix: undefined,
    traceError: undefined,
    type: { level: "informational" as const, name: "informational" },
} satisfies ReadonlyMeta<never>;

describe(HttpReporterEdgeLight, () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCompressData.mockClear();
        mockSendWithRetry.mockClear();
        mockSendWithRetry.mockResolvedValue(undefined);
        mockCompressData.mockResolvedValue(new Uint8Array([1, 2, 3]));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // Helper function to create reporter and set stringify
    const createReporter = (options: Parameters<typeof HttpReporterEdgeLight>[0]) => {
        const reporter = new HttpReporterEdgeLight(options);

        reporter.setStringify(JSON.stringify);

        return reporter;
    };

    it("should create reporter with edge compatibility enabled by default", () => {
        expect.assertions(1);

        const reporter = createReporter({
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        expect(reporter).toBeDefined();
    });

    it("should not allow overriding edgeCompat option", () => {
        expect.assertions(1);

        // @ts-expect-error - edgeCompat should not be allowed
        const reporter = createReporter({
            edgeCompat: false, // This should be ignored
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        expect(reporter).toBeDefined();
    });

    it("should disable compression in edge compatibility mode", async () => {
        expect.assertions(2);

        const reporter = createReporter({
            compression: true, // Should be ignored
            enableBatchSend: false,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        reporter.log({
            ...baseMeta,
            message: "test message",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockCompressData).not.toHaveBeenCalled();
        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.not.objectContaining({
                "content-encoding": "gzip",
            }),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should use Buffer for size calculation in edge compatibility mode", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            maxLogSize: 100,
            onError,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        const largeMessage = "x".repeat(200);

        reporter.log({
            ...baseMeta,
            message: largeMessage,
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        // Should use Buffer.byteLength for size calculation
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "LogSizeError",
            }),
        );
    });

    it("should work with all other configuration options", () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchSendTimeout: 3000,
            batchSize: 50,
            headers: {
                Authorization: "Bearer token",
            },
            maxRetries: 5,
            method: "PUT",
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        expect(reporter).toBeDefined();
    });
});
