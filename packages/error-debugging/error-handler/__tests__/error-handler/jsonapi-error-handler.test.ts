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
        expect(res._getData()).toBe("{\"errors\":[{\"code\":500,\"title\":\"Internal Server Error\",\"detail\":\"test\"}]}");
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
        expect(res._getData()).toBe("{\"errors\":[{\"code\":500,\"title\":\"Internal Server Error\"}]}");
    });

    it("should prefer the http-error's own title property", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.Forbidden("denied");

        (error as httpErrors.HttpError & { title: string }).title = "Custom JSONAPI Title";

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData()) as { errors: { code: number; detail: string; title: string }[] };

        expect(body.errors[0]?.title).toBe("Custom JSONAPI Title");
        expect(body.errors[0]?.detail).toBe("denied");
    });

    it("should fall back to an empty detail when the http-error message is not a string", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        const error = new httpErrors.BadRequest();

        // Overwrite message with a non-string so the typeof guard rejects it.
        (error as unknown as { message: unknown }).message = 12_345;

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData()) as { errors: { code: number; detail: string; title: string }[] };

        expect(body.errors[0]?.code).toBe(400);
        expect(body.errors[0]?.detail).toBe("");
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

    it("responds with the application/vnd.api+json content type", async () => {
        expect.assertions(1);

        const { req, res } = createMocks({
            method: "GET",
        });

        await jsonapiErrorHandler(new httpErrors.Forbidden(), req, res);

        expect(String(res.getHeader("content-type"))).toBe("application/vnd.api+json; charset=utf-8");
    });

    it("clamps a duck-typed http-error carrying an out-of-range status to 500", async () => {
        expect.assertions(2);

        const { req, res } = createMocks({
            method: "GET",
        });

        // A wrapper error that duck-types as an HttpError but carries status 200
        // must not desync the body code from a valid HTTP status.
        const error = new Error("weird") as Error & { expose: boolean; status: number; statusCode: number };

        error.expose = true;
        error.status = 200;
        error.statusCode = 200;

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(500);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData()) as { errors: { code: number }[] };

        expect(body.errors[0]?.code).toBe(500);
    });

    it("uses the resolved status code (not a hardcoded 500) for a plain error with a 4xx statusCode", async () => {
        expect.assertions(3);

        const { req, res } = createMocks({
            method: "GET",
        });

        // A plain Error (not an http-errors instance) carrying a 4xx statusCode:
        // addStatusCodeToResponse resolves 422, and the generic branch must emit
        // that code as a number rather than the old hardcoded "500".
        const error = new Error("nope") as Error & { statusCode: number };

        error.statusCode = 422;

        await jsonapiErrorHandler(error, req, res);

        // eslint-disable-next-line no-underscore-dangle
        expect(res._getStatusCode()).toBe(422);

        // eslint-disable-next-line no-underscore-dangle
        const body = JSON.parse(res._getData()) as { errors: { code: number; detail: string; title: string }[] };

        expect(body.errors[0]?.code).toBe(422);
        expect(body.errors[0]?.title).toBe("Unprocessable Entity");
    });
});
