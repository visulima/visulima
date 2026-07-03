import { describe, expect, it } from "vitest";

import { extractSafeHeaders, extractSafeNodeHeaders } from "../../../../src/middleware/shared/headers";

describe("headers", () => {
    describe(extractSafeHeaders, () => {
        it("should extract non-sensitive headers", () => {
            expect.assertions(2);

            const headers = new Headers({
                "content-type": "application/json",
                "x-request-id": "abc-123",
            });

            const result = extractSafeHeaders(headers);

            expect(result["content-type"]).toBe("application/json");
            expect(result["x-request-id"]).toBe("abc-123");
        });

        it("should filter out authorization header", () => {
            expect.assertions(2);

            const headers = new Headers({
                authorization: "Bearer token123",
                "content-type": "application/json",
            });

            const result = extractSafeHeaders(headers);

            expect(result.authorization).toBeUndefined();
            expect(result["content-type"]).toBe("application/json");
        });

        it("should filter out cookie headers", () => {
            expect.assertions(2);

            const headers = new Headers({
                "content-type": "text/html",
                cookie: "session=abc123",
            });

            const result = extractSafeHeaders(headers);

            expect(result.cookie).toBeUndefined();
            expect(result["content-type"]).toBe("text/html");
        });

        it("should filter out all sensitive headers", () => {
            expect.assertions(4);

            const headers = new Headers({
                authorization: "Bearer xxx",
                "content-type": "text/html",
                "proxy-authorization": "Basic xxx",
                "x-api-key": "key123",
                "x-auth-token": "token123",
            });

            const result = extractSafeHeaders(headers);

            expect(result.authorization).toBeUndefined();
            expect(result["x-api-key"]).toBeUndefined();
            expect(result["x-auth-token"]).toBeUndefined();
            expect(result["proxy-authorization"]).toBeUndefined();
        });

        it("should handle empty headers", () => {
            expect.assertions(1);

            const headers = new Headers();
            const result = extractSafeHeaders(headers);

            expect(Object.keys(result)).toHaveLength(0);
        });
    });

    describe(extractSafeNodeHeaders, () => {
        it("should extract non-sensitive headers", () => {
            expect.assertions(2);

            const headers = {
                "content-type": "application/json",
                "x-request-id": "abc-123",
            };

            const result = extractSafeNodeHeaders(headers);

            expect(result["content-type"]).toBe("application/json");
            expect(result["x-request-id"]).toBe("abc-123");
        });

        it("should filter out sensitive headers", () => {
            expect.assertions(2);

            const headers = {
                authorization: "Bearer token",
                "content-type": "application/json",
            };

            const result = extractSafeNodeHeaders(headers);

            expect(result.authorization).toBeUndefined();
            expect(result["content-type"]).toBe("application/json");
        });

        it("should join array header values", () => {
            expect.assertions(1);

            const headers = {
                "accept-language": ["en-US", "de-DE"],
            };

            const result = extractSafeNodeHeaders(headers);

            expect(result["accept-language"]).toBe("en-US, de-DE");
        });

        it("should skip undefined values", () => {
            expect.assertions(1);

            const headers = {
                "content-type": "text/html",
                "x-custom": undefined,
            };

            const result = extractSafeNodeHeaders(headers);

            expect(result["x-custom"]).toBeUndefined();
        });
    });
});
