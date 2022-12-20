import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import tsJapi from "ts-japi";
import { describe, expect, it } from "vitest";

import jsonapiErrorHandler from "../../src/error-handler/jsonapi-error-handler";

describe("jsonapi-error-handler", () => {
    it("should render normal error", () => {
        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new Error("test");

        jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toStrictEqual('{"errors":[{"code":"500","title":"Internal Server Error","detail":"test"}]}');
    });

    it("should render http-errors", () => {
        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden();

        jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toStrictEqual('{"errors":[{"code":403,"title":"Forbidden","detail":"Forbidden"}]}');
    });

    it("should render japi-error", () => {
        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new tsJapi.ErrorSerializer();

        jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toStrictEqual('{"errors":[{"code":"500","title":"Internal Server Error"}]}');
    });
});
