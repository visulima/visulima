import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HttpReporter from "../../../../src/reporter/http/http-reporter";
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

describe(HttpReporter, () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockCompressData.mockClear();
        mockSendWithRetry.mockClear();
        // Set up default mock implementations
        mockSendWithRetry.mockResolvedValue(undefined);
        mockCompressData.mockResolvedValue(new Uint8Array([1, 2, 3]));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // Helper function to create reporter and set stringify
    const createReporter = (options: Parameters<typeof HttpReporter>[0]) => {
        const reporter = new HttpReporter(options);

        reporter.setStringify(JSON.stringify);

        return reporter;
    };

    it("should create reporter with default values", () => {
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

    it("should create reporter with custom configuration", () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchSendDelimiter: ",",
            batchSendTimeout: 3000,
            batchSize: 50,
            compression: true,
            enableBatchSend: false,
            headers: {
                Authorization: "Bearer test-token",
            },
            maxLogSize: 2_097_152, // 2MB
            maxPayloadSize: 10_485_760, // 10MB
            maxRetries: 5,
            method: "PUT",
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                    timestamp: new Date().toISOString(),
                }),
            respectRateLimit: false,
            retryDelay: 2000,
            url: "https://api.example.com/logs",
        });

        expect(reporter).toBeDefined();
    });

    it("should create reporter with dynamic headers function", () => {
        expect.assertions(1);

        const getHeaders = () => {
            return {
                Authorization: "Bearer dynamic-token",
            };
        };

        const reporter = createReporter({
            headers: getHeaders,
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

    it("should create reporter with error and debug callbacks", () => {
        expect.assertions(1);

        const onError = vi.fn();
        const onDebug = vi.fn();

        const reporter = createReporter({
            onDebug,
            onError,
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

    it("should handle log entry size validation", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            maxLogSize: 100, // Very small limit for testing
            onError,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        // Create a large message that will exceed the size limit
        const largeMessage = "x".repeat(200);

        reporter.log({
            ...baseMeta,
            message: largeMessage,
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining("Log entry exceeds maximum size"),
                name: "LogSizeError",
            }),
        );
    });

    it("should send log immediately when batch sending is disabled", async () => {
        expect.assertions(1);

        const reporter = createReporter({
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

        expect(mockSendWithRetry).toHaveBeenCalledTimes(1);
    });

    it("should batch logs when batch sending is enabled", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchSendTimeout: 5000,
            batchSize: 2,
            enableBatchSend: true,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        // Send two logs to trigger batch
        reporter.log({
            ...baseMeta,
            message: "message 1",
            type: { level: "informational", name: "informational" },
        });

        reporter.log({
            ...baseMeta,
            message: "message 2",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        // Should send batch after reaching batchSize
        expect(mockSendWithRetry).toHaveBeenCalledTimes(1);
    });

    it("should send batch after timeout", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchSendTimeout: 1000,
            batchSize: 100, // Large batch size
            enableBatchSend: true,
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

        // Fast-forward time to trigger timeout
        vi.advanceTimersByTime(1000);

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledTimes(1);
    });

    it("should use compression when enabled", async () => {
        expect.assertions(2);

        const reporter = createReporter({
            compression: true,
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

        expect(mockCompressData).toHaveBeenCalledWith(expect.stringContaining("\"level\":\"informational\""));
        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.objectContaining({
                "content-encoding": "gzip",
            }),
            expect.any(Uint8Array),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should disable compression in edge compatibility mode", async () => {
        expect.assertions(2);

        const reporter = createReporter({
            compression: true, // This should be ignored when edge compat is enabled
            edgeCompat: true,
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

    it("should use custom content types", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchContentType: "text/plain",
            contentType: "application/xml",
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

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.objectContaining({
                "content-type": "application/xml",
            }),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should respect user-specified content-type in headers", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            contentType: "application/json", // This should be ignored
            enableBatchSend: false,
            headers: {
                "content-type": "application/xml",
            },
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

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.objectContaining({
                "content-type": "application/xml",
            }),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should use batchMode array when specified", async () => {
        expect.assertions(3);

        const reporter = createReporter({
            batchMode: "array",
            batchSize: 2,
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
            message: "message 1",
            type: { level: "informational", name: "informational" },
        });

        reporter.log({
            ...baseMeta,
            message: "message 2",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledTimes(1);

        const callArgs = mockSendWithRetry.mock.calls[0];
        const body = callArgs[3] as string;

        // Should be a JSON array
        expect(() => JSON.parse(body)).not.toThrow();

        const parsed = JSON.parse(body);

        expect(Array.isArray(parsed)).toBe(true);
    });

    it("should use batchMode field when specified", async () => {
        expect.assertions(4);

        const reporter = createReporter({
            batchFieldName: "logs",
            batchMode: "field",
            batchSize: 2,
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
            message: "message 1",
            type: { level: "informational", name: "informational" },
        });

        reporter.log({
            ...baseMeta,
            message: "message 2",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledTimes(1);

        const callArgs = mockSendWithRetry.mock.calls[0];
        const body = callArgs[3] as string;

        // Should be a JSON object with "logs" field
        expect(() => JSON.parse(body)).not.toThrow();

        const parsed = JSON.parse(body);

        expect(parsed).toHaveProperty("logs");
        expect(Array.isArray(parsed.logs)).toBe(true);
    });

    it("should throw error when batchMode is field but batchFieldName is not provided", () => {
        expect.assertions(1);
        expect(() => {
            createReporter({
                batchMode: "field",
                payloadTemplate: ({ data, logLevel, message }) =>
                    JSON.stringify({
                        level: logLevel,
                        message,
                        metadata: data,
                    }),
                url: "https://api.example.com/logs",
            });
        }).toThrow("batchFieldName is required when batchMode is 'field'");
    });

    it("should call onDebug callback when provided", async () => {
        expect.assertions(1);

        const onDebug = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            onDebug,
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

        expect(onDebug).toHaveBeenCalledWith(
            expect.objectContaining({
                logLevel: "informational",
                message: "test message",
            }),
        );
    });

    it("should call onError callback when sendWithRetry fails", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        mockSendWithRetry.mockRejectedValueOnce(new Error("Network error"));

        const reporter = createReporter({
            enableBatchSend: false,
            onError,
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

        expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle payload size tracking in batching", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchSendTimeout: 10_000, // Long timeout so we don't trigger time-based sending
            batchSize: 10, // Large batch size so we don't trigger count-based sending
            enableBatchSend: true,
            maxPayloadSize: 1000, // Small payload limit for testing
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        // Add several messages
        for (let i = 0; i < 5; i += 1) {
            reporter.log({
                ...baseMeta,
                message: `Message ${i}`,
                type: { level: "informational", name: "informational" },
            });
        }

        await vi.runAllTimersAsync();

        // The transport should handle the payload size tracking internally
        expect(reporter).toBeDefined();
    });

    it("should use default size limits", () => {
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

    it("should handle size validation with edge compatibility", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        const reporter = createReporter({
            edgeCompat: true,
            enableBatchSend: false,
            maxLogSize: 100, // Very small limit for testing
            onError,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        // Create a large message that will exceed the size limit
        const largeMessage = "x".repeat(200);

        reporter.log({
            ...baseMeta,
            message: largeMessage,
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining("Log entry exceeds maximum size"),
                name: "LogSizeError",
            }),
        );
    });

    it("should use custom delimiter for batch mode", async () => {
        expect.assertions(2);

        const reporter = createReporter({
            batchSendDelimiter: ",",
            batchSize: 2,
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
            message: "message 1",
            type: { level: "informational", name: "informational" },
        });

        reporter.log({
            ...baseMeta,
            message: "message 2",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledTimes(1);

        const callArgs = mockSendWithRetry.mock.calls[0];
        const body = callArgs[3] as string;

        // Should contain the custom delimiter
        expect(body).toContain(",");
    });

    it("should handle errors during payload processing", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        const reporter = createReporter({
            enableBatchSend: false,
            onError,
            payloadTemplate: () => {
                throw new Error("Template error");
            },
            url: "https://api.example.com/logs",
        });

        reporter.log({
            ...baseMeta,
            message: "test message",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle compression failure gracefully", async () => {
        expect.assertions(2);

        const onError = vi.fn();

        mockCompressData.mockRejectedValueOnce(new Error("Compression failed"));

        const reporter = createReporter({
            compression: true,
            enableBatchSend: false,
            onError,
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

        // Should still send without compression
        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(Object),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            expect.any(Function),
        );
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Compression failed") }));
    });

    it("should use custom HTTP method", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            enableBatchSend: false,
            method: "PUT",
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

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            "PUT",
            expect.objectContaining({
                "content-type": "application/json",
            }),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should use default POST method when not specified", async () => {
        expect.assertions(1);

        const reporter = createReporter({
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

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            "https://api.example.com/logs",
            "POST",
            expect.objectContaining({
                "content-type": "application/json",
            }),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should pass retry configuration to sendWithRetry", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            enableBatchSend: false,
            maxRetries: 5,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            respectRateLimit: false,
            retryDelay: 2000,
            url: "https://api.example.com/logs",
        });

        reporter.log({
            ...baseMeta,
            message: "test message",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            "https://api.example.com/logs",
            "POST",
            expect.objectContaining({
                "content-type": "application/json",
            }),
            expect.any(String),
            5, // maxRetries
            2000, // retryDelay
            false, // respectRateLimit
            undefined, // onDebugRequestResponse (not provided)
            undefined, // onError (not provided)
        );
    });

    it("should handle context data in payload template", async () => {
        expect.assertions(2);

        const reporter = createReporter({
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
            context: [{ action: "login", userId: "123" }],
            message: "test message",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(Object),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );

        const callArgs = mockSendWithRetry.mock.calls[0];
        const body = callArgs[3] as string;
        const parsed = JSON.parse(body);

        expect(parsed.metadata).toStrictEqual([{ action: "login", userId: "123" }]);
    });

    it("should handle error objects in context", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            enableBatchSend: false,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        const testError = new Error("Test error");

        reporter.log({
            ...baseMeta,
            error: testError,
            message: "test message",
            type: { level: "error", name: "error" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(Object),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should call onDebugRequestResponse callback when provided", async () => {
        expect.assertions(1);

        const onDebugRequestResponse = vi.fn();

        // Mock sendWithRetry to call onDebugRequestResponse
        mockSendWithRetry.mockImplementationOnce(
            async (_url, _method, _headers, _body, _maxRetries, _retryDelay, _respectRateLimit, onDebugRequestResponseCallback) => {
                if (onDebugRequestResponseCallback) {
                    onDebugRequestResponseCallback({
                        req: {
                            body: "test",
                            headers: {},
                            method: "POST",
                            url: "https://api.example.com/logs",
                        },
                        res: {
                            body: "Success",
                            headers: {},
                            status: 200,
                            statusText: "OK",
                        },
                    });
                }
            },
        );

        const reporter = createReporter({
            enableBatchSend: false,
            onDebugRequestResponse,
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

        expect(onDebugRequestResponse).toHaveBeenCalledWith(
            expect.objectContaining({
                req: expect.objectContaining({
                    method: "POST",
                    url: "https://api.example.com/logs",
                }),
                res: expect.objectContaining({
                    status: 200,
                    statusText: "OK",
                }),
            }),
        );
    });

    it("should handle HTTP error responses via onError callback", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        // Mock sendWithRetry to call onError with a 404 error
        mockSendWithRetry.mockImplementationOnce(
            async (_url, _method, _headers, _body, _maxRetries, _retryDelay, _respectRateLimit, _onDebugRequestResponse, onErrorCallback) => {
                if (onErrorCallback) {
                    onErrorCallback(new Error("HTTP 404: Not Found"));
                }

                throw new Error("HTTP 404: Not Found");
            },
        );

        const reporter = createReporter({
            enableBatchSend: false,
            maxRetries: 0, // Disable retries for this test
            onError,
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

        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "HTTP 404: Not Found" }));
    });

    it("should handle successful HTTP responses without calling onError", async () => {
        expect.assertions(1);

        const onError = vi.fn();

        mockSendWithRetry.mockResolvedValueOnce(undefined);

        const reporter = createReporter({
            enableBatchSend: false,
            onError,
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

        expect(onError).not.toHaveBeenCalled();
    });

    it("should handle various HTTP error status codes", async () => {
        expect.assertions(6);

        const onError = vi.fn();

        const testCases = [
            { status: 400, statusText: "Bad Request" },
            { status: 401, statusText: "Unauthorized" },
            { status: 403, statusText: "Forbidden" },
            { status: 500, statusText: "Internal Server Error" },
            { status: 502, statusText: "Bad Gateway" },
            { status: 503, statusText: "Service Unavailable" },
        ];

        for (const testCase of testCases) {
            onError.mockClear();
            mockSendWithRetry.mockClear();

            mockSendWithRetry.mockImplementationOnce(
                async (_url, _method, _headers, _body, _maxRetries, _retryDelay, _respectRateLimit, _onDebugRequestResponse, onErrorCallback) => {
                    if (onErrorCallback) {
                        onErrorCallback(new Error(`HTTP ${testCase.status}: ${testCase.statusText}`));
                    }

                    throw new Error(`HTTP ${testCase.status}: ${testCase.statusText}`);
                },
            );

            const reporter = createReporter({
                enableBatchSend: false,
                maxRetries: 0,
                onError,
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

            // eslint-disable-next-line no-await-in-loop
            await vi.runAllTimersAsync();

            expect(onError).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: `HTTP ${testCase.status}: ${testCase.statusText}`,
                }),
            );
        }
    });

    it("should use default payload template when not provided", async () => {
        expect.assertions(2);

        const reporter = createReporter({
            enableBatchSend: false,
            url: "https://api.example.com/logs",
        });

        reporter.log({
            ...baseMeta,
            message: "test message",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(Object),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );

        const callArgs = mockSendWithRetry.mock.calls[0];
        const body = callArgs[3] as string;

        // Should be valid JSON
        expect(() => JSON.parse(body)).not.toThrow();
    });

    it("should handle empty message", async () => {
        expect.assertions(1);

        const reporter = createReporter({
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
            message: "",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(Object),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should handle missing data in payload template", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            enableBatchSend: false,
            payloadTemplate: ({ logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                }),
            url: "https://api.example.com/logs",
        });

        reporter.log({
            ...baseMeta,
            message: "test message",
            type: { level: "informational", name: "informational" },
        });

        await vi.runAllTimersAsync();

        expect(mockSendWithRetry).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            expect.any(Object),
            expect.any(String),
            expect.any(Number),
            expect.any(Number),
            expect.any(Boolean),
            undefined,
            undefined,
        );
    });

    it("should process multiple batches correctly", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchSize: 2,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        // Send 5 messages, should create 3 batches (2+2+1)
        for (let i = 0; i < 5; i += 1) {
            reporter.log({
                ...baseMeta,
                message: `message ${i}`,
                type: { level: "informational", name: "informational" },
            });
        }

        await vi.runAllTimersAsync();

        // Should send 3 batches
        expect(mockSendWithRetry).toHaveBeenCalledTimes(3);
    });

    it("should handle batch queue processing correctly", async () => {
        expect.assertions(1);

        const reporter = createReporter({
            batchSendTimeout: 1000,
            batchSize: 3,
            payloadTemplate: ({ data, logLevel, message }) =>
                JSON.stringify({
                    level: logLevel,
                    message,
                    metadata: data,
                }),
            url: "https://api.example.com/logs",
        });

        // Send 2 messages (less than batchSize)
        reporter.log({
            ...baseMeta,
            message: "message 1",
            type: { level: "informational", name: "informational" },
        });

        reporter.log({
            ...baseMeta,
            message: "message 2",
            type: { level: "informational", name: "informational" },
        });

        // Fast-forward time to trigger timeout
        vi.advanceTimersByTime(1000);

        await vi.runAllTimersAsync();

        // Should send batch after timeout
        expect(mockSendWithRetry).toHaveBeenCalledTimes(1);
    });
});
