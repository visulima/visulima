import { describe, expect, it } from "vitest";

import { extractStatusCode } from "../../../src/error-handler/utils/extract-status-code";

describe(extractStatusCode, () => {
    it("should extract status code from error.statusCode", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        (error as any).statusCode = 404;

        const result = extractStatusCode(error);

        expect(result).toBe(404);
    });

    it("should extract status code from error.status", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        (error as any).status = 403;

        const result = extractStatusCode(error);

        expect(result).toBe(403);
    });

    it("should prefer statusCode over status", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        (error as any).statusCode = 404;
        (error as any).status = 403;

        const result = extractStatusCode(error);

        expect(result).toBe(404);
    });

    it("should return default status code for errors without status", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        const result = extractStatusCode(error);

        expect(result).toBe(500);
    });

    it("should return custom fallback status code", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        const result = extractStatusCode(error, 404);

        expect(result).toBe(404);
    });

    it("should handle valid 4xx status codes", () => {
        expect.assertions(5);

        const testCases = [400, 401, 403, 404, 422];

        testCases.forEach((statusCode) => {
            const error = new Error("Test error");

            (error as any).statusCode = statusCode;

            const result = extractStatusCode(error);

            expect(result).toBe(statusCode);
        });
    });

    it("should handle valid 5xx status codes", () => {
        expect.assertions(4);

        const testCases = [500, 502, 503, 504];

        testCases.forEach((statusCode) => {
            const error = new Error("Test error");

            (error as any).statusCode = statusCode;

            const result = extractStatusCode(error);

            expect(result).toBe(statusCode);
        });
    });

    it("should return fallback for invalid status codes below 400", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        (error as any).statusCode = 200;

        const result = extractStatusCode(error);

        expect(result).toBe(500);
    });

    it("should return fallback for invalid status codes above 599", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        (error as any).statusCode = 700;

        const result = extractStatusCode(error);

        expect(result).toBe(500);
    });

    it("should handle string status codes", () => {
        expect.assertions(1);

        const error = new Error("Test error");

        (error as any).statusCode = "404";

        const result = extractStatusCode(error);

        expect(result).toBe(404); // Should convert string to number
    });

    it("should handle null or undefined error", () => {
        expect.assertions(2);

        const result1 = extractStatusCode(null);
        const result2 = extractStatusCode(undefined);

        expect(result1).toBe(500);
        expect(result2).toBe(500);
    });

    it("should handle edge case status codes", () => {
        expect.assertions(2);

        const error1 = new Error("Test error");

        (error1 as any).statusCode = 399; // Below 400

        const error2 = new Error("Test error");

        (error2 as any).statusCode = 600; // Above 599

        const result1 = extractStatusCode(error1);
        const result2 = extractStatusCode(error2);

        expect(result1).toBe(500);
        expect(result2).toBe(500);
    });
});
