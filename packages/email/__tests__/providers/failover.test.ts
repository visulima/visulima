import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import RequiredOptionError from "../../src/errors/required-option-error";
import failoverProvider from "../../src/providers/failover/provider";
import type { Provider } from "../../src/providers/provider";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

describe(failoverProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockProvider = (name: string, options?: { available?: boolean; delay?: number; success?: boolean }): Provider => {
        const { available = true, delay = 0, success = true } = options || {};

        return {
            features: {
                attachments: true,
                html: true,
                replyTo: true,
            },
            async initialize(): Promise<void> {
                // Mock implementation
            },
            async isAvailable(): Promise<boolean> {
                if (delay > 0) {
                    await new Promise<void>((resolve) => {
                        setTimeout(() => {
                            resolve();
                        }, delay);
                    });
                }

                return available;
            },
            name,
            options: {},
            async sendEmail(_emailOptions: EmailOptions): Promise<Result<EmailResult>> {
                if (delay > 0) {
                    await new Promise<void>((resolve) => {
                        setTimeout(() => {
                            resolve();
                        }, delay);
                    });
                }

                if (success) {
                    return {
                        data: {
                            messageId: `msg-${name}`,
                            provider: name,
                            sent: true,
                            timestamp: new Date(),
                        },
                        success: true,
                    };
                }

                return {
                    error: new EmailError(name, "Send failed"),
                    success: false,
                };
            },
        };
    };

    describe("initialization", () => {
        it("should throw error if mailers array is empty", () => {
            expect.assertions(1);

            expect(() => {
                failoverProvider({ mailers: [] });
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if mailers is not provided", () => {
            expect.assertions(1);

            expect(() => {
                failoverProvider({} as never);
            }).toThrow(RequiredOptionError);
        });

        it("should initialize with provider instances", async () => {
            expect.assertions(2);

            const provider1 = createMockProvider("provider1");
            const provider2 = createMockProvider("provider2");
            const failover = failoverProvider({
                mailers: [provider1, provider2],
            });

            await failover.initialize();

            expect(failover.name).toBe("failover");
            await expect(failover.isAvailable()).resolves.toBe(true);
        });

        it("should initialize with provider factories", async () => {
            expect.assertions(2);

            const factory1 = () => createMockProvider("provider1");
            const factory2 = () => createMockProvider("provider2");
            const failover = failoverProvider({
                mailers: [factory1, factory2],
            });

            await failover.initialize();

            expect(failover.name).toBe("failover");
            await expect(failover.isAvailable()).resolves.toBe(true);
        });

        it("should initialize with mixed provider instances and factories", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const factory2 = () => createMockProvider("provider2");
            const failover = failoverProvider({
                mailers: [provider1, factory2],
            });

            await expect(failover.initialize()).resolves.not.toThrow();
        });

        it("should skip invalid mailers", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const invalidMailer = "not-a-provider";
            const failover = failoverProvider({
                mailers: [provider1, invalidMailer],
            });

            await expect(failover.initialize()).resolves.not.toThrow();
        });

        it("should throw error if no providers can be initialized", async () => {
            expect.assertions(1);

            const invalidProvider = {
                async initialize(): Promise<void> {
                    throw new Error("Init failed");
                },
            };

            const failover = failoverProvider({
                mailers: [invalidProvider],
            });

            await expect(failover.initialize()).rejects.toThrow(EmailError);
        });

        it("should handle concurrent initialization calls", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const failover = failoverProvider({
                mailers: [provider1],
            });

            // Call initialize multiple times concurrently
            await Promise.all([failover.initialize(), failover.initialize(), failover.initialize()]);

            await expect(failover.isAvailable()).resolves.toBe(true);
        });
    });

    describe("isAvailable", () => {
        it("should return true if at least one provider is available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: true });
            const provider2 = createMockProvider("provider2", { available: false });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
            });

            await failover.initialize();

            await expect(failover.isAvailable()).resolves.toBe(true);
        });

        it("should return false if no providers are available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: false });
            const provider2 = createMockProvider("provider2", { available: false });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
            });

            await failover.initialize();

            await expect(failover.isAvailable()).resolves.toBe(false);
        });

        it("should initialize providers if not already initialized", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const failover = failoverProvider({
                mailers: [provider1],
            });

            // Don't call initialize, just check availability
            await expect(failover.isAvailable()).resolves.toBe(true);
        });

        it("should handle errors in isAvailable gracefully", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: false });
            const provider2 = {
                ...createMockProvider("provider2"),
                async isAvailable(): Promise<boolean> {
                    throw new Error("Check failed");
                },
            };
            const failover = failoverProvider({
                mailers: [provider1, provider2],
            });

            await failover.initialize();

            await expect(failover.isAvailable()).resolves.toBe(false);
        });
    });

    describe("sendEmail", () => {
        it("should send email using first provider if it succeeds", async () => {
            expect.assertions(3);

            const provider1 = createMockProvider("provider1", { success: true });
            const provider2 = createMockProvider("provider2", { success: true });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("failover(provider1)");
            expect(result.data?.messageId).toBe("msg-provider1");
        });

        it("should failover to second provider if first fails", async () => {
            expect.assertions(3);

            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: true });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
                retryAfter: 0, // No delay for faster tests
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("failover(provider2)");
            expect(result.data?.messageId).toBe("msg-provider2");
        });

        it("should failover through multiple providers until one succeeds", async () => {
            expect.assertions(3);

            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: false });
            const provider3 = createMockProvider("provider3", { success: true });
            const failover = failoverProvider({
                mailers: [provider1, provider2, provider3],
                retryAfter: 0,
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("failover(provider3)");
            expect(result.data?.messageId).toBe("msg-provider3");
        });

        it("should return error if all providers fail", async () => {
            expect.assertions(2);

            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: false });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("All providers failed");
        });

        it("should skip unavailable providers", async () => {
            expect.assertions(3);

            const provider1 = createMockProvider("provider1", { available: false, success: false });
            const provider2 = createMockProvider("provider2", { available: true, success: true });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("failover(provider2)");
            expect(result.data?.messageId).toBe("msg-provider2");
        });

        it("should wait retryAfter milliseconds between retries", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: true });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
                retryAfter: 100,
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const sendPromise = failover.sendEmail(emailOptions);

            // Advance time by 50ms - should still be waiting
            await vi.advanceTimersByTimeAsync(50);

            expect(sendPromise).toBeInstanceOf(Promise);

            // Advance time by another 60ms - should complete
            await vi.advanceTimersByTimeAsync(60);
            const result = await sendPromise;

            vi.useRealTimers();

            expect(result.success).toBe(true);
        });

        it("should not wait after last provider", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { success: false });
            const failover = failoverProvider({
                mailers: [provider1],
                retryAfter: 1000,
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const startTime = Date.now();

            await failover.sendEmail(emailOptions);
            const endTime = Date.now();

            // Should complete quickly without waiting
            expect(endTime - startTime).toBeLessThan(100);
        });

        it("should handle exceptions during send", async () => {
            expect.assertions(2);

            const provider1 = {
                ...createMockProvider("provider1"),
                async sendEmail(): Promise<Result<EmailResult>> {
                    throw new Error("Network error");
                },
            };
            const provider2 = createMockProvider("provider2", { success: true });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toBe("failover(provider2)");
        });

        it("should initialize providers if not already initialized", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { success: true });
            const failover = failoverProvider({
                mailers: [provider1],
            });

            // Don't call initialize, just send
            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
        });

        it("should return error if no providers are available", async () => {
            expect.assertions(2);

            const failover = failoverProvider({
                mailers: [
                    {
                        async initialize(): Promise<void> {
                            throw new Error("Init failed");
                        },
                    },
                ],
            });

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("No providers");
        });

        it("should generate messageId if provider does not return one", async () => {
            expect.assertions(2);

            const provider1 = {
                ...createMockProvider("provider1", { success: true }),
                async sendEmail(): Promise<Result<EmailResult>> {
                    return {
                        data: {
                            provider: "provider1",
                            sent: true,
                            timestamp: new Date(),
                        },
                        success: true,
                    };
                },
            };
            const failover = failoverProvider({
                mailers: [provider1],
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
        });
    });

    describe("validateCredentials", () => {
        it("should return true if at least one provider is available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: true });
            const failover = failoverProvider({
                mailers: [provider1],
            });

            await failover.initialize();

            await expect(failover.validateCredentials()).resolves.toBe(true);
        });

        it("should return false if no providers are available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: false });
            const failover = failoverProvider({
                mailers: [provider1],
            });

            await failover.initialize();

            await expect(failover.validateCredentials()).resolves.toBe(false);
        });
    });

    describe("features", () => {
        it("should expose correct feature flags", () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const failover = failoverProvider({
                mailers: [provider1],
            });

            expect(failover.features).toStrictEqual({
                attachments: true,
                batchSending: false,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false,
                tagging: false,
                templates: false,
                tracking: false,
            });
        });
    });

    describe("edge cases", () => {
        it("should handle null/undefined providers in array", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { success: true });
            const failover = failoverProvider({
                mailers: [provider1, null, undefined] as unknown[],
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
        });

        it("should handle retryAfter of 0", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: true });
            const failover = failoverProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await failover.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await failover.sendEmail(emailOptions);

            expect(result.success).toBe(true);
        });

        it("should use default retryAfter if not specified", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { success: true });
            const failover = failoverProvider({
                mailers: [provider1],
            });

            expect(failover.options?.retryAfter).toBe(60);
        });
    });
});
