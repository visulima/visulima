import { describe, expect, it, vi } from "vitest";

import baseHandler from "../src/base-crud-handler";
import type { Adapter } from "../src";

const baseMockAdapter: Adapter<any, any> = {
    connect: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    disconnect: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getModels: () => ["routeName"],
    getOne: vi.fn(),
    getPaginationData: vi.fn(),
    handleError: vi.fn(),
    init: vi.fn(),
    mapModelsToRouteNames: vi.fn(),
    models: ["routeName"],
    parseQuery: vi.fn(),
    update: vi.fn(),
};

describe("baseHandler", () => {
    it.todo("should handle GET request for reading all resources", async () => {
        // Mock the necessary dependencies and create a test instance of the baseHandler function
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();
        const adapter = {
            ...baseMockAdapter,
        };
        const options = {
            models: {
                modelName: {
                    name: "routeName",
                },
            },
        };
        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, options);

        // Create a mock request and response
        const request = {
            headers: {
                host: "example.com",
            },
            method: "GET",
            url: "/routeName",
        } as unknown as Request;
        const response = {};

        // Call the handler function with the mock request and response
        await handler(request, response);

        // Assert that the necessary adapter methods were called with the correct parameters
        expect(adapter.init).toHaveBeenCalledWith();
        expect(adapter.connect).toHaveBeenCalledWith();
        expect(adapter.getAll).toHaveBeenCalledWith("routeName", {
            limit: undefined,
            page: undefined,
        });
        expect(adapter.parseQuery).toHaveBeenCalledWith();
        expect(adapter.disconnect).toHaveBeenCalledWith();

        // Assert that the responseExecutor and finalExecutor functions were called
        expect(responseExecutor).toHaveBeenCalledWith();
        expect(finalExecutor).toHaveBeenCalledWith();
    });

    // Tests that the handler correctly handles a GET request for reading one resource
    it.todo("should handle GET request for reading one resource", async () => {
        // Mock the necessary dependencies and create a test instance of the baseHandler function
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();
        const adapter = {
            ...baseMockAdapter,
            getOne: vi.fn().mockResolvedValue({}),
        };
        const options = {
            models: {
                modelName: {
                    name: "routeName",
                },
            },
        };
        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, options);

        // Create a mock request and response
        const request = {
            headers: {
                host: "example.com",
            },
            method: "GET",
            url: "/routeName/1",
        } as unknown as Request;
        const response = {};

        // Call the handler function with the mock request and response
        await handler(request, response);

        // Assert that the necessary adapter methods were called with the correct parameters
        expect(adapter.init).toHaveBeenCalledWith();
        expect(adapter.connect).toHaveBeenCalledWith();
        expect(adapter.getOne).toHaveBeenCalledWith("modelName", "1", {});
        expect(adapter.parseQuery).toHaveBeenCalledWith();
        expect(adapter.disconnect).toHaveBeenCalledWith();

        // Assert that the responseExecutor and finalExecutor functions were called
        expect(responseExecutor).toHaveBeenCalledWith();
        expect(finalExecutor).toHaveBeenCalledWith();
    });

    // Tests that the handler correctly handles a POST request for creating a resource
    it.todo("should handle POST request for creating a resource", async () => {
        // Mock the necessary dependencies and create a test instance of the baseHandler function
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();
        const adapter = {
            ...baseMockAdapter,
            create: vi.fn().mockResolvedValue({}),
        };
        const options = {
            models: {
                modelName: {
                    name: "routeName",
                },
            },
        };
        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, options);

        // Create a mock request and response
        const request = {
            body: {},
            headers: {
                host: "example.com",
            },
            method: "POST",
            url: "/routeName",
        } as unknown as Request;
        const response = {};

        // Call the handler function with the mock request and response
        await handler(request, response);

        // Assert that the necessary adapter methods were called with the correct parameters
        expect(adapter.init).toHaveBeenCalledWith();
        expect(adapter.connect).toHaveBeenCalledWith();
        expect(adapter.create).toHaveBeenCalledWith("modelName", {}, {});
        expect(adapter.parseQuery).toHaveBeenCalledWith();
        expect(adapter.disconnect).toHaveBeenCalledWith();

        // Assert that the responseExecutor and finalExecutor functions were called
        expect(responseExecutor).toHaveBeenCalledWith();
        expect(finalExecutor).toHaveBeenCalledWith();
    });

    // Tests that the handler correctly handles a PUT request for updating a resource
    it.todo("should handle PUT request for updating a resource", async () => {
        // Mock the necessary dependencies and create a test instance of the baseHandler function
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();
        const adapter = {
            ...baseMockAdapter,
            update: vi.fn().mockResolvedValue({ data: {}, status: 200 }),
        };
        const options = {
            models: {
                modelName: {
                    name: "routeName",
                },
            },
        };
        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, options);

        // Create a mock request and response
        const request = {
            body: {},
            headers: {
                host: "example.com",
            },
            method: "PUT",
            url: "/routeName/123",
        } as unknown as Request;
        const response = {};

        // Call the handler function with the mock request and response
        await handler(request, response);

        // Assert that the necessary adapter methods were called with the correct parameters
        expect(adapter.init).toHaveBeenCalledWith();
        expect(adapter.connect).toHaveBeenCalledWith();
        expect(adapter.update).toHaveBeenCalledWith("modelName", "123", {}, {});
        expect(adapter.parseQuery).toHaveBeenCalledWith();
        expect(adapter.disconnect).toHaveBeenCalledWith();

        // Assert that the responseExecutor and finalExecutor functions were called
        expect(responseExecutor).toHaveBeenCalledWith();
        expect(finalExecutor).toHaveBeenCalledWith();
    });

    // Tests that the handler correctly handles a DELETE request for deleting a resource
    it.todo("should handle DELETE request for deleting a resource", async () => {
        // Mock the necessary dependencies and create a test instance of the baseHandler function
        const responseExecutor = vi.fn();
        const finalExecutor = vi.fn();
        const adapter = {
            ...baseMockAdapter,
            delete: vi.fn().mockResolvedValue({ data: {}, status: 200 }),
        };
        const options = {
            models: {
                modelName: {
                    name: "routeName",
                },
            },
        };
        const handler = await baseHandler(responseExecutor, finalExecutor, adapter, options);

        // Create a mock request and response
        const request = {
            headers: {
                host: "example.com",
            },
            method: "DELETE",
            url: "/routeName/123",
        } as unknown as Request;
        const response = {};

        // Call the handler function with the mock request and response
        await handler(request, response);

        // Assert that the necessary adapter methods were called with the correct parameters
        expect(adapter.init).toHaveBeenCalledWith();
        expect(adapter.connect).toHaveBeenCalledWith();
        expect(adapter.delete).toHaveBeenCalledWith("modelName", "123", {});
        expect(adapter.parseQuery).toHaveBeenCalledWith();
        expect(adapter.disconnect).toHaveBeenCalledWith();

        // Assert that the responseExecutor and finalExecutor functions were called
        expect(responseExecutor).toHaveBeenCalledWith();
        expect(finalExecutor).toHaveBeenCalledWith();
    });
});
