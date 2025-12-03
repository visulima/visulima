import { describe, expect, it } from "vitest";

import type { Cache } from "../../../src/utils/cache";
import { InMemoryCache } from "../../../src/utils/cache";
import type { MxCheckResult } from "../../../src/utils/validation/check-mx-records";
import { checkMxRecords } from "../../../src/utils/validation/check-mx-records";

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

    it("should cache MX records when cache is provided", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 5);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const cache = new InMemoryCache<MxCheckResult>();
        const domain = "example.com";

        const result1 = await checkMxRecords(domain, { cache });

        // Verify cache contains the result
        const cachedValue = await cache.get(domain);

        expect(cachedValue).toBeDefined();
        expect(cachedValue?.valid).toBe(result1.valid);

        // Second call should return cached value
        const result2 = await checkMxRecords(domain, { cache });

        expect(result1.valid).toBe(result2.valid);
        expect(result1.records).toStrictEqual(result2.records);
        // Verify both results are the same object reference (from cache)
        expect(cachedValue).toStrictEqual(result2);
    }, 10_000);

    it("should respect cache TTL", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 3);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const cache = new InMemoryCache<MxCheckResult>();
        const domain = "example.com";

        const result1 = await checkMxRecords(domain, { cache, ttl: 100 });

        // Verify cache contains the result
        const cachedBeforeExpiry = await cache.get(domain);

        expect(cachedBeforeExpiry).toBeDefined();

        // Wait for TTL to expire (100ms TTL + buffer)
        await new Promise((resolve) => {
            setTimeout(() => {
                resolve(undefined);
            }, 150);
        });

        // After TTL expiry, cache should be empty
        const cachedAfterExpiry = await cache.get(domain);

        expect(cachedAfterExpiry).toBeUndefined();

        // New call should perform DNS lookup again
        const result2 = await checkMxRecords(domain, { cache, ttl: 100 });

        expect(result2.valid).toBe(result1.valid);
    }, 10_000);

    it("should not cache when using no-op cache", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 2);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const noOpCache: Cache<MxCheckResult> = {
            clear: async () => {},
            delete: async () => {},
            get: async () => undefined,
            set: async () => {},
        };

        const domain = "example.com";

        const result1 = await checkMxRecords(domain, { cache: noOpCache });
        const result2 = await checkMxRecords(domain, { cache: noOpCache });

        expect(result1.valid).toBe(result2.valid);
        expect(result1.records).toStrictEqual(result2.records);
    }, 10_000);

    it("should clear cache", async () => {
        // eslint-disable-next-line vitest/prefer-expect-assertions
        expect.assertions(process.env.CI ? 0 : 3);

        if (process.env.CI) {
            // eslint-disable-next-line no-console
            console.log(consoleMessage);

            return;
        }

        const cache = new InMemoryCache<MxCheckResult>();
        const domain = "example.com";

        const result1 = await checkMxRecords(domain, { cache });

        // Verify cache contains the result
        const cachedBeforeClear = await cache.get(domain);

        expect(cachedBeforeClear).toBeDefined();

        await cache.clear();

        // After clear, cache should be empty
        const cachedAfterClear = await cache.get(domain);

        expect(cachedAfterClear).toBeUndefined();

        // New call should perform DNS lookup again
        const result2 = await checkMxRecords(domain, { cache });

        expect(result2.valid).toBe(result1.valid);
    }, 10_000);
});
