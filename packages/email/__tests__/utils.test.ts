import { describe, expect, it } from "vitest";

import type { EmailAddress, EmailOptions } from "../src/types.js";
import {
    comparePriority,
    formatEmailAddress,
    formatEmailAddresses,
    generateMessageId,
    parseAddress,
    validateEmail,
    validateEmailOptions,
} from "../src/utils.js";

describe("utils", () => {
    describe("generateMessageId", () => {
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

    describe("validateEmail", () => {
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

    describe("formatEmailAddress", () => {
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

    describe("parseAddress", () => {
        it("should parse plain email address", () => {
            const addr1 = parseAddress("john@example.com");

            expect(addr1).toEqual({ email: "john@example.com" });
        });

        it("should parse email with name", () => {
            const addr2 = parseAddress("John Doe <john@example.com>");

            expect(addr2).toEqual({
                name: "John Doe",
                email: "john@example.com",
            });
        });

        it("should parse email with quoted name", () => {
            const addr3 = parseAddress('"John Doe" <john@example.com>');

            expect(addr3).toEqual({
                name: "John Doe",
                email: "john@example.com",
            });
        });

        it("should parse email with angle brackets only", () => {
            const addr4 = parseAddress("<john@example.com>");

            expect(addr4).toEqual({ email: "john@example.com" });
        });

        it("should parse complex valid email addresses", () => {
            const addr5 = parseAddress("user.name+tag@example.com");

            expect(addr5).toEqual({ email: "user.name+tag@example.com" });

            const addr6 = parseAddress("test@sub.example.com");

            expect(addr6).toEqual({ email: "test@sub.example.com" });
        });

        it("should parse quoted local part", () => {
            const addr7 = parseAddress('"test@test"@example.com');

            expect(addr7).toEqual({ email: '"test@test"@example.com' });
        });

        it("should parse domain literal", () => {
            const addr8 = parseAddress("test@[192.168.1.1]");

            expect(addr8).toEqual({ email: "test@[192.168.1.1]" });
        });

        it("should return undefined for invalid addresses", () => {
            expect(parseAddress("")).toBeUndefined();
            expect(parseAddress("   ")).toBeUndefined();
            expect(parseAddress("invalid")).toBeUndefined();
            expect(parseAddress("@example.com")).toBeUndefined();
            expect(parseAddress("user@")).toBeUndefined();
            expect(parseAddress("user@@example.com")).toBeUndefined();
            expect(parseAddress(".user@example.com")).toBeUndefined();
            expect(parseAddress("user.@example.com")).toBeUndefined();
            expect(parseAddress("user..name@example.com")).toBeUndefined();
            expect(parseAddress("John Doe <invalid>")).toBeUndefined();
            expect(parseAddress("<invalid>")).toBeUndefined();
        });

        it("should handle edge cases with null/undefined/non-string", () => {
            expect(parseAddress(null as unknown as string)).toBeUndefined();
            expect(parseAddress(undefined as unknown as string)).toBeUndefined();
            expect(parseAddress(123 as unknown as string)).toBeUndefined();
        });

        it("should handle roundtrip with formatEmailAddress", () => {
            const testCases = ["john@example.com", "John Doe <john@example.com>", "user.name+tag@example.sub.com"];

            for (const testCase of testCases) {
                const parsed = parseAddress(testCase);

                expect(parsed).not.toBeUndefined();

                if (parsed) {
                    const formatted = formatEmailAddress(parsed);
                    const reparsed = parseAddress(formatted);

                    expect(parsed).toEqual(reparsed);
                }
            }
        });

        it("should handle complex quoted string cases", () => {
            const addr1 = parseAddress('"user with spaces"@example.com');

            expect(addr1).toEqual({ email: '"user with spaces"@example.com' });

            const addr2 = parseAddress('"user\\"quote"@example.com');

            expect(addr2).toEqual({ email: '"user\\"quote"@example.com' });

            const addr3 = parseAddress('"user\\\\backslash"@example.com');

            expect(addr3).toEqual({ email: '"user\\\\backslash"@example.com' });

            const addr4 = parseAddress('".user.name."@example.com');

            expect(addr4).toEqual({ email: '".user.name."@example.com' });

            const addr5 = parseAddress('"user@domain"@example.com');

            expect(addr5).toEqual({ email: '"user@domain"@example.com' });

            // Test invalid quoted strings
            expect(parseAddress('"unterminated@example.com')).toBeUndefined();
            expect(parseAddress('unterminated"@example.com')).toBeUndefined();
        });

        it("should handle domain literal cases", () => {
            const addr1 = parseAddress("user@[192.168.1.1]");

            expect(addr1).toEqual({ email: "user@[192.168.1.1]" });

            const addr2 = parseAddress("user@[127.0.0.1]");

            expect(addr2).toEqual({ email: "user@[127.0.0.1]" });

            // Test invalid domain literals
            expect(parseAddress("user@[192.168.1.1")).toBeUndefined();
            expect(parseAddress("user@192.168.1.1]")).toBeUndefined();
        });

        it("should handle international domain names", () => {
            const addr1 = parseAddress("user@xn--e1afmkfd.xn--p1ai");

            expect(addr1).toEqual({ email: "user@xn--e1afmkfd.xn--p1ai" });

            const addr2 = parseAddress("user@xn--fsq.xn--0zwm56d");

            expect(addr2).toEqual({ email: "user@xn--fsq.xn--0zwm56d" });

            const addr3 = parseAddress("user@한글.kr");

            expect(addr3).toEqual({ email: "user@한글.kr" });

            const addr4 = parseAddress("user@例え.テスト");

            expect(addr4).toEqual({ email: "user@例え.テスト" });
        });

        it("should handle complex name parsing", () => {
            const addr1 = parseAddress('John "Johnny" Doe <john@example.com>');

            expect(addr1).toEqual({
                name: 'John "Johnny" Doe',
                email: "john@example.com",
            });

            const addr2 = parseAddress("José María <jose@example.com>");

            expect(addr2).toEqual({
                name: "José María",
                email: "jose@example.com",
            });

            const addr3 = parseAddress('"Doe, John" <john@example.com>');

            expect(addr3).toEqual({
                name: "Doe, John",
                email: "john@example.com",
            });

            const addr4 = parseAddress("John Doe (Company) <john@example.com>");

            expect(addr4).toEqual({
                name: "John Doe (Company)",
                email: "john@example.com",
            });

            const addr5 = parseAddress("  John   Doe  <john@example.com>");

            expect(addr5).toEqual({
                name: "John   Doe",
                email: "john@example.com",
            });
        });

        it("should handle edge cases with valid email patterns", () => {
            const longLocal = "a".repeat(63) + "@example.com";
            const addr1 = parseAddress(longLocal);

            expect(addr1).toEqual({ email: longLocal });

            const longDomain = "user@" + "a".repeat(60) + ".com";
            const addr3 = parseAddress(longDomain);

            expect(addr3).toEqual({ email: longDomain });

            const addr4 = parseAddress("a@b.c");

            expect(addr4).toEqual({ email: "a@b.c" });

            const addr5 = parseAddress("user@mail.subdomain.example.com");

            expect(addr5).toEqual({ email: "user@mail.subdomain.example.com" });

            const addr6 = parseAddress("user123@example123.com");

            expect(addr6).toEqual({ email: "user123@example123.com" });

            const addr7 = parseAddress("user_name-test@sub-domain.example.com");

            expect(addr7).toEqual({
                email: "user_name-test@sub-domain.example.com",
            });
        });

        it("should handle boundary and malformed cases", () => {
            expect(parseAddress("user..name@example.com")).toBeUndefined();
            expect(parseAddress(".user@example.com")).toBeUndefined();
            expect(parseAddress("user.@example.com")).toBeUndefined();
            expect(parseAddress("@example.com")).toBeUndefined();
            expect(parseAddress("user@")).toBeUndefined();
            expect(parseAddress("user@domain@example.com")).toBeUndefined();
            expect(parseAddress("user name@example.com")).toBeUndefined();
            expect(parseAddress("John Doe <john@example.com")).toBeUndefined();
            expect(parseAddress("John Doe john@example.com>")).toBeUndefined();
        });
    });

    describe("comparePriority", () => {
        it("should compare priorities correctly", () => {
            expect(comparePriority("high", "high")).toBe(0);
            expect(comparePriority("normal", "normal")).toBe(0);
            expect(comparePriority("low", "low")).toBe(0);

            expect(comparePriority("high", "normal")).toBeLessThan(0);
            expect(comparePriority("high", "low")).toBeLessThan(0);
            expect(comparePriority("normal", "low")).toBeLessThan(0);

            expect(comparePriority("normal", "high")).toBeGreaterThan(0);
            expect(comparePriority("low", "high")).toBeGreaterThan(0);
            expect(comparePriority("low", "normal")).toBeGreaterThan(0);
        });

        it("should sort priorities correctly", () => {
            const priorities = ["normal", "low", "high"] as const;
            const sorted = [...priorities].sort(comparePriority);

            expect(sorted).toEqual(["high", "normal", "low"]);
        });
    });

    describe("formatEmailAddresses", () => {
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

    describe("validateEmailOptions", () => {
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
