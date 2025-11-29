import { describe, expect, it } from "vitest";

import checkMxRecords from "../../src/utils/check-mx-records";

const consoleMessage = "Skipping MX record check in CI environment, please validate this test locally.";

describe(checkMxRecords, () => {
    it("should return valid MX records for a domain with MX records", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 4);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const result = await checkMxRecords("gmail.com");

        expect(result.valid).toBe(true);
        expect(result.records).toBeDefined();
        expect(Array.isArray(result.records)).toBe(true);

        expect(result.records.length).toBeGreaterThan(0);
    }, 10_000);

    it("should return valid MX records sorted by priority", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 2);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const result = await checkMxRecords("example.com");

        expect(result.valid).toBe(true);
        expect(result.records).toBeDefined();

        for (let index = 1; index < result.records.length; index += 1) {
            const current = result.records[index];
            const previous = result.records[index - 1];

            expect(current.priority).toBeGreaterThanOrEqual(previous.priority);
        }
    }, 10_000);

    it("should return invalid result for non-existent domain", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 2);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const result = await checkMxRecords("this-domain-definitely-does-not-exist-12345.com");

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    }, 10_000);

    it("should return invalid result for invalid domain format", async () => {
        expect.assertions(2);

        const result = await checkMxRecords("");

        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
    });
});
