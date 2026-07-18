import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { htmlErrorHandler } from "../../src/error-handler/html-error-handler";
import jsonapiErrorHandler from "../../src/error-handler/jsonapi-error-handler";
import { jsonErrorHandler } from "../../src/error-handler/json-error-handler";
import { jsonpErrorHandler } from "../../src/error-handler/jsonp-error-handler";
import problemErrorHandler from "../../src/error-handler/problem-error-handler";
import { textErrorHandler } from "../../src/error-handler/text-error-handler";
import { xmlErrorHandler } from "../../src/error-handler/xml-error-handler";

// getReasonPhrase throws ("Status code does not exist") for in-range but
// unassigned status codes (e.g. 460, 599 from a proxy/upstream). Every
// formatter must survive such a code instead of throwing while handling an
// error.
const makeError = (statusCode: number): Error & { statusCode: number } => {
    const error = new Error("upstream failure") as Error & { statusCode: number };

    error.statusCode = statusCode;

    return error;
};

describe("formatters with an unassigned in-range status code", () => {
    it.each([460, 599])("json handler does not throw for status %i", async (statusCode) => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await jsonErrorHandler()(makeError(statusCode), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(statusCode);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData()) as { error: string; statusCode: number };

        expect(data.statusCode).toBe(statusCode);
    });

    it.each([460, 599])("jsonp handler does not throw for status %i", async (statusCode) => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await jsonpErrorHandler()(makeError(statusCode), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(statusCode);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain("An error occurred");
    });

    it.each([460, 599])("text handler does not throw for status %i", async (statusCode) => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await textErrorHandler()(makeError(statusCode), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(statusCode);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("upstream failure");
    });

    it.each([460, 599])("xml handler does not throw for status %i", async (statusCode) => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await xmlErrorHandler()(makeError(statusCode), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(statusCode);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain(`<statusCode>${statusCode}</statusCode>`);
    });

    it.each([460, 599])("html handler does not throw for status %i", async (statusCode) => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await htmlErrorHandler()(makeError(statusCode), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(statusCode);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toContain(String(statusCode));
    });

    it.each([460, 599])("problem handler does not throw for status %i", async (statusCode) => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await problemErrorHandler(makeError(statusCode), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(statusCode);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData()) as { status: number; title: string };

        expect(data.status).toBe(statusCode);
    });

    it.each([460, 599])("jsonapi handler does not throw for status %i", async (statusCode) => {
        expect.assertions(2);

        const { req, res } = createMocks({ method: "GET" });

        await jsonapiErrorHandler(makeError(statusCode), req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(statusCode);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData()) as { errors: { code: number }[] };

        expect(data.errors[0]?.code).toBe(statusCode);
    });
});
