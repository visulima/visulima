import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { opentelemetryProvider } from "../../src/providers/opentelemetry/index";

const createFakeSpan = () => ({
    end: vi.fn(),
    recordException: vi.fn(),
    setAttribute: vi.fn(),
    setAttributes: vi.fn(),
    setStatus: vi.fn(),
});

const createFakeTracer = () => {
    const span = createFakeSpan();

    return {
        span,
        tracer: {
            startSpan: vi.fn(() => span),
        },
    };
};

const buildWrappedProvider = (overrides: Partial<Record<string, unknown>> = {}) => ({
    features: {
        attachments: true,
        batchSending: false,
        customHeaders: true,
        html: true,
        replyTo: true,
        scheduling: false,
        tagging: false,
        templates: false,
        tracking: false,
    },
    initialize: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockResolvedValue(true),
    name: "mock-provider",
    sendEmail: vi.fn().mockResolvedValue({
        data: {
            messageId: "msg-1",
            provider: "mock-provider",
            sent: true,
            timestamp: new Date(),
        },
        success: true,
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    validateCredentials: vi.fn().mockResolvedValue(true),
    ...overrides,
});

describe(opentelemetryProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should throw error if provider is missing", () => {
            expect.assertions(1);

            expect(() => {
                opentelemetryProvider({} as any);
            }).toThrow(RequiredOptionError);
        });

        it("should create provider with provider instance", () => {
            expect.assertions(2);

            const wrapped = buildWrappedProvider();

            const provider = opentelemetryProvider({ provider: wrapped as any });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("opentelemetry");
        });

        it("should initialize wrapped provider only once", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await provider.initialize();
            await provider.initialize();

            expect(wrapped.initialize).toHaveBeenCalledTimes(1);
        });

        it("should initialize using a ProviderFactory function", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const factory = vi.fn(() => wrapped);

            const provider = opentelemetryProvider({ provider: factory as any });

            await provider.initialize();

            expect(factory).toHaveBeenCalled();
        });

        it("should throw EmailError when provider is invalid", async () => {
            expect.assertions(1);

            // Invalid: not a function and not a Provider object
            const provider = opentelemetryProvider({ provider: { name: "not-a-provider" } as any });

            await expect(provider.initialize()).rejects.toThrow(/Failed to initialize/);
        });
    });

    describe("features", () => {
        it("should expose wrapped provider features", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await provider.initialize();

            expect(provider.features).toStrictEqual(wrapped.features);
        });

        it("should expose default features before initialization", () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            expect(provider.features).toBeDefined();
        });
    });

    describe("isAvailable / validateCredentials", () => {
        it("should delegate isAvailable", async () => {
            expect.assertions(2);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await expect(provider.isAvailable()).resolves.toBe(true);
            expect(wrapped.isAvailable).toHaveBeenCalled();
        });

        it("should return false when isAvailable throws", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider({
                isAvailable: vi.fn().mockRejectedValue(new Error("boom")),
            });
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should delegate validateCredentials when available", async () => {
            expect.assertions(2);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await expect(provider.validateCredentials!()).resolves.toBe(true);
            expect(wrapped.validateCredentials).toHaveBeenCalled();
        });

        it("should fall back to isAvailable when validateCredentials is missing", async () => {
            expect.assertions(2);

            const wrapped = buildWrappedProvider({ validateCredentials: undefined });
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await expect(provider.validateCredentials!()).resolves.toBe(true);
            expect(wrapped.isAvailable).toHaveBeenCalled();
        });

        it("should return false when validateCredentials throws", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider({
                isAvailable: vi.fn().mockRejectedValue(new Error("init failure")),
            });

            // Force initialization to fail and thus catch the rejected promise
            const provider = opentelemetryProvider({
                provider: vi.fn(() => {
                    throw new Error("init failure");
                }) as any,
            });

            await expect(provider.validateCredentials!()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email and set span attributes on success", async () => {
            expect.assertions(4);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();

            const provider = opentelemetryProvider({
                provider: wrapped as any,
                tracer: tracer as any,
            });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                text: "Hi",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(true);
            expect(result.data?.provider).toContain("mock-provider");
            expect(span.setAttributes).toHaveBeenCalled();
            expect(span.end).toHaveBeenCalled();
        });

        it("should record content lengths when recordContent is true", async () => {
            expect.assertions(1);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();

            const provider = opentelemetryProvider({
                provider: wrapped as any,
                recordContent: true,
                tracer: tracer as any,
            });

            await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                text: "Hi",
                to: { email: "user@example.com" },
            });

            const calls = (span.setAttributes as any).mock.calls.flat();
            const merged = calls.reduce((accumulator: Record<string, unknown>, current: Record<string, unknown>) => ({ ...accumulator, ...current }), {});

            expect(merged["email.text.length"]).toBe(2);
        });

        it("should add CC, BCC, replyTo, tags, attachments, priority attributes", async () => {
            expect.assertions(1);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();

            const provider = opentelemetryProvider({
                provider: wrapped as any,
                tracer: tracer as any,
            });

            await provider.sendEmail({
                attachments: [{ content: "x", filename: "a.txt" }],
                bcc: { email: "b@example.com" },
                cc: [{ email: "c1@example.com" }, { email: "c2@example.com" }],
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                priority: "high",
                replyTo: { email: "r@example.com" },
                subject: "Test",
                tags: ["welcome"],
                text: "Hi",
                to: { email: "user@example.com" },
            });

            expect(span.setAttributes).toHaveBeenCalled();
        });

        it("should record error state when wrapped provider returns failure", async () => {
            expect.assertions(2);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider({
                sendEmail: vi.fn().mockResolvedValue({
                    error: new Error("Send failed"),
                    success: false,
                }),
            });

            const provider = opentelemetryProvider({
                provider: wrapped as any,
                tracer: tracer as any,
            });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(span.recordException).toHaveBeenCalled();
        });

        it("should record exception when sendEmail throws", async () => {
            expect.assertions(2);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider({
                sendEmail: vi.fn().mockRejectedValue(new Error("boom")),
            });

            const provider = opentelemetryProvider({
                provider: wrapped as any,
                tracer: tracer as any,
            });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(span.recordException).toHaveBeenCalled();
        });
    });

    describe("getInstance", () => {
        it("should throw if called before initialize", () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            expect(() => (provider as any).getInstance()).toThrow();
        });

        it("should return the wrapped provider after initialize", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await provider.initialize();

            expect((provider as any).getInstance()).toBe(wrapped);
        });
    });

    describe("shutdown", () => {
        it("should delegate shutdown to wrapped provider", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped as any });

            await provider.initialize();
            await provider.shutdown!();

            expect(wrapped.shutdown).toHaveBeenCalled();
        });
    });
});
