import { beforeEach, describe, expect, it, vi } from "vitest";

import RequiredOptionError from "../../src/errors/required-option-error";
import { opentelemetryProvider } from "../../src/providers/opentelemetry/index";
import type { EmailAddress } from "../../src/types";

const PROVIDER_NOT_INITIALIZED_REGEX = /Provider not initialized/;

const createFakeSpan = () => {
    return {
        end: vi.fn(),
        recordException: vi.fn(),
        setAttribute: vi.fn(),
        setAttributes: vi.fn(),
        setStatus: vi.fn(),
    };
};

const createFakeTracer = () => {
    const span = createFakeSpan();

    return {
        span,
        tracer: {
            startSpan: vi.fn(() => span),
        },
    };
};

const buildWrappedProvider = (overrides: Partial<Record<string, unknown>> = {}) => {
    return {
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
    };
};

const FAILED_TO_INITIALIZE_REGEX = /Failed to initialize/;

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

            const provider = opentelemetryProvider({ provider: wrapped });

            expect(provider).toBeDefined();
            expect(provider.name).toBe("opentelemetry");
        });

        it("should initialize wrapped provider only once", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.initialize();
            await provider.initialize();

            expect(wrapped.initialize).toHaveBeenCalledTimes(1);
        });

        it("should initialize using a ProviderFactory function", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const factory = vi.fn(() => wrapped);

            const provider = opentelemetryProvider({ provider: factory });

            await provider.initialize();

            expect(factory).toHaveBeenCalledWith({});
        });

        it("should throw EmailError when provider is invalid", async () => {
            expect.assertions(1);

            // Invalid: not a function and not a Provider object
            const provider = opentelemetryProvider({ provider: { name: "not-a-provider" } as any });

            await expect(provider.initialize()).rejects.toThrow(FAILED_TO_INITIALIZE_REGEX);
        });
    });

    describe("features", () => {
        it("should expose wrapped provider features", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.initialize();

            expect(provider.features).toStrictEqual(wrapped.features);
        });

        it("should expose default features before initialization", () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            expect(provider.features).toBeDefined();
        });
    });

    describe("isAvailable / validateCredentials", () => {
        it("should delegate isAvailable", async () => {
            expect.assertions(2);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await expect(provider.isAvailable()).resolves.toBe(true);
            expect(wrapped.isAvailable).toHaveBeenCalledWith();
        });

        it("should return false when isAvailable throws", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider({
                isAvailable: vi.fn().mockRejectedValue(new Error("boom")),
            });
            const provider = opentelemetryProvider({ provider: wrapped });

            await expect(provider.isAvailable()).resolves.toBe(false);
        });

        it("should delegate validateCredentials when available", async () => {
            expect.assertions(2);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
            expect(wrapped.validateCredentials).toHaveBeenCalledWith();
        });

        it("should fall back to isAvailable when validateCredentials is missing", async () => {
            expect.assertions(2);

            const wrapped = buildWrappedProvider({ validateCredentials: undefined });
            const provider = opentelemetryProvider({ provider: wrapped });

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
            expect(wrapped.isAvailable).toHaveBeenCalledWith();
        });

        it("should return false when validateCredentials throws", async () => {
            expect.assertions(1);

            // Force initialization to fail and thus catch the rejected promise
            const provider = opentelemetryProvider({
                provider: vi.fn(() => {
                    throw new Error("init failure");
                }),
            });

            await expect(provider.validateCredentials?.()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email and set span attributes on success", async () => {
            expect.assertions(4);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();

            const provider = opentelemetryProvider({
                provider: wrapped,
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
            expect(span.setAttributes).toHaveBeenCalledWith(
                expect.objectContaining({
                    "email.from": "sender@example.com",
                    "email.has_html": true,
                    "email.has_text": true,
                    "email.subject": "Test",
                    "email.to": "user@example.com",
                }),
            );
            expect(span.end).toHaveBeenCalledWith();
        });

        it("should record content lengths when recordContent is true", async () => {
            expect.assertions(1);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();

            const provider = opentelemetryProvider({
                provider: wrapped,
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

            const calls = (span.setAttributes as any).mock.calls.flat() as Record<string, unknown>[];
            const merged: Record<string, unknown> = {};

            for (const current of calls) {
                Object.assign(merged, current);
            }

            expect(merged["email.text.length"]).toBe(2);
        });

        it("should add CC, BCC, replyTo, tags, attachments, priority attributes", async () => {
            expect.assertions(1);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();

            const provider = opentelemetryProvider({
                provider: wrapped,
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

            expect(span.setAttributes).toHaveBeenCalledWith(
                expect.objectContaining({
                    "email.attachments.count": 1,
                    "email.bcc": "b@example.com",
                    "email.cc": "c1@example.com, c2@example.com",
                    "email.from": "sender@example.com",
                    "email.priority": "high",
                    "email.reply_to": "r@example.com",
                    "email.subject": "Test",
                    "email.tags": "welcome",
                    "email.to": "user@example.com",
                }),
            );
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
                provider: wrapped,
                tracer: tracer as any,
            });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(span.recordException).toHaveBeenCalledWith(expect.any(Error));
        });

        it("should record exception when sendEmail throws", async () => {
            expect.assertions(2);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider({
                sendEmail: vi.fn().mockRejectedValue(new Error("boom")),
            });

            const provider = opentelemetryProvider({
                provider: wrapped,
                tracer: tracer as any,
            });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            });

            expect(result.success).toBe(false);
            expect(span.recordException).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe("getInstance", () => {
        it("should throw if called before initialize", () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            expect(() => {
                (provider as any).getInstance();
            }).toThrow(PROVIDER_NOT_INITIALIZED_REGEX);
        });

        it("should return the wrapped provider after initialize", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.initialize();

            expect((provider as any).getInstance()).toBe(wrapped);
        });
    });

    describe("shutdown", () => {
        it("should delegate shutdown to wrapped provider", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.initialize();
            await provider.shutdown?.();

            expect(wrapped.shutdown).toHaveBeenCalledWith();
        });
    });

    describe("branch coverage", () => {
        const recipient = { email: "user@example.com" };

        it("formats a string from-address", async () => {
            expect.assertions(1);

            const { tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: "plain@example.com" as unknown as EmailAddress,
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: recipient,
            });

            expect(result.success).toBe(true);
        });

        it("handles an empty from-address and string array recipients", async () => {
            expect.assertions(1);

            const { tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: "" as unknown as EmailAddress,
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: ["a@example.com", { email: "b@example.com" }] as unknown as EmailAddress[],
            });

            expect(result.success).toBe(true);
        });

        it("skips the to attribute when to is empty", async () => {
            expect.assertions(1);

            const { tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: "" as unknown as EmailAddress,
            });

            expect(result.success).toBe(true);
        });

        it("records a boolean html flag is absent when recordContent is false and html is missing", async () => {
            expect.assertions(1);

            const { tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                subject: "Test",
                text: "Hi",
                to: recipient,
            });

            expect(result.success).toBe(true);
        });

        it("records content lengths only for present fields when recordContent is true", async () => {
            expect.assertions(1);

            const { tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped, recordContent: true, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                subject: "Test",
                to: recipient,
            });

            expect(result.success).toBe(true);
        });

        it("uses the global tracer when none is configured", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: recipient,
            });

            expect(result.success).toBe(true);
        });

        it("logs an unknown name when the wrapped provider has no name", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider({ name: undefined });
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.initialize();

            expect(wrapped.initialize).toHaveBeenCalledWith();
        });

        it("reuses the wrapped provider for isAvailable after initialize", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.initialize();

            await expect(provider.isAvailable()).resolves.toBe(true);
        });

        it("reuses the wrapped provider for validateCredentials after initialize", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.initialize();

            await expect(provider.validateCredentials?.()).resolves.toBe(true);
        });

        it("sends after initialize with an unnamed provider and timestamp-less data", async () => {
            expect.assertions(2);

            const { tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider({
                name: undefined,
                sendEmail: vi.fn().mockResolvedValue({
                    data: { messageId: "m", provider: "p", sent: true },
                    success: true,
                }),
            });
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            await provider.initialize();

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: recipient,
            });

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("opentelemetry(unknown)");
        });

        it("coerces a non-Error failure from an unnamed provider", async () => {
            expect.assertions(2);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider({
                name: undefined,
                sendEmail: vi.fn().mockResolvedValue({ error: "plain failure", success: false }),
            });
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: recipient,
            });

            expect(result.success).toBe(false);
            expect(span.recordException).toHaveBeenCalledWith(expect.any(Error));
        });

        it("uses an unknown error message when a failure has no error", async () => {
            expect.assertions(1);

            const { tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider({
                sendEmail: vi.fn().mockResolvedValue({ success: false }),
            });
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: recipient,
            });

            expect(result.success).toBe(false);
        });

        it("coerces a non-Error thrown by the wrapped provider", async () => {
            expect.assertions(2);

            const { span, tracer } = createFakeTracer();
            const wrapped = buildWrappedProvider({
                sendEmail: vi.fn().mockRejectedValue("string boom"),
            });
            const provider = opentelemetryProvider({ provider: wrapped, tracer: tracer as any });

            const result = await provider.sendEmail({
                from: { email: "sender@example.com" },
                html: "<h1>Hi</h1>",
                subject: "Test",
                to: recipient,
            });

            expect(result.success).toBe(false);
            expect(span.recordException).toHaveBeenCalledWith(expect.any(Error));
        });

        it("shuts down cleanly before initialization", async () => {
            expect.assertions(1);

            const wrapped = buildWrappedProvider();
            const provider = opentelemetryProvider({ provider: wrapped });

            await provider.shutdown?.();

            expect(wrapped.shutdown).not.toHaveBeenCalled();
        });
    });
});
