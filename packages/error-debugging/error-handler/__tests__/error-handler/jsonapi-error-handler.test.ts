import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import tsJapi from "ts-japi";
import { describe, expect, it } from "vitest";

import jsonapiErrorHandler from "../../src/error-handler/jsonapi-error-handler";

describe("jsonapi-error-handler", () => {
    it("should render normal error", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new Error("test");

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"errors\":[{\"code\":\"500\",\"title\":\"Internal Server Error\",\"detail\":\"test\"}]}");
    });

    it("should render http-errors", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden();

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(403);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"errors\":[{\"code\":403,\"title\":\"Forbidden\",\"detail\":\"Forbidden\"}]}");
    });

    it("should render japi-error", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new tsJapi.ErrorSerializer();

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"errors\":[{\"code\":\"500\",\"title\":\"Internal Server Error\"}]}");
    });

    it("should serialize a real JapiError through the ts-japi serializer", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new tsJapi.JapiError({ detail: "Validation failed", status: "422", title: "Unprocessable Entity" });

        await jsonapiErrorHandler(error as unknown as Error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData());

        expect(body.errors).toStrictEqual([{ detail: "Validation failed", status: "422", title: "Unprocessable Entity" }]);
        expect(body.jsonapi).toStrictEqual({ version: "1.0" });
    });
});
