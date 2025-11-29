import { describe, expect, it } from "vitest";

import { isRoleAccount, ROLE_ACCOUNT_PREFIXES } from "../../src/utils/role-accounts";

describe(isRoleAccount, () => {
    it("should detect common role account prefixes", () => {
        expect.assertions(10);
        expect(isRoleAccount("noreply@example.com")).toBe(true);
        expect(isRoleAccount("no-reply@example.com")).toBe(true);
        expect(isRoleAccount("support@example.com")).toBe(true);
        expect(isRoleAccount("admin@example.com")).toBe(true);
        expect(isRoleAccount("info@example.com")).toBe(true);
        expect(isRoleAccount("sales@example.com")).toBe(true);
        expect(isRoleAccount("help@example.com")).toBe(true);
        expect(isRoleAccount("webmaster@example.com")).toBe(true);
        expect(isRoleAccount("postmaster@example.com")).toBe(true);
        expect(isRoleAccount("abuse@example.com")).toBe(true);
    });

    it("should detect role accounts with separators", () => {
        expect.assertions(4);
        expect(isRoleAccount("no.reply@example.com")).toBe(true);
        expect(isRoleAccount("no_reply@example.com")).toBe(true);
        expect(isRoleAccount("no-reply+tag@example.com")).toBe(true);
        expect(isRoleAccount("support.team@example.com")).toBe(true);
    });

    it("should not detect personal email addresses as role accounts", () => {
        expect.assertions(5);
        expect(isRoleAccount("john.doe@example.com")).toBe(false);
        expect(isRoleAccount("user123@example.com")).toBe(false);
        expect(isRoleAccount("test.user@example.com")).toBe(false);
        expect(isRoleAccount("contact.me@example.com")).toBe(false);
        expect(isRoleAccount("myemail@example.com")).toBe(false);
    });

    it("should be case-insensitive", () => {
        expect.assertions(4);
        expect(isRoleAccount("NOREPLY@example.com")).toBe(true);
        expect(isRoleAccount("Support@example.com")).toBe(true);
        expect(isRoleAccount("ADMIN@example.com")).toBe(true);
        expect(isRoleAccount("NoReply@Example.Com")).toBe(true);
    });

    it("should handle custom role prefixes", () => {
        expect.assertions(2);

        const customPrefixes = new Set(["custom", "test-role"]);

        expect(isRoleAccount("custom@example.com", customPrefixes)).toBe(true);
        expect(isRoleAccount("test-role@example.com", customPrefixes)).toBe(true);
    });

    it("should return false for invalid email formats", () => {
        expect.assertions(4);
        expect(isRoleAccount("")).toBe(false);
        expect(isRoleAccount("invalid")).toBe(false);
        expect(isRoleAccount("@example.com")).toBe(false);
        expect(isRoleAccount("user@")).toBe(false);
    });

    it("should handle whitespace", () => {
        expect.assertions(2);
        expect(isRoleAccount("  noreply@example.com  ")).toBe(true);
        expect(isRoleAccount("\tnoreply@example.com\n")).toBe(true);
    });

    it("should export ROLE_ACCOUNT_PREFIXES constant", () => {
        expect.assertions(1);
        expect(ROLE_ACCOUNT_PREFIXES.size).toBeGreaterThan(0);
    });
});
