import { describe, expect, it } from "vitest";

import {
    BadRequest,
    corsMiddleware,
    createHttpError,
    createNodeRouter,
    dateIn,
    dateOut,
    expressWrapper,
    httpHeaderNormalizerMiddleware,
    ImATeapot,
    InternalServerError,
    jsonapiErrorHandler,
    NetworkAuthenticationRequire,
    NodeRouter,
    NotFound,
    onError,
    onNoMatch,
    problemErrorHandler,
    rateLimiterMiddleware,
    Router,
    serialize,
    serializersMiddleware,
    swaggerHandler,
    TooManyRequests,
    withZod,
    xmlTransformer,
    yamlTransformer,
    zod,
} from "../src/index-server";

describe("index-server", () => {
    it("should re-export the connect helpers and middlewares", () => {
        expect.assertions(8);

        expect(createNodeRouter).toBeTypeOf("function");
        expect(onError).toBeTypeOf("function");
        expect(onNoMatch).toBeTypeOf("function");
        expect(corsMiddleware).toBeTypeOf("function");
        expect(httpHeaderNormalizerMiddleware).toBeTypeOf("function");
        expect(rateLimiterMiddleware).toBeTypeOf("function");
        expect(serializersMiddleware).toBeTypeOf("function");
        expect(swaggerHandler).toBeTypeOf("function");
    });

    it("should re-export the standalone error handlers", () => {
        expect.assertions(2);

        expect(problemErrorHandler).toBeTypeOf("function");
        expect(jsonapiErrorHandler).toBeTypeOf("function");
    });

    it("should re-export serializers and zod date helpers", () => {
        expect.assertions(5);

        expect(serialize).toBeTypeOf("function");
        expect(xmlTransformer).toBeTypeOf("function");
        expect(yamlTransformer).toBeTypeOf("function");
        expect(dateIn).toBeTypeOf("function");
        expect(dateOut).toBeTypeOf("function");
    });

    it("should re-export the zod namespace from the browser bundle", () => {
        expect.assertions(2);

        expect(zod).toBeDefined();
        expect(zod.dateIn).toBeTypeOf("function");
    });

    it("should re-export http-errors classes read off the default function", () => {
        expect.assertions(6);

        const badRequest = new BadRequest();

        expect(badRequest.statusCode).toBe(400);

        const notFound = new NotFound();

        expect(notFound.statusCode).toBe(404);

        const teapot = new ImATeapot();

        expect(teapot.statusCode).toBe(418);

        const tooMany = new TooManyRequests();

        expect(tooMany.statusCode).toBe(429);

        const internal = new InternalServerError();

        expect(internal.statusCode).toBe(500);

        expect(createHttpError).toBeTypeOf("function");
    });

    it("should map the typoed NetworkAuthenticationRequire to the runtime class", () => {
        expect.assertions(1);

        const error = new NetworkAuthenticationRequire();

        expect(error.statusCode).toBe(511);
    });

    it("should re-export the @visulima/connect router primitives", () => {
        expect.assertions(4);

        expect(NodeRouter).toBeTypeOf("function");
        expect(Router).toBeTypeOf("function");
        expect(expressWrapper).toBeTypeOf("function");
        expect(withZod).toBeTypeOf("function");
    });
});
