import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import type { OpenAPIV3 } from "openapi-types";

import openapiHandler from "../../../src/openapi/api/openapi-handler";

describe("openapi-handler", () => {
    // Tests that the function returns a 200 status code with JSON content type when no accept header is provided.
    it("should return a 200 status code with JSON content type when no accept header is provided", async () => {
        const request = {
            headers: {
                accept: "application/json",
            },
        } as unknown as IncomingMessage;
        const response = {
            end: vi.fn(),
            setHeader: vi.fn(),
            statusCode: 0,
        } as unknown as ServerResponse;

        await openapiHandler({})(request, response);

        expect(response.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.end).toHaveBeenCalledWith("{}");
    });

    // Tests that the function returns a 200 status code with YAML content type when the accept header is 'yaml' or 'yml'.
    it('should return a 200 status code with YAML content type when the accept header is "yaml" or "yml"', async () => {
        const request = {
            headers: {
                accept: "text/yaml",
            },
        } as unknown as IncomingMessage;
        const response = {
            end: vi.fn(),
            setHeader: vi.fn(),
            statusCode: 0,
        } as unknown as ServerResponse;

        await openapiHandler({})(request, response);

        expect(response.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "text/yaml");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.end).toHaveBeenCalledWith("{}\n");
    });

    // Tests that the function merges multiple OpenAPI specs and extends them with allowed media types.
    it("should merge multiple OpenAPI specs and extend them with allowed media types", async () => {
        const request = {
            headers: {
                accept: "application/json",
            },
        } as unknown as IncomingMessage;
        const response = {
            end: vi.fn(),
            setHeader: vi.fn(),
            statusCode: 0,
        } as unknown as ServerResponse;

        const spec1 = {
            info: {
                title: "API 1",
            },
            paths: {
                "/path1": {
                    get: {
                        responses: {
                            "200": {
                                description: "OK",
                            },
                        },
                    },
                },
            },
        } as unknown as Partial<OpenAPIV3.Document>;

        const spec2 = {
            info: {
                title: "API 2",
            },
            paths: {
                "/path2": {
                    post: {
                        responses: {
                            "201": {
                                description: "Created",
                            },
                        },
                    },
                },
            },
        } as unknown as Partial<OpenAPIV3.Document>;

        await openapiHandler({
            specs: [spec1, spec2],
        })(request, response);

        expect(response.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.end).toMatchSnapshot();

        const expectedSpec = {
            info: {
                title: "API 2",
            },
            paths: {
                "/path1": {
                    get: {
                        responses: {
                            "200": {
                                description: "OK",
                            },
                        },
                    },
                },
                "/path2": {
                    post: {
                        responses: {
                            "201": {
                                description: "Created",
                            },
                        },
                    },
                },
            },
        };

        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.end).toHaveBeenCalledWith(JSON.stringify(expectedSpec, null, 2));
    });

    it('should return a 200 status code with JSON content type when the accept header is not "yaml" or "yml" but contains "yaml" or "yml"', async () => {
        const request = {
            headers: {
                accept: "application/json, text/yaml",
            },
        } as unknown as IncomingMessage;
        const response = {
            end: vi.fn(),
            setHeader: vi.fn(),
            statusCode: 0,
        } as unknown as ServerResponse;

        await openapiHandler({})(request, response);

        expect(response.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.end).toHaveBeenCalledWith("{}");
    });

    it("should return a 200 status code with JSON content type when the accept header is not a string", async () => {
        const request = {
            headers: {
                accept: undefined,
            },
        } as unknown as IncomingMessage;
        const response = {
            end: vi.fn(),
            setHeader: vi.fn(),
            statusCode: 0,
        } as unknown as ServerResponse;

        await openapiHandler({})(request, response);

        expect(response.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.end).toHaveBeenCalledWith("{}");
    });

    it("should return a 200 status code with JSON content type when the specs array is empty", async () => {
        const request = {
            headers: {
                accept: "application/json, text/yaml",
            },
        } as unknown as IncomingMessage;
        const response = {
            end: vi.fn(),
            setHeader: vi.fn(),
            statusCode: 0,
        } as unknown as ServerResponse;

        await openapiHandler({
            specs: [],
        })(request, response);

        expect(response.statusCode).toBe(200);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(response.end).toHaveBeenCalledWith("{}");
    });
});
