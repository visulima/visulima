import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import extendSwaggerSpec from "../../src/swagger/extend-swagger-spec";

describe("swagger/extend-swagger-spec", () => {
    it("should return the spec untouched when there are no paths", () => {
        expect.assertions(1);

        const spec = { info: { title: "Test", version: "1.0.0" }, openapi: "3.0.0" } as OpenAPIV3.Document;

        expect(extendSwaggerSpec(spec, { "application/json": true })).toBe(spec);
    });

    it("should skip media types that are disabled in allowedMediaTypes", () => {
        expect.assertions(2);

        const spec = {
            info: { title: "Test", version: "1.0.0" },
            openapi: "3.0.0",
            paths: {
                "/disabled": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        example: { foo: "bar" },
                                        schema: { type: "object" },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        } as OpenAPIV3.Document;

        const result = extendSwaggerSpec(spec, {
            "application/json": true,
            "text/xml": false,
        });

        const content = (result.paths?.["/disabled"]?.get as OpenAPIV3.OperationObject).responses["200"] as OpenAPIV3.ResponseObject;

        expect(content.content?.["application/json"]).toBeDefined();
        expect(content.content?.["text/xml"]).toBeUndefined();
    });

    it("should reference array schemas with an items $ref", () => {
        expect.assertions(1);

        const spec = {
            info: { title: "Test", version: "1.0.0" },
            openapi: "3.0.0",
            paths: {
                "/list": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: { items: { type: "object" }, type: "array" },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        } as OpenAPIV3.Document;

        const result = extendSwaggerSpec(spec, { "application/json": true, "text/xml": true });

        const xmlSchema = ((result.paths?.["/list"]?.get as OpenAPIV3.OperationObject).responses["200"] as OpenAPIV3.ResponseObject).content?.["text/xml"]?.schema as OpenAPIV3.ArraySchemaObject;

        expect(xmlSchema.type).toBe("array");
    });

    it("should resolve example values referenced via $ref when transforming examples", () => {
        expect.assertions(1);

        const spec = {
            components: {
                examples: {
                    Ref: {
                        value: { ref: "value" },
                    },
                },
            },
            info: { title: "Test", version: "1.0.0" },
            openapi: "3.0.0",
            paths: {
                "/ref": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            Linked: {
                                                $ref: "#/components/examples/Ref",
                                            },
                                        },
                                        schema: { type: "object" },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        } as OpenAPIV3.Document;

        const result = extendSwaggerSpec(spec, { "application/json": true, "text/xml": true });

        const xmlExamples = ((result.paths?.["/ref"]?.get as OpenAPIV3.OperationObject).responses["200"] as OpenAPIV3.ResponseObject).content?.["text/xml"]?.examples as Record<string, OpenAPIV3.ExampleObject>;

        expect(xmlExamples.Linked?.value).toContain("<ref>value</ref>");
    });

    it("should transform inline string example values", () => {
        expect.assertions(1);

        const spec = {
            info: { title: "Test", version: "1.0.0" },
            openapi: "3.0.0",
            paths: {
                "/inline": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            Inline: {
                                                value: "plain-string",
                                            },
                                        },
                                        schema: { type: "object" },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        } as OpenAPIV3.Document;

        const result = extendSwaggerSpec(spec, { "application/json": true, "application/x-yaml": true });

        const yamlExamples = ((result.paths?.["/inline"]?.get as OpenAPIV3.OperationObject).responses["200"] as OpenAPIV3.ResponseObject).content?.[
            "application/x-yaml"
        ]?.examples as Record<string, OpenAPIV3.ExampleObject>;

        expect(yamlExamples.Inline?.value).toBe("plain-string\n");
    });

    it("should extend swagger spec", () => {
        expect.assertions(1);

        const spec = {
            info: {
                title: "Test",
                version: "1.0.0",
            },
            openapi: "3.0.0",
            paths: {
                "/test": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        } as OpenAPIV3.Document;

        const extendedSpec = extendSwaggerSpec(spec, {
            "application/json": true,
            "text/xml": true,
        });

        expect(extendedSpec).toStrictEqual({
            components: {
                schemas: {
                    Test: {
                        type: "object",
                    },
                },
            },
            info: {
                title: "Test",
                version: "1.0.0",
            },
            openapi: "3.0.0",
            paths: {
                "/test": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            $ref: "#/components/schemas/Test",
                                        },
                                    },
                                    "text/xml": {
                                        schema: {
                                            $ref: "#/components/schemas/Test",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        });
    });

    it("should extend swagger spec with examples", () => {
        expect.assertions(1);

        const spec = {
            components: {
                examples: {
                    Test2: {
                        value: {
                            test: "test",
                        },
                    },
                },
            },
            info: {
                title: "Test",
                version: "1.0.0",
            },
            openapi: "3.0.0",
            paths: {
                "/test": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            Test: {
                                                value: {
                                                    test: "test",
                                                },
                                            },
                                        },
                                        schema: {
                                            type: "object",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
                "/test2": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            Test2: {
                                                $ref: "#/components/examples/Test2",
                                            },
                                        },
                                        schema: {
                                            type: "object",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
                "/test3": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        example: {
                                            test: "test",
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test3",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        } as OpenAPIV3.Document;

        const extendedSpec = extendSwaggerSpec(spec, {
            "application/json": true,
            "application/x-yaml": true,
            "text/xml": true,
        });

        expect(extendedSpec).toStrictEqual({
            components: {
                examples: {
                    Test: {
                        value: {
                            test: "test",
                        },
                    },
                    Test2: {
                        value: {
                            test: "test",
                        },
                    },
                },
                schemas: {
                    Test: {
                        type: "object",
                    },
                    Test2: {
                        type: "object",
                    },
                },
            },
            info: {
                title: "Test",
                version: "1.0.0",
            },
            openapi: "3.0.0",
            paths: {
                "/test": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            Test: {
                                                $ref: "#/components/examples/Test",
                                            },
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test",
                                        },
                                    },
                                    "application/x-yaml": {
                                        examples: {
                                            Test: {
                                                value: "test: test\n",
                                            },
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test",
                                        },
                                    },
                                    "text/xml": {
                                        examples: {
                                            Test: {
                                                value: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<test>test</test>",
                                            },
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
                "/test2": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        examples: {
                                            Test2: {
                                                $ref: "#/components/examples/Test2",
                                            },
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test2",
                                        },
                                    },
                                    "application/x-yaml": {
                                        examples: {
                                            Test2: {
                                                value: "test: test\n",
                                            },
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test2",
                                        },
                                    },
                                    "text/xml": {
                                        examples: {
                                            Test2: {
                                                value: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<test>test</test>",
                                            },
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test2",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
                "/test3": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        example: {
                                            test: "test",
                                        },
                                        schema: {
                                            $ref: "#/components/schemas/Test3",
                                        },
                                    },
                                    "application/x-yaml": {
                                        example: "test: test\n",
                                        schema: {
                                            $ref: "#/components/schemas/Test3",
                                        },
                                    },
                                    "text/xml": {
                                        example: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<test>test</test>",
                                        schema: {
                                            $ref: "#/components/schemas/Test3",
                                        },
                                    },
                                },
                                description: "OK",
                            },
                        },
                    },
                },
            },
        });
    });
});
