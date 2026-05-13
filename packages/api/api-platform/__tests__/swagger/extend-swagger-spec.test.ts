import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import extendSwaggerSpec from "../../src/swagger/extend-swagger-spec";

describe("swagger/extend-swagger-spec", () => {
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
