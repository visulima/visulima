import { describe, expect, expectTypeOf, it } from "vitest";

import verifyEmail from "../../src/utils/verify-email";

const consoleMessage = "Skipping network-dependent email verification in CI environment, please validate this test locally.";

describe(verifyEmail, () => {
    it("should return invalid for malformed email", async () => {
        expect.assertions(3);

        const result = await verifyEmail("invalid-email");

        expect(result.valid).toBe(false);
        expect(result.formatValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate email format", async () => {
        expect.assertions(2);

        const result = await verifyEmail("user@example.com", {
            checkDisposable: false,
            checkMx: false,
            checkRoleAccount: false,
            checkSmtp: false,
        });

        expect(result.formatValid).toBe(true);
        expect(result.valid).toBe(true);
    });

    it("should detect disposable emails when enabled", async () => {
        expect.assertions(3);

        const result = await verifyEmail("user@mailinator.com", {
            checkDisposable: true,
            checkMx: false,
            checkRoleAccount: false,
            checkSmtp: false,
        });

        expect(result.formatValid).toBe(true);
        expect(result.disposable).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should detect role accounts when enabled", async () => {
        expect.assertions(3);

        const result = await verifyEmail("noreply@example.com", {
            checkDisposable: false,
            checkMx: false,
            checkRoleAccount: true,
            checkSmtp: false,
        });

        expect(result.formatValid).toBe(true);
        expect(result.roleAccount).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should check MX records when enabled", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 2);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const result = await verifyEmail("user@example.com", {
            checkDisposable: false,
            checkMx: true,
            checkRoleAccount: false,
            checkSmtp: false,
        });

        expect(result.formatValid).toBe(true);
        expect(result.mxValid).toBeDefined();

        expectTypeOf(result.mxValid).toBeBoolean();
    }, 10_000);

    it("should handle custom disposable domains", async () => {
        expect.assertions(3);

        const customDomains = new Set(["custom-disposable.com"]);

        const result = await verifyEmail("user@custom-disposable.com", {
            checkDisposable: true,
            checkMx: false,
            checkRoleAccount: false,
            checkSmtp: false,
            customDisposableDomains: customDomains,
        });

        expect(result.formatValid).toBe(true);
        expect(result.disposable).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle custom role prefixes", async () => {
        expect.assertions(3);

        const customPrefixes = new Set(["custom-role"]);

        const result = await verifyEmail("custom-role@example.com", {
            checkDisposable: false,
            checkMx: false,
            checkRoleAccount: true,
            checkSmtp: false,
            customRolePrefixes: customPrefixes,
        });

        expect(result.formatValid).toBe(true);
        expect(result.roleAccount).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should combine all checks", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 6);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const result = await verifyEmail("user@example.com", {
            checkDisposable: true,
            checkMx: true,
            checkRoleAccount: true,
            checkSmtp: false,
        });

        expect(result.formatValid).toBe(true);
        expect(result.disposable).toBeDefined();
        expect(result.roleAccount).toBeDefined();
        expect(result.mxValid).toBeDefined();
        expect(result.valid).toBeDefined();
        expect(Array.isArray(result.errors)).toBe(true);
    }, 10_000);

    it("should return valid for properly formatted email with all checks disabled", async () => {
        expect.assertions(4);

        const result = await verifyEmail("user@example.com", {
            checkDisposable: false,
            checkMx: false,
            checkRoleAccount: false,
            checkSmtp: false,
        });

        expect(result.formatValid).toBe(true);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });
});
