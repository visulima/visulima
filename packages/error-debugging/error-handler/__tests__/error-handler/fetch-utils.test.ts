import { describe, expect, it } from "vitest";

import { extractStatusCode, sendFetchJson } from "../../src/error-handler/fetch-utils";

describe("fetch-utils re-exports", () => {
    it("should re-export extractStatusCode as a callable function", () => {
        expect.assertions(2);

        expect(typeof extractStatusCode).toBe("function");

        const error = new Error("boom");

        (error as Error & Record<string, unknown>).statusCode = 418;

        expect(extractStatusCode(error)).toBe(418);
    });

    it("should re-export sendFetchJson as a callable function", async () => {
        expect.assertions(3);

        expect(typeof sendFetchJson).toBe("function");

        const response = sendFetchJson({ ok: false }, 422);

        expect(response).toBeInstanceOf(Response);

        const body = await response.json();

        expect(body).toStrictEqual({ ok: false });
    });

    it("should default content-type to application/json when none supplied via fetch-utils", () => {
        expect.assertions(1);

        const response = sendFetchJson({}, 200);

        expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    });

    it("should accept a custom content-type via fetch-utils", () => {
        expect.assertions(1);

        const response = sendFetchJson({}, 200, "application/problem+json; charset=utf-8");

        expect(response.headers.get("content-type")).toBe("application/problem+json; charset=utf-8");
    });

    it("should default extractStatusCode fallback to 500 for non-errors", () => {
        expect.assertions(2);

        expect(extractStatusCode(undefined)).toBe(500);
        expect(extractStatusCode({})).toBe(500);
    });
});
