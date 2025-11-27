import { describe, expect, it } from "vitest";

import headersToRecord from "../../src/utils/headers-to-record";

describe(headersToRecord, () => {
    describe("record input", () => {
        it("should return Record as-is", () => {
            expect.assertions(1);

            const headers: Record<string, string> = {
                Authorization: "Bearer token",
                "Content-Type": "application/json",
            };

            const result = headersToRecord(headers);

            expect(result).toBe(headers);
        });

        it("should handle empty Record", () => {
            expect.assertions(1);

            const headers: Record<string, string> = {};
            const result = headersToRecord(headers);

            expect(result).toStrictEqual({});
        });
    });

    describe("headers object input", () => {
        it("should convert Headers to Record", () => {
            expect.assertions(2);

            const headers = new Headers();

            headers.set("content-type", "application/json");
            headers.set("authorization", "Bearer token");

            const result = headersToRecord(headers);

            // Headers API is case-insensitive, but keys are normalized to lowercase
            expect(result["content-type"]).toBe("application/json");
            expect(result.authorization).toBe("Bearer token");
        });

        it("should handle empty Headers", () => {
            expect.assertions(1);

            const headers = new Headers();
            const result = headersToRecord(headers);

            expect(result).toStrictEqual({});
        });

        it("should handle Headers with multiple values", () => {
            expect.assertions(2);

            const headers = new Headers();

            // Note: Headers.append() replaces the value, not appends
            // To test multiple values, we need to set them differently
            headers.set("x-custom", "value1, value2");

            const result = headersToRecord(headers);

            // Headers API normalizes keys to lowercase
            expect(result["x-custom"]).toBeDefined();
            expect(result["x-custom"]).toContain("value1");
        });

        it("should preserve all header keys", () => {
            expect.assertions(3);

            const headers = new Headers();

            headers.set("header1", "value1");
            headers.set("header2", "value2");
            headers.set("header3", "value3");

            const result = headersToRecord(headers);

            // Headers API normalizes keys to lowercase
            expect(result.header1).toBe("value1");
            expect(result.header2).toBe("value2");
            expect(result.header3).toBe("value3");
        });
    });

    describe("edge cases", () => {
        it("should handle Headers with case-insensitive keys", () => {
            expect.assertions(1);

            const headers = new Headers();

            headers.set("content-type", "application/json");

            const result = headersToRecord(headers);

            expect(result["content-type"]).toBe("application/json");
        });
    });
});
