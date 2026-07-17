import { describe, expect, it } from "vitest";

import EmailError from "../../src/errors/email-error";
import isRetryableResult from "../../src/utils/is-retryable-result";
import { REQUEST_TIMEOUT_CODE } from "../../src/utils/make-request";

const responseWithStatus = (statusCode: number) => {
    return {
        data: { body: undefined, headers: {}, statusCode },
        error: new EmailError("http", `Request failed with status ${String(statusCode)}`, { code: String(statusCode) }),
        success: false,
    };
};

describe(isRetryableResult, () => {
    describe("server answered", () => {
        it.each([408, 429, 503])("retries %i, which the server rejected without acting on it", (statusCode) => {
            expect.assertions(1);

            expect(isRetryableResult(responseWithStatus(statusCode))).toBe(true);
        });

        it.each([400, 401, 403, 404, 422])("does not retry %i, which a repeat would only reproduce", (statusCode) => {
            expect.assertions(1);

            expect(isRetryableResult(responseWithStatus(statusCode))).toBe(false);
        });

        it.each([500, 502, 504])("does not retry %i, which may be raised after the message was already sent", (statusCode) => {
            expect.assertions(1);

            expect(isRetryableResult(responseWithStatus(statusCode))).toBe(false);
        });
    });

    describe("no response", () => {
        it("does not retry a timeout, since the server may have acted on the request", () => {
            expect.assertions(1);

            const result = {
                error: new EmailError("http", "Request timed out after 1000ms", { code: REQUEST_TIMEOUT_CODE }),
                success: false,
            };

            expect(isRetryableResult(result)).toBe(false);
        });

        it("retries a connection failure, which never reached a server", () => {
            expect.assertions(1);

            const result = {
                error: new EmailError("http", "Request failed: fetch failed", { cause: new Error("ECONNREFUSED") }),
                success: false,
            };

            expect(isRetryableResult(result)).toBe(true);
        });

        it("retries a failure from a non-HTTP caller, which carries no status at all", () => {
            expect.assertions(1);

            expect(isRetryableResult({ error: new Error("boom"), success: false })).toBe(true);
        });
    });
});
