import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { addStatusCodeToResponse, sendJson, setErrorHeaders } from "../../src/error-handler/utils";

describe("error-handler/utils", () => {
    it("should set error headers", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.BadRequest();

        error.headers = {
            "X-Test": "test",
        } as any;

        setErrorHeaders(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getHeaders()).toStrictEqual({
            "x-test": "test",
        });
    });

    it("should send json", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        sendJson(res, { test: "test" });

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe('{"test":"test"}');
    });

    it("should add status code to response", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        addStatusCodeToResponse(res, 500);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
    });
});


