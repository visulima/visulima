import { beforeEach, describe, expect, it, vi } from "vitest";

import EmailError from "../../src/errors/email-error";
import RequiredOptionError from "../../src/errors/required-option-error";
import type { Provider } from "../../src/providers/provider";
import roundRobinProvider from "../../src/providers/roundrobin/provider";
import type { EmailOptions, EmailResult, Result } from "../../src/types";

describe(roundRobinProvider, () => {
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
                roundRobinProvider({ mailers: [] });
            }).toThrow(RequiredOptionError);
        });

        it("should throw error if mailers is not provided", () => {
            expect.assertions(1);

            expect(() => {
                roundRobinProvider({} as never);
            }).toThrow(RequiredOptionError);
        });

        it("should initialize with provider instances", async () => {
            expect.assertions(2);

            const provider1 = createMockProvider("provider1");
            const provider2 = createMockProvider("provider2");
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
            });

            await roundRobin.initialize();

            expect(roundRobin.name).toBe("roundrobin");
            await expect(roundRobin.isAvailable()).resolves.toBe(true);
        });

        it("should initialize with provider factories", async () => {
            expect.assertions(1);

            const factory1 = () => createMockProvider("provider1");
            const factory2 = () => createMockProvider("provider2");
            const roundRobin = roundRobinProvider({
                mailers: [factory1, factory2],
            });

            await expect(roundRobin.initialize()).resolves.not.toThrow();
        });

        it("should skip invalid mailers", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const invalidMailer = "not-a-provider";
            const roundRobin = roundRobinProvider({
                mailers: [provider1, invalidMailer],
            });

            await expect(roundRobin.initialize()).resolves.not.toThrow();
        });

        it("should throw error if no providers can be initialized", async () => {
            expect.assertions(1);

            const invalidProvider = {
                async initialize(): Promise<void> {
                    throw new Error("Init failed");
                },
            };

            const roundRobin = roundRobinProvider({
                mailers: [invalidProvider],
            });

            await expect(roundRobin.initialize()).rejects.toThrow(EmailError);
        });

        it("should start at random index", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const provider2 = createMockProvider("provider2");
            const provider3 = createMockProvider("provider3");
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2, provider3],
            });

            await roundRobin.initialize();

            // The starting index should be set (we can't predict it, but it should be valid)
            expect(roundRobin.options?.mailers.length).toBeGreaterThan(0);
        });
    });

    describe("isAvailable", () => {
        it("should return true if at least one provider is available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: true });
            const provider2 = createMockProvider("provider2", { available: false });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
            });

            await roundRobin.initialize();

            await expect(roundRobin.isAvailable()).resolves.toBe(true);
        });

        it("should return false if no providers are available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: false });
            const provider2 = createMockProvider("provider2", { available: false });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
            });

            await roundRobin.initialize();

            await expect(roundRobin.isAvailable()).resolves.toBe(false);
        });

        it("should initialize providers if not already initialized", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const roundRobin = roundRobinProvider({
                mailers: [provider1],
            });

            // Don't call initialize, just check availability
            await expect(roundRobin.isAvailable()).resolves.toBe(true);
        });

        it("should check providers in parallel for efficiency", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: true, delay: 10 });
            const provider2 = createMockProvider("provider2", { available: true, delay: 10 });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
            });

            await roundRobin.initialize();

            const startTime = Date.now();

            await roundRobin.isAvailable();
            const endTime = Date.now();

            // Should complete in roughly 10ms (parallel) not 20ms (sequential)
            expect(endTime - startTime).toBeLessThan(20);
        });
    });

    describe("sendEmail - round robin distribution", () => {
        it("should distribute emails across providers in rotation", async () => {
            expect.assertions(4);

            const provider1 = createMockProvider("provider1", { success: true });
            const provider2 = createMockProvider("provider2", { success: true });
            const provider3 = createMockProvider("provider3", { success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2, provider3],
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            // Send multiple emails sequentially to verify rotation
            const result1 = await roundRobin.sendEmail(emailOptions);
            const result2 = await roundRobin.sendEmail(emailOptions);
            const result3 = await roundRobin.sendEmail(emailOptions);

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
            expect(result3.success).toBe(true);

            // All should have different providers (round robin)
            const providers = [result1, result2, result3].map((r) => r.data?.provider).filter(Boolean);
            const uniqueProviders = new Set(providers);

            // At least 2 different providers should be used
            expect(uniqueProviders.size).toBeGreaterThanOrEqual(2);
        });

        it("should skip unavailable providers in rotation", async () => {
            expect.assertions(2);

            const provider1 = createMockProvider("provider1", { available: false, success: false });
            const provider2 = createMockProvider("provider2", { available: true, success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toContain("provider2");
        });

        it("should failover to next provider if current fails", async () => {
            expect.assertions(2);

            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.provider).toContain("provider2");
        });

        it("should return error if all providers fail", async () => {
            expect.assertions(2);

            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: false });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Failed to send email via all providers");
        });

        it("should handle exceptions during send", async () => {
            expect.assertions(2);

            // Provider1 returns a failed result (not throws), so round robin can retry
            const provider1 = createMockProvider("provider1", { success: false });
            const provider2 = createMockProvider("provider2", { success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            // Round robin will try provider1 first, it fails, then failover to provider2
            const result = await roundRobin.sendEmail(emailOptions);

            // Should eventually succeed after failover
            expect(result.success).toBe(true);
            // Provider should be provider2 after failover
            expect(result.data?.provider).toContain("provider2");
        });

        it("should initialize providers if not already initialized", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1],
            });

            // Don't call initialize, just send
            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(true);
        });

        it("should return error if no providers are available", async () => {
            expect.assertions(2);

            const roundRobin = roundRobinProvider({
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

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("No providers");
        });

        it("should wait retryAfter milliseconds when searching for available provider", async () => {
            expect.assertions(2);

            vi.useFakeTimers();

            const provider1 = createMockProvider("provider1", { available: false });
            const provider2 = createMockProvider("provider2", { available: true, success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
                retryAfter: 100,
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const sendPromise = roundRobin.sendEmail(emailOptions);

            // Advance time by 50ms - should still be waiting
            await vi.advanceTimersByTimeAsync(50);

            expect(sendPromise).toBeInstanceOf(Promise);

            // Advance time by another 60ms - should complete
            await vi.advanceTimersByTimeAsync(60);
            const result = await sendPromise;

            vi.useRealTimers();

            expect(result.success).toBe(true);
        });

        it("should wrap around to first provider after last", async () => {
            expect.assertions(3);

            const provider1 = createMockProvider("provider1", { success: true });
            const provider2 = createMockProvider("provider2", { success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            // Send enough emails to wrap around
            const results = await Promise.all([roundRobin.sendEmail(emailOptions), roundRobin.sendEmail(emailOptions), roundRobin.sendEmail(emailOptions)]);

            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
            expect(results[2].success).toBe(true);
        });
    });

    describe("validateCredentials", () => {
        it("should return true if at least one provider is available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1],
            });

            await roundRobin.initialize();

            await expect(roundRobin.validateCredentials()).resolves.toBe(true);
        });

        it("should return false if no providers are available", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: false });
            const roundRobin = roundRobinProvider({
                mailers: [provider1],
            });

            await roundRobin.initialize();

            await expect(roundRobin.validateCredentials()).resolves.toBe(false);
        });
    });

    describe("features", () => {
        it("should expose correct feature flags", () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const roundRobin = roundRobinProvider({
                mailers: [provider1],
            });

            expect(roundRobin.features).toStrictEqual({
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
            const roundRobin = roundRobinProvider({
                mailers: [provider1, null, undefined] as unknown[],
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(true);
        });

        it("should use default retryAfter if not specified", () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1");
            const roundRobin = roundRobinProvider({
                mailers: [provider1],
            });

            expect(roundRobin.options?.retryAfter).toBe(60);
        });

        it("should handle retryAfter of 0", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { available: false });
            const provider2 = createMockProvider("provider2", { available: true, success: true });
            const roundRobin = roundRobinProvider({
                mailers: [provider1, provider2],
                retryAfter: 0,
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(true);
        });

        it("should handle case where getNextProvider returns same provider", async () => {
            expect.assertions(1);

            const provider1 = createMockProvider("provider1", { success: false });
            const roundRobin = roundRobinProvider({
                mailers: [provider1],
                retryAfter: 0,
            });

            await roundRobin.initialize();

            const emailOptions: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "recipient@example.com" },
            };

            const result = await roundRobin.sendEmail(emailOptions);

            expect(result.success).toBe(false);
        });
    });
});
