import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import { describe, expect, it } from "vitest";

import { setErrorHeaders } from "../../../src/error-handler/utils/set-error-headers";

describe("setErrorHeaders", () => {
    it("should set error headers on response", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.BadRequest();
        error.headers = {
            "X-Test": "test",
            "x-custom": "custom",
        } as any;

        setErrorHeaders(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getHeaders()).toStrictEqual({
            "x-test": "test",
            "x-custom": "custom",
        });
    });

    it("should handle empty error headers", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new Error("Test error");

        setErrorHeaders(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getHeaders()).toStrictEqual({});
    });

    it("should handle undefined error headers", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new Error("Test error");

        setErrorHeaders(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getHeaders()).toStrictEqual({});
    });

    it("should handle array headers", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.BadRequest();
        error.headers = {
            "Set-Cookie": ["cookie1=value1", "cookie2=value2"],
        } as any;

        setErrorHeaders(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getHeaders()).toStrictEqual({
            "set-cookie": ["cookie1=value1", "cookie2=value2"], // Mock doesn't join arrays
        });
    });

    it("should handle number and string header values", () => {
        expect.assertions(1);

        const { res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.BadRequest();
        error.headers = {
            "X-Number": 42,
            "X-String": "test",
            "X-Boolean": true,
        } as any;

        setErrorHeaders(res, error);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getHeaders()).toStrictEqual({
            "x-number": 42, // Mock doesn't convert to string
            "x-string": "test",
            "x-boolean": true, // Mock doesn't convert to string
        });
    });
});
