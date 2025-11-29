import { describe, expect, expectTypeOf, it } from "vitest";

import verifySmtp from "../../src/utils/verify-smtp";

const consoleMessage = "Skipping SMTP verification in CI environment, please validate this test locally.";

describe(verifySmtp, () => {
    it("should return error for invalid email format", async () => {
        expect.assertions(2);

        const result = await verifySmtp("invalid-email");

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it("should return error for empty email", async () => {
        expect.assertions(2);

        const result = await verifySmtp("");

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });

    it("should return error for domain without MX records", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 2);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const result = await verifySmtp("user@this-domain-definitely-does-not-exist-12345.com");

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    }, 10_000);

    it("should attempt SMTP verification for valid domain", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 1);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        // Note: This test may fail if the mail server blocks SMTP verification
        const result = await verifySmtp("test@example.com", {
            timeout: 3000,
        });

        // We expect either a timeout/connection error or a valid/invalid response
        expect(result).toBeDefined();

        expectTypeOf(result.valid).toBeBoolean();
    }, 10_000);

    it("should respect timeout option", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 2);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const startTime = Date.now();
        const result = await verifySmtp("test@example.com", {
            timeout: 1000,
        });
        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        // Should timeout or complete within reasonable time (allowing some buffer)
        expect(duration).toBeLessThan(5000);
    }, 10_000);
});
