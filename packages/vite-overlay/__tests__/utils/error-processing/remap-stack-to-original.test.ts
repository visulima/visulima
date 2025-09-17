import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import buildExtendedErrorData from "../src/utils/error-processing";

describe("stack Remapping Integration Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("error processing with stack traces", () => {
        it("should process error with multiple stack frames", async () => {
            const mockError = new Error("Multi-frame error");

            mockError.stack = `Error: Multi-frame error
    at Component (/app/dist/component.js:10:5)
    at App (/app/dist/app.js:20:15)`;

            const mockServer = {
                config: {
                    root: "/mock/project/root",
                },
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            // Just verify the function runs with multiple stack frames
        });

        it("should handle frames without valid file paths", async () => {
            const mockError = new Error("Anonymous error");

            mockError.stack = `Error: Anonymous error
    at anonymous
    at Component (/app/dist/component.js:0:0)`;

            const mockServer = {
                config: {
                    root: "/mock/project/root",
                },
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            // Just verify the function runs with anonymous frames
        });

        it("should handle invalid file paths in stack traces", async () => {
            const mockError = new Error("Invalid path error");

            mockError.stack = `Error: Invalid path error
    at Component (invalid:path:10:5)`;

            const mockServer = {
                config: {
                    root: "/mock/project/root",
                },
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            // Just verify the function runs with invalid paths
        });

        it("should handle empty stack traces", async () => {
            const mockError = new Error("Empty stack");

            mockError.stack = "";

            const mockServer = {
                config: {
                    root: "/mock/project/root",
                },
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            // Just verify the function runs with empty stack
        });

        it("should handle errors during stack processing gracefully", async () => {
            const mockError = new Error("Processing error");

            mockError.stack = `Error: Processing error
    at Component (/app/dist/component.js:10:5)`;

            const mockServer = {
                config: {
                    root: "/mock/project/root",
                },
                moduleGraph: {
                    idToModuleMap: new Map(),
                },
                transformRequest: vi.fn().mockRejectedValue(new Error("Transform failed")),
            } as unknown as ViteDevServer;

            const result = await buildExtendedErrorData(mockError, mockServer);

            expect(result).toBeDefined();

            expectTypeOf(result).toBeObject();
            // Just verify the function runs without crashing
        });
    });
});
