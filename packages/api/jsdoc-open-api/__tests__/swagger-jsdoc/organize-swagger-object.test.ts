import { describe, expect, it } from "vitest";

import organizeSwaggerObject from "../../src/swagger-jsdoc/organize-swagger-object";

const swaggerObject = {
    basePath: "/",
    consumes: [],
    definitions: {},
    externalDocs: {},
    host: "localhost:3000",
    info: {
        description: "A sample API",
        title: "Hello World",
        version: "1.0.0",
    },
    parameters: {},
    paths: {},
    produces: [],
    responses: {},
    schemes: [],
    security: {},
    securityDefinitions: {},
    swagger: "2.0",
    tags: [],
};

describe("organize", () => {
    it("should handle \"definitions\"", () => {
        expect.assertions(1);

        const annotation = {
            definitions: {
                testDefinition: {
                    properties: {
                        password: {
                            type: "string",
                        },
                        username: {
                            type: "string",
                        },
                    },
                    required: ["username", "password"],
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "definitions");

        expect(swaggerObject.definitions).toStrictEqual({
            testDefinition: {
                properties: {
                    password: { type: "string" },
                    username: { type: "string" },
                },
                required: ["username", "password"],
            },
        });
    });

    it("should handle \"parameters\"", () => {
        expect.assertions(1);

        const annotation = {
            parameters: {
                testParameter: {
                    description: "max records to return",
                    format: "int32",
                    in: "query",
                    name: "limit",
                    required: true,
                    type: "integer",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "parameters");

        expect(swaggerObject.parameters).toStrictEqual({
            testParameter: {
                description: "max records to return",
                format: "int32",
                in: "query",
                name: "limit",
                required: true,
                type: "integer",
            },
        });
    });

    it("should handle \"securityDefinitions\"", () => {
        expect.assertions(1);

        const annotation = {
            securityDefinitions: {
                basicAuth: {
                    description: "HTTP Basic Authentication. Works over `HTTP` and `HTTPS`",
                    type: "basic",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "securityDefinitions");

        expect(swaggerObject.securityDefinitions).toStrictEqual({
            basicAuth: {
                description: "HTTP Basic Authentication. Works over `HTTP` and `HTTPS`",
                type: "basic",
            },
        });
    });

    it("should handle \"responses\"", () => {
        expect.assertions(1);

        const annotation = {
            responses: {
                IllegalInput: {
                    description: "Illegal input for operation.",
                },
            },
        };

        organizeSwaggerObject(swaggerObject, annotation, "responses");

        expect(swaggerObject.responses).toStrictEqual({
            IllegalInput: { description: "Illegal input for operation." },
        });
    });

    it("should handle \"security\"", () => {
        expect.assertions(1);

        const annotation = {
            security: [
                {
                    bearerAuth: [],
                },
            ],
        };

        organizeSwaggerObject(swaggerObject, annotation, "security");

        expect(swaggerObject.security).toStrictEqual([
            {
                bearerAuth: [],
            },
        ]);
    });

    it("should copy the \"x-webhooks\" root extension as-is", () => {
        expect.assertions(1);

        const target: Record<string, any> = {};
        const annotation = {
            "x-webhooks": {
                newPet: { post: { responses: { 200: { description: "ok" } } } },
            },
        };

        organizeSwaggerObject(target, annotation, "x-webhooks");

        expect(target["x-webhooks"]).toStrictEqual({
            newPet: { post: { responses: { 200: { description: "ok" } } } },
        });
    });

    it("should skip generic \"x-\" extensions without placing them in paths", () => {
        expect.assertions(2);

        const target: Record<string, any> = { paths: {} };
        const annotation = { "x-tagGroups": [{ name: "group" }] };

        organizeSwaggerObject(target, annotation, "x-tagGroups");

        expect(target["x-tagGroups"]).toBeUndefined();
        expect(target.paths).toStrictEqual({});
    });

    it("should push an array of tags, deduplicating existing tag names", () => {
        expect.assertions(1);

        const target: Record<string, any> = { tags: [{ name: "existing" }] };
        const annotation = {
            tags: [{ name: "existing" }, { name: "fresh" }],
        };

        organizeSwaggerObject(target, annotation, "tags");

        expect(target.tags).toStrictEqual([{ name: "existing" }, { name: "fresh" }]);
    });

    it("should push a single tag object when tags is not an array", () => {
        expect.assertions(1);

        const target: Record<string, any> = { tags: [] };
        const annotation = { tags: { name: "single" } };

        organizeSwaggerObject(target, annotation, "tags");

        expect(target.tags).toStrictEqual([{ name: "single" }]);
    });

    it("should not push a single tag object that is already present", () => {
        expect.assertions(1);

        const target: Record<string, any> = { tags: [{ name: "single" }] };
        const annotation = { tags: { name: "single" } };

        organizeSwaggerObject(target, annotation, "tags");

        expect(target.tags).toStrictEqual([{ name: "single" }]);
    });

    it("should merge path properties that start with a slash into paths", () => {
        expect.assertions(1);

        const target: Record<string, any> = { paths: {} };
        const annotation = {
            "/pets": { get: { responses: { 200: { description: "ok" } } } },
        };

        organizeSwaggerObject(target, annotation, "/pets");

        expect(target.paths).toStrictEqual({
            "/pets": { get: { responses: { 200: { description: "ok" } } } },
        });
    });

    it("should ignore properties that match none of the handled cases", () => {
        expect.assertions(1);

        const target: Record<string, any> = { paths: {} };
        const annotation = { info: { title: "ignored" } };

        organizeSwaggerObject(target, annotation, "info");

        // `info` is not a common property, not tags/security, and does not start with "/",
        // so the function leaves the target untouched.
        expect(target).toStrictEqual({ paths: {} });
    });
});
