import type { OpenAPIV3 } from "openapi-types";
import { describe, expect, it } from "vitest";

import extendSwaggerSpec from "../../src/swagger/extend-swagger-spec";

describe("swagger/extend-swagger-spec", () => {
    it("should extend swagger spec", () => {
        const spec = {
            openapi: "3.0.0",
            info: {
                title: "Test",
                version: "1.0.0",
            },
            paths: {
                "/test": {
                    get: {
                        responses: {
                            200: {
                                description: "OK",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                        },
                                    },
                                },
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
            openapi: "3.0.0",
            info: {
                title: "Test",
                version: "1.0.0",
            },
            components: {
                schemas: {
                    Test: {
                        type: "object",
                    },
                },
            },
            paths: {
                "/test": {
                    get: {
                        responses: {
                            200: {
                                content: {
                                    "application/json": {
                                        schema: {
                                            // eslint-disable-next-line radar/no-duplicate-string
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
        const spec = {
            openapi: "3.0.0",
            info: {
                title: "Test",
                version: "1.0.0",
            },
            components: {
                examples: {
                    Test2: {
                        value: {
                            test: "test",
                        },
                    },
                },
            },
            paths: {
                "/test": {
                    get: {
                        responses: {
                            200: {
                                description: "OK",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                        },
                                        examples: {
                                            Test: {
                                                value: {
                                                    test: "test",
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                "/test2": {
                    get: {
                        responses: {
                            200: {
                                description: "OK",
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object",
                                        },
                                        examples: {
                                            Test2: {
                                                // eslint-disable-next-line radar/no-duplicate-string
                                                $ref: "#/components/examples/Test2",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        } as OpenAPIV3.Document;

        const extendedSpec = extendSwaggerSpec(spec, {
            "application/json": true,
            "text/xml": true,
            "application/x-yaml": true,
        });

        expect(extendedSpec).toStrictEqual({
            openapi: "3.0.0",
            info: {
                title: "Test",
                version: "1.0.0",
            },
            components: {
                schemas: {
                    Test: {
                        type: "object",
                    },
                    Test2: {
                        type: "object",
                    },
                },
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
            },
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
                                        examples: {
                                            Test: {
                                                $ref: "#/components/examples/Test",
                                            },
                                        },
                                    },
                                    "text/xml": {
                                        schema: {
                                            $ref: "#/components/schemas/Test",
                                        },
                                        examples: {
                                            Test: {
                                                value: '<?xml version="1.0" encoding="UTF-8"?>\n<test>test</test>',
                                            },
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
                                        schema: {
                                            $ref: "#/components/schemas/Test2",
                                        },
                                        examples: {
                                            Test2: {
                                                $ref: "#/components/examples/Test2",
                                            },
                                        },
                                    },
                                    "text/xml": {
                                        schema: {
                                            $ref: "#/components/schemas/Test2",
                                        },
                                        examples: {
                                            Test2: {
                                                value: '<?xml version="1.0" encoding="UTF-8"?>\n<test>test</test>',
                                            },
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
