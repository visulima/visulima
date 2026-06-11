import httpErrors from "http-errors";
import { createMocks } from "node-mocks-http";
import tsJapi from "ts-japi";
import { describe, expect, it } from "vitest";

import jsonapiErrorHandler from "../../src/error-handler/jsonapi-error-handler";

describe("jsonapi-error-handler", () => {
    it("should suppress the raw message of a non-exposed error", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        // A generic Error (e.g. an unexpected SQL/file-path leak) must not have
        // its message reflected to the client.
        const error = new Error("connection to db at /var/secret failed");

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);
        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"errors\":[{\"code\":\"500\",\"title\":\"Internal Server Error\",\"detail\":\"Internal Server Error\"}]}");
    });

    it("should expose the message of an opted-in error", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = Object.assign(new Error("safe message"), { expose: true });

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getData()).toBe("{\"errors\":[{\"code\":\"500\",\"title\":\"Internal Server Error\",\"detail\":\"safe message\"}]}");
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
        expect(res._getData()).toBe("{\"errors\":[{\"code\":\"500\",\"title\":\"Internal Server Error\",\"detail\":\"Internal Server Error\"}]}");
    });

    it("should serialize a real JapiError instance through the ErrorSerializer branch", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new tsJapi.JapiError({
            detail: "I am a teapot",
            status: "418",
            title: "Teapot",
        });

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const data = JSON.parse(res._getData() as string) as { errors: { detail: string; status: string; title: string }[] };

        expect(data.errors[0]?.title).toBe("Teapot");
        expect(data.errors[0]?.detail).toBe("I am a teapot");
    });
});
