import { describe, expect, it } from "vitest";

import type { EmailAddress, EmailOptions } from "../src/utils.js";
import {
    createError,
    createRequiredError,
    formatEmailAddress,
    formatEmailAddresses,
    generateMessageId,
    validateEmail,
    validateEmailOptions,
} from "../src/utils.js";

describe("utils", () => {
    describe(createError, () => {
        it("should create an error with component prefix", () => {
            const error = createError("test", "Something went wrong");

            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain("[@visulima/email]");
            expect(error.message).toContain("[test]");
            expect(error.message).toContain("Something went wrong");
        });

        it("should include cause in error", () => {
            const cause = new Error("Original error");
            const error = createError("test", "Wrapper error", { cause });

            expect(error.cause).toBe(cause);
        });
    });

    describe(createRequiredError, () => {
        it("should create error for single missing option", () => {
            const error = createRequiredError("test", "apiKey");

            expect(error.message).toContain("Missing required option: 'apiKey'");
        });

        it("should create error for multiple missing options", () => {
            const error = createRequiredError("test", ["apiKey", "endpoint"]);

            expect(error.message).toContain("Missing required options: 'apiKey', 'endpoint'");
        });
    });

    describe(generateMessageId, () => {
        it("should generate a message ID", () => {
            const messageId = generateMessageId();

            expect(messageId).toMatch(/^<.+@visulima\.local>$/);
        });

        it("should generate unique message IDs", () => {
            const id1 = generateMessageId();
            const id2 = generateMessageId();

            expect(id1).not.toBe(id2);
        });
    });

    describe(validateEmail, () => {
        it("should validate correct email addresses", () => {
            expect(validateEmail("user@example.com")).toBe(true);
            expect(validateEmail("user.name@example.co.uk")).toBe(true);
            expect(validateEmail("user+tag@example.com")).toBe(true);
        });

        it("should reject invalid email addresses", () => {
            expect(validateEmail("invalid")).toBe(false);
            expect(validateEmail("@example.com")).toBe(false);
            expect(validateEmail("user@")).toBe(false);
            expect(validateEmail("user@example")).toBe(false);
        });
    });

    describe(formatEmailAddress, () => {
        it("should format email without name", () => {
            const address: EmailAddress = { email: "user@example.com" };
            const formatted = formatEmailAddress(address);

            expect(formatted).toBe("user@example.com");
        });

        it("should format email with name", () => {
            const address: EmailAddress = { email: "user@example.com", name: "John Doe" };
            const formatted = formatEmailAddress(address);

            expect(formatted).toBe("John Doe <user@example.com>");
        });

        it("should throw error for invalid email", () => {
            const address: EmailAddress = { email: "invalid" };

            expect(() => formatEmailAddress(address)).toThrow();
        });
    });

    describe(formatEmailAddresses, () => {
        it("should format single address", () => {
            const address: EmailAddress = { email: "user@example.com" };
            const formatted = formatEmailAddresses(address);

            expect(formatted).toBe("user@example.com");
        });

        it("should format array of addresses", () => {
            const addresses: EmailAddress[] = [{ email: "user1@example.com" }, { email: "user2@example.com", name: "User 2" }];
            const formatted = formatEmailAddresses(addresses);

            expect(formatted).toBe("user1@example.com, User 2 <user2@example.com>");
        });
    });

    describe(validateEmailOptions, () => {
        it("should validate correct email options", () => {
            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const errors = validateEmailOptions(options);

            expect(errors).toHaveLength(0);
        });

        it("should return errors for missing required fields", () => {
            const options = {} as EmailOptions;

            const errors = validateEmailOptions(options);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors).toContain("Missing required field: from");
            expect(errors).toContain("Missing required field: to");
            expect(errors).toContain("Missing required field: subject");
        });

        it("should return error if neither text nor html is provided", () => {
            const options: EmailOptions = {
                from: { email: "sender@example.com" },
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const errors = validateEmailOptions(options);

            expect(errors).toContain("Either text or html content is required");
        });

        it("should validate email addresses", () => {
            const options: EmailOptions = {
                from: { email: "invalid-email" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const errors = validateEmailOptions(options);

            expect(errors).toContain("Invalid from email address: invalid-email");
        });

        it("should validate CC and BCC addresses", () => {
            const options: EmailOptions = {
                bcc: { email: "invalid-bcc" },
                cc: { email: "invalid-cc" },
                from: { email: "sender@example.com" },
                html: "<h1>Test</h1>",
                subject: "Test",
                to: { email: "user@example.com" },
            };

            const errors = validateEmailOptions(options);

            expect(errors).toContain("Invalid cc email address: invalid-cc");
            expect(errors).toContain("Invalid bcc email address: invalid-bcc");
        });
    });
});
