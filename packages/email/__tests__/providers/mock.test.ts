import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockProvider } from "../../src/providers/mock/index";
import type { MockEmailOptions } from "../../src/providers/mock/types";

describe(mockProvider, () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initialization", () => {
        it("should create provider with default config", () => {
            const provider = mockProvider();

            expect(provider).toBeDefined();
            expect(provider.name).toBe("mock");
            expect(provider.options?.delay).toBe(0);
            expect(provider.options?.failureRate).toBe(0);
            expect(provider.options?.simulateFailure).toBe(false);
        });

        it("should create provider with custom config", () => {
            const provider = mockProvider({
                debug: true,
                delay: 100,
                failureRate: 0.5,
                simulateFailure: true,
            });

            expect(provider.options?.delay).toBe(100);
            expect(provider.options?.failureRate).toBe(0.5);
            expect(provider.options?.simulateFailure).toBe(true);
            expect(provider.options?.debug).toBe(true);
        });

        it("should initialize successfully", async () => {
            const provider = mockProvider();

            await expect(provider.initialize()).resolves.not.toThrow();
        });

        it("should be available", async () => {
            const provider = mockProvider();

            const isAvailable = await provider.isAvailable();

            expect(isAvailable).toBe(true);
        });

        it("should validate credentials", async () => {
            const provider = mockProvider();

            const isValid = await provider.validateCredentials?.();

            expect(isValid).toBe(true);
        });
    });

    describe("features", () => {
        it("should have correct feature flags", () => {
            const provider = mockProvider();

            expect(provider.features).toEqual({
                attachments: true,
                batchSending: true,
                customHeaders: true,
                html: true,
                replyTo: true,
                scheduling: false,
                tagging: true,
                templates: false,
                tracking: false,
            });
        });
    });

    describe("sendEmail", () => {
        it("should send email successfully and store it", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test Subject",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBeDefined();
            expect(result.data?.sent).toBe(true);
            expect(result.data?.provider).toBe("mock");

            const sentEmails = provider.getSentEmails();

            expect(sentEmails).toHaveLength(1);
            expect(sentEmails[0]?.options.subject).toBe("Test Subject");
        });

        it("should validate email options", async () => {
            const provider = mockProvider();
            const emailOptions = {} as MockEmailOptions;

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should store email with all fields", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                bcc: { email: "bcc@example.com" },
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com", name: "Sender" },
                headers: { "X-Custom": "value" },
                html: "<h1>HTML</h1>",
                replyTo: { email: "reply@example.com" },
                subject: "Test",
                tags: ["tag1", "tag2"],
                text: "Text",
                to: { email: "user@example.com", name: "User" },
            };

            await provider.sendEmail(emailOptions);

            const sentEmails = provider.getSentEmails();

            expect(sentEmails).toHaveLength(1);
            expect(sentEmails[0]?.options).toEqual(emailOptions);
        });

        it("should handle multiple recipients", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            const sentEmails = provider.getSentEmails();

            expect(sentEmails).toHaveLength(1);
        });
    });

    describe("simulateFailure", () => {
        it("should simulate failure when simulateFailure is true", async () => {
            const provider = mockProvider({ simulateFailure: true });
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Simulated failure");
            expect(provider.getSentEmails()).toHaveLength(0);
        });
    });

    describe("failureRate", () => {
        it("should fail with 100% failure rate", async () => {
            const provider = mockProvider({ failureRate: 1 });
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
        });

        it("should succeed with 0% failure rate", async () => {
            const provider = mockProvider({ failureRate: 0 });
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
        });

        it("should set failure rate dynamically", () => {
            const provider = mockProvider();

            provider.setFailureRate(0.75);

            expect(provider.options?.failureRate).toBe(0.75);
        });

        it("should throw error for invalid failure rate", () => {
            const provider = mockProvider();

            expect(() => {
                provider.setFailureRate(-0.1);
            }).toThrow(RangeError);

            expect(() => {
                provider.setFailureRate(1.1);
            }).toThrow(RangeError);
        });
    });

    describe("delay", () => {
        it("should delay email sending", async () => {
            const startTime = Date.now();
            const provider = mockProvider({ delay: 100 });
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const endTime = Date.now();

            expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some margin
        });

        it("should set delay dynamically", () => {
            const provider = mockProvider();

            provider.setDelay(200);

            expect(provider.options?.delay).toBe(200);
            expect(provider.options?.randomDelayRange).toEqual({ max: 0, min: 0 });
        });

        it("should throw error for negative delay", () => {
            const provider = mockProvider();

            expect(() => {
                provider.setDelay(-1);
            }).toThrow(RangeError);
        });
    });

    describe("randomDelay", () => {
        it("should set random delay range", () => {
            const provider = mockProvider();

            provider.setRandomDelay(50, 100);

            expect(provider.options?.delay).toBe(0);
            expect(provider.options?.randomDelayRange).toEqual({ max: 100, min: 50 });
        });

        it("should use random delay when sending", async () => {
            const provider = mockProvider();

            provider.setRandomDelay(10, 20);
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const startTime = Date.now();

            await provider.sendEmail(emailOptions);
            const endTime = Date.now();

            expect(endTime - startTime).toBeGreaterThanOrEqual(8); // Allow some margin
        });

        it("should throw error for invalid delay range", () => {
            const provider = mockProvider();

            expect(() => {
                provider.setRandomDelay(-1, 10);
            }).toThrow(RangeError);

            expect(() => {
                provider.setRandomDelay(10, 5);
            }).toThrow(RangeError);
        });
    });

    describe("nextResponse", () => {
        it("should use next response for next send", async () => {
            const provider = mockProvider();
            const customReceipt = {
                messageId: "custom-id",
                provider: "custom-provider",
                response: { custom: "data" },
                successful: true,
                timestamp: new Date("2024-01-01"),
            } as const;

            provider.setNextResponse(customReceipt);

            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("custom-id");
            expect(result.data?.timestamp).toEqual(new Date("2024-01-01"));

            // Next response should be cleared after use
            const result2 = await provider.sendEmail(emailOptions);

            expect(result2.data?.messageId).not.toBe("custom-id");
        });

        it("should use next response for failure", async () => {
            const provider = mockProvider();
            const failureReceipt = {
                errorMessages: ["Custom error"],
                provider: "mock",
                successful: false,
            } as const;

            provider.setNextResponse(failureReceipt);

            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(false);
            expect(result.error?.message).toContain("Custom error");
        });
    });

    describe("defaultResponse", () => {
        it("should use default response when set", async () => {
            const provider = mockProvider();
            const defaultReceipt = {
                messageId: "default-id",
                provider: "mock",
                successful: true,
                timestamp: new Date("2024-01-01"),
            } as const;

            provider.setDefaultResponse(defaultReceipt);

            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const result = await provider.sendEmail(emailOptions);

            expect(result.success).toBe(true);
            expect(result.data?.messageId).toBe("default-id");
        });

        it("should use default response for multiple sends", async () => {
            const provider = mockProvider();
            const defaultReceipt = {
                messageId: "default-id",
                provider: "mock",
                successful: true,
                timestamp: new Date(),
            } as const;

            provider.setDefaultResponse(defaultReceipt);

            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);
            const result2 = await provider.sendEmail(emailOptions);

            expect(result2.success).toBe(true);
        });
    });

    describe("getSentEmails", () => {
        it("should return all sent emails", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);
            await provider.sendEmail({ ...emailOptions, subject: "Test 2" });

            const sentEmails = provider.getSentEmails();

            expect(sentEmails).toHaveLength(2);
            expect(sentEmails[0]?.options.subject).toBe("Test");
            expect(sentEmails[1]?.options.subject).toBe("Test 2");
        });

        it("should return empty array when no emails sent", () => {
            const provider = mockProvider();

            const sentEmails = provider.getSentEmails();

            expect(sentEmails).toHaveLength(0);
        });
    });

    describe("getSentMessages", () => {
        it("should return all sent messages", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const messages = provider.getSentMessages();

            expect(messages).toHaveLength(1);
            expect(messages[0]?.options.subject).toBe("Test");
        });
    });

    describe("getLastSentMessage", () => {
        it("should return last sent message", async () => {
            const provider = mockProvider();
            const emailOptions1: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "First",
                to: { email: "user@example.com" },
            };
            const emailOptions2: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Last",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions1);
            await provider.sendEmail(emailOptions2);

            const lastMessage = provider.getLastSentMessage();

            expect(lastMessage?.options.subject).toBe("Last");
        });

        it("should return undefined when no messages sent", () => {
            const provider = mockProvider();

            const lastMessage = provider.getLastSentMessage();

            expect(lastMessage).toBeUndefined();
        });
    });

    describe("getSentMessagesCount", () => {
        it("should return correct count", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            expect(provider.getSentMessagesCount()).toBe(0);

            await provider.sendEmail(emailOptions);

            expect(provider.getSentMessagesCount()).toBe(1);

            await provider.sendEmail(emailOptions);

            expect(provider.getSentMessagesCount()).toBe(2);
        });
    });

    describe("clearSentMessages", () => {
        it("should clear all sent messages", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);
            await provider.sendEmail(emailOptions);

            expect(provider.getSentMessagesCount()).toBe(2);

            provider.clearSentMessages();

            expect(provider.getSentMessagesCount()).toBe(0);
        });

        it("should not reset configuration", () => {
            const provider = mockProvider();

            provider.setFailureRate(0.5);
            provider.setDelay(100);
            provider.clearSentMessages();

            expect(provider.options?.failureRate).toBe(0.5);
            expect(provider.options?.delay).toBe(100);
        });
    });

    describe("findMessageBy", () => {
        it("should find message by predicate", async () => {
            const provider = mockProvider();
            const emailOptions1: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "First",
                to: { email: "user1@example.com" },
            };
            const emailOptions2: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Second",
                to: { email: "user2@example.com" },
            };

            await provider.sendEmail(emailOptions1);
            await provider.sendEmail(emailOptions2);

            const message = provider.findMessageBy((message_) => message_.options.subject === "First");

            expect(message).toBeDefined();
            expect(message?.options.subject).toBe("First");
        });

        it("should return undefined when no match found", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const message = provider.findMessageBy((message_) => message_.options.subject === "NonExistent");

            expect(message).toBeUndefined();
        });
    });

    describe("findMessagesBy", () => {
        it("should find all messages matching predicate", async () => {
            const provider = mockProvider();
            const emailOptions1: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user1@example.com" },
            };
            const emailOptions2: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user2@example.com" },
            };
            const emailOptions3: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Other",
                to: { email: "user3@example.com" },
            };

            await provider.sendEmail(emailOptions1);
            await provider.sendEmail(emailOptions2);
            await provider.sendEmail(emailOptions3);

            const messages = provider.findMessagesBy((message) => message.options.subject === "Test");

            expect(messages).toHaveLength(2);
        });
    });

    describe("getMessagesTo", () => {
        it("should find messages sent to specific email", async () => {
            const provider = mockProvider();
            const emailOptions1: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test 1",
                to: { email: "user@example.com" },
            };
            const emailOptions2: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test 2",
                to: { email: "other@example.com" },
            };

            await provider.sendEmail(emailOptions1);
            await provider.sendEmail(emailOptions2);

            const messages = provider.getMessagesTo("user@example.com");

            expect(messages).toHaveLength(1);
            expect(messages[0]?.options.subject).toBe("Test 1");
        });

        it("should find messages in CC", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                cc: { email: "cc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "to@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const messages = provider.getMessagesTo("cc@example.com");

            expect(messages).toHaveLength(1);
        });

        it("should find messages in BCC", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                bcc: { email: "bcc@example.com" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "to@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const messages = provider.getMessagesTo("bcc@example.com");

            expect(messages).toHaveLength(1);
        });

        it("should handle multiple recipients", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
            };

            await provider.sendEmail(emailOptions);

            const messages1 = provider.getMessagesTo("user1@example.com");
            const messages2 = provider.getMessagesTo("user2@example.com");

            expect(messages1).toHaveLength(1);
            expect(messages2).toHaveLength(1);
        });
    });

    describe("getMessagesBySubject", () => {
        it("should find messages by subject", async () => {
            const provider = mockProvider();
            const emailOptions1: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Welcome",
                to: { email: "user1@example.com" },
            };
            const emailOptions2: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Welcome",
                to: { email: "user2@example.com" },
            };
            const emailOptions3: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Other",
                to: { email: "user3@example.com" },
            };

            await provider.sendEmail(emailOptions1);
            await provider.sendEmail(emailOptions2);
            await provider.sendEmail(emailOptions3);

            const messages = provider.getMessagesBySubject("Welcome");

            expect(messages).toHaveLength(2);
            expect(messages[0]?.options.subject).toBe("Welcome");
            expect(messages[1]?.options.subject).toBe("Welcome");
        });
    });

    describe("waitForMessageCount", () => {
        it("should wait for specific message count", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const sendPromise = provider.sendEmail(emailOptions);
            const waitPromise = provider.waitForMessageCount(1, 1000);

            await Promise.all([sendPromise, waitPromise]);

            expect(provider.getSentMessagesCount()).toBe(1);
        });

        it("should timeout if count not reached", async () => {
            const provider = mockProvider();

            await expect(provider.waitForMessageCount(1, 100)).rejects.toThrow("Timeout");
        });
    });

    describe("waitForMessage", () => {
        it("should wait for message matching predicate", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Special",
                to: { email: "user@example.com" },
            };

            const sendPromise = provider.sendEmail(emailOptions);
            const waitPromise = provider.waitForMessage((message_) => message_.options.subject === "Special", 1000);

            const [_, message] = await Promise.all([sendPromise, waitPromise]);

            expect(message.options.subject).toBe("Special");
        });

        it("should timeout if message not found", async () => {
            const provider = mockProvider();

            await expect(provider.waitForMessage((message) => message.options.subject === "NonExistent", 100)).rejects.toThrow("Timeout");
        });
    });

    describe("reset", () => {
        it("should reset to initial state", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            provider.setFailureRate(0.5);
            provider.setDelay(100);
            provider.setNextResponse({
                messageId: "test-id",
                successful: true,
                timestamp: new Date(),
            });
            await provider.sendEmail(emailOptions);

            provider.reset();

            expect(provider.getSentMessagesCount()).toBe(0);
            expect(provider.options?.failureRate).toBe(0);
            expect(provider.options?.delay).toBe(0);
        });
    });

    describe("getEmail", () => {
        it("should retrieve email by ID", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const sendResult = await provider.sendEmail(emailOptions);

            expect(sendResult.success).toBe(true);

            const messageId = sendResult.data?.messageId!;

            const getResult = await provider.getEmail(messageId);

            expect(getResult.success).toBe(true);
            expect(getResult.data).toBeDefined();
            expect((getResult.data as any)?.id).toBe(messageId);
        });

        it("should return error for non-existent ID", async () => {
            const provider = mockProvider();

            const result = await provider.getEmail("non-existent-id");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it("should return error for empty ID", async () => {
            const provider = mockProvider();

            const result = await provider.getEmail("");

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe("getInstance", () => {
        it("should return storage array", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            const instance = provider.getInstance();

            expect(Array.isArray(instance)).toBe(true);
            expect(instance).toHaveLength(1);
        });
    });

    describe("shutdown", () => {
        it("should cleanup on shutdown", async () => {
            const provider = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider.sendEmail(emailOptions);

            await provider.shutdown?.();

            // After shutdown, storage should be cleared for this instance
            // Note: The implementation clears the instance from global storage
            expect(provider.getSentMessagesCount()).toBe(0);
        });
    });

    describe("instance isolation", () => {
        it("should isolate storage between instances", async () => {
            const provider1 = mockProvider();
            const provider2 = mockProvider();
            const emailOptions: MockEmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            await provider1.sendEmail(emailOptions);

            expect(provider1.getSentMessagesCount()).toBe(1);
            expect(provider2.getSentMessagesCount()).toBe(0);
        });
    });
});
