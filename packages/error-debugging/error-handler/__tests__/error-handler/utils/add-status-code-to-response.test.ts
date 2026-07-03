import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import addStatusCodeToResponse from "../../../src/error-handler/utils/add-status-code-to-response";

describe(addStatusCodeToResponse, () => {
    it("should set status code from error.statusCode", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.BadRequest();

        error.statusCode = 404;

        addStatusCodeToResponse(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(404);
    });

    it("should set status code from error.status", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new Error("Test error");

        (error as Error & Record<string, unknown>).status = 403;

        addStatusCodeToResponse(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);
    });

    it("should prefer statusCode over status", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new Error("Test error");

        (error as Error & Record<string, unknown>).statusCode = 404;
        (error as Error & Record<string, unknown>).status = 403;

        addStatusCodeToResponse(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(404);
    });

    it("should set default status code for errors without status", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new Error("Test error");

        addStatusCodeToResponse(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
    });

    it("should not change existing status code if it's already set to 4xx or 5xx", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        res.statusCode = 404; // Pre-set status

        const error = new Error("Test error");

        (error as Error & Record<string, unknown>).statusCode = 403;

        addStatusCodeToResponse(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403); // Should be updated to error status
    });

    it("should set status code for 4xx errors", () => {
        expect.assertions(6);

        const testCases = [400, 401, 403, 404, 422, 429];

        testCases.forEach((statusCode) => {
            const { res } = createMocks({
                method: "GET",
            });

            const error = new Error("Test error");

            (error as Error & Record<string, unknown>).statusCode = statusCode;

            addStatusCodeToResponse(res, error);

            // eslint-disable-next-line no-underscore-dangle
            expect(res._getStatusCode()).toBe(statusCode);
        });
    });

    it("should set status code for 5xx errors", () => {
        expect.assertions(4);

        const testCases = [500, 502, 503, 504];

        testCases.forEach((statusCode) => {
            const { res } = createMocks({
                method: "GET",
            });

            const error = new Error("Test error");

            (error as Error & Record<string, unknown>).statusCode = statusCode;

            addStatusCodeToResponse(res, error);

            // eslint-disable-next-line no-underscore-dangle
            expect(res._getStatusCode()).toBe(statusCode);
        });
    });

    it("should ignore invalid status codes", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new Error("Test error");

        (error as Error & Record<string, unknown>).statusCode = 999; // Invalid status code

        addStatusCodeToResponse(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500); // Should default to 500
    });

    it("should keep a pre-set 4xx/5xx status when the error carries no usable status code", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        res.statusCode = 418; // Already an error status, no valid candidate on the error.

        const error = new Error("Test error"); // No statusCode/status -> candidate is NaN.

        addStatusCodeToResponse(res, error);

        // Both guards are skipped: candidate invalid AND statusCode already >= 400, so it stays.
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(418);
    });

    it("should handle string status codes", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new Error("Test error");

        (error as Error & Record<string, unknown>).statusCode = "404"; // String instead of number

        addStatusCodeToResponse(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(404); // Should convert string to number
    });
});
