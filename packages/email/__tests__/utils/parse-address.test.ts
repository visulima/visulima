import { describe, expect, it } from "vitest";

import formatEmailAddress from "../../src/utils/format-email-address";
import parseAddress from "../../src/utils/parse-address";

describe(parseAddress, () => {
    it("should parse plain email address", () => {
        expect.assertions(1);

        const addr1 = parseAddress("john@example.com");

        expect(addr1).toStrictEqual({ email: "john@example.com" });
    });

    it("should parse email with name", () => {
        expect.assertions(1);

        const addr2 = parseAddress("John Doe <john@example.com>");

        expect(addr2).toStrictEqual({
            email: "john@example.com",
            name: "John Doe",
        });
    });

    it("should parse email with quoted name", () => {
        expect.assertions(1);

        const addr3 = parseAddress("\"John Doe\" <john@example.com>");

        expect(addr3).toStrictEqual({
            email: "john@example.com",
            name: "John Doe",
        });
    });

    it("should parse email with angle brackets only", () => {
        expect.assertions(1);

        const addr4 = parseAddress("<john@example.com>");

        expect(addr4).toStrictEqual({ email: "john@example.com" });
    });

    it("should parse complex valid email addresses", () => {
        expect.assertions(2);

        const addr5 = parseAddress("user.name+tag@example.com");

        expect(addr5).toStrictEqual({ email: "user.name+tag@example.com" });

        const addr6 = parseAddress("test@sub.example.com");

        expect(addr6).toStrictEqual({ email: "test@sub.example.com" });
    });

    it("should parse quoted local part", () => {
        expect.assertions(1);

        const addr7 = parseAddress("\"test@test\"@example.com");

        expect(addr7).toStrictEqual({ email: "\"test@test\"@example.com" });
    });

    it("should parse domain literal", () => {
        expect.assertions(1);

        const addr8 = parseAddress("test@[192.168.1.1]");

        expect(addr8).toStrictEqual({ email: "test@[192.168.1.1]" });
    });

    it("should return undefined for invalid addresses", () => {
        expect.assertions(11);
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
        expect.assertions(3);
        expect(parseAddress(null as unknown as string)).toBeUndefined();
        expect(parseAddress(undefined as unknown as string)).toBeUndefined();
        expect(parseAddress(123 as unknown as string)).toBeUndefined();
    });

    it("should handle roundtrip with formatEmailAddress", () => {
        expect.assertions(6);

        const testCases = ["john@example.com", "John Doe <john@example.com>", "user.name+tag@example.sub.com"];

        for (const testCase of testCases) {
            const parsed = parseAddress(testCase);

            expect(parsed).toBeDefined();

            const formatted = formatEmailAddress(parsed!);
            const reparsed = parseAddress(formatted);

            expect(parsed).toStrictEqual(reparsed);
        }
    });

    it("should handle complex quoted string cases", () => {
        expect.assertions(7);

        const addr1 = parseAddress("\"user with spaces\"@example.com");

        expect(addr1).toStrictEqual({ email: "\"user with spaces\"@example.com" });

        const addr2 = parseAddress(String.raw`"user\"quote"@example.com`);

        expect(addr2).toStrictEqual({ email: String.raw`"user\"quote"@example.com` });

        const addr3 = parseAddress(String.raw`"user\\backslash"@example.com`);

        expect(addr3).toStrictEqual({ email: String.raw`"user\\backslash"@example.com` });

        const addr4 = parseAddress("\".user.name.\"@example.com");

        expect(addr4).toStrictEqual({ email: "\".user.name.\"@example.com" });

        const addr5 = parseAddress("\"user@domain\"@example.com");

        expect(addr5).toStrictEqual({ email: "\"user@domain\"@example.com" });

        // Test invalid quoted strings
        expect(parseAddress("\"unterminated@example.com")).toBeUndefined();
        expect(parseAddress("unterminated\"@example.com")).toBeUndefined();
    });

    it("should handle domain literal cases", () => {
        expect.assertions(4);

        const addr1 = parseAddress("user@[192.168.1.1]");

        expect(addr1).toStrictEqual({ email: "user@[192.168.1.1]" });

        const addr2 = parseAddress("user@[127.0.0.1]");

        expect(addr2).toStrictEqual({ email: "user@[127.0.0.1]" });

        // Test invalid domain literals
        expect(parseAddress("user@[192.168.1.1")).toBeUndefined();
        expect(parseAddress("user@192.168.1.1]")).toBeUndefined();
    });

    it("should handle international domain names", () => {
        expect.assertions(4);

        const addr1 = parseAddress("user@xn--e1afmkfd.xn--p1ai");

        expect(addr1).toStrictEqual({ email: "user@xn--e1afmkfd.xn--p1ai" });

        const addr2 = parseAddress("user@xn--fsq.xn--0zwm56d");

        expect(addr2).toStrictEqual({ email: "user@xn--fsq.xn--0zwm56d" });

        const addr3 = parseAddress("user@한글.kr");

        expect(addr3).toStrictEqual({ email: "user@한글.kr" });

        const addr4 = parseAddress("user@例え.テスト");

        expect(addr4).toStrictEqual({ email: "user@例え.テスト" });
    });

    it("should handle complex name parsing", () => {
        expect.assertions(5);

        const addr1 = parseAddress("John \"Johnny\" Doe <john@example.com>");

        expect(addr1).toStrictEqual({
            email: "john@example.com",
            name: "John \"Johnny\" Doe",
        });

        const addr2 = parseAddress("José María <jose@example.com>");

        expect(addr2).toStrictEqual({
            email: "jose@example.com",
            name: "José María",
        });

        const addr3 = parseAddress("\"Doe, John\" <john@example.com>");

        expect(addr3).toStrictEqual({
            email: "john@example.com",
            name: "Doe, John",
        });

        const addr4 = parseAddress("John Doe (Company) <john@example.com>");

        expect(addr4).toStrictEqual({
            email: "john@example.com",
            name: "John Doe (Company)",
        });

        const addr5 = parseAddress("  John   Doe  <john@example.com>");

        expect(addr5).toStrictEqual({
            email: "john@example.com",
            name: "John   Doe",
        });
    });

    it("should handle edge cases with valid email patterns", () => {
        expect.assertions(6);

        const longLocal = `${"a".repeat(63)}@example.com`;
        const addr1 = parseAddress(longLocal);

        expect(addr1).toStrictEqual({ email: longLocal });

        const longDomain = `user@${"a".repeat(60)}.com`;
        const addr3 = parseAddress(longDomain);

        expect(addr3).toStrictEqual({ email: longDomain });

        const addr4 = parseAddress("a@b.c");

        expect(addr4).toStrictEqual({ email: "a@b.c" });

        const addr5 = parseAddress("user@mail.subdomain.example.com");

        expect(addr5).toStrictEqual({ email: "user@mail.subdomain.example.com" });

        const addr6 = parseAddress("user123@example123.com");

        expect(addr6).toStrictEqual({ email: "user123@example123.com" });

        const addr7 = parseAddress("user_name-test@sub-domain.example.com");

        expect(addr7).toStrictEqual({
            email: "user_name-test@sub-domain.example.com",
        });
    });

    it("should handle boundary and malformed cases", () => {
        expect.assertions(9);
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
