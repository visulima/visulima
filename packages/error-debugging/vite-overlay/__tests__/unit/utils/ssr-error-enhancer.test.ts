import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import enhanceViteSsrError from "../../../src/utils/ssr-error-enhancer";

describe(enhanceViteSsrError, () => {
    const mockServer = {
        config: {
            root: "/mock/project/root",
        },
        ssrFixStacktrace: vi.fn(
            (error: Error) =>
                // Mock implementation - just return the error as-is
                error,
        ),
    } as unknown as ViteDevServer;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should enhance basic error with file path", async () => {
        expect.assertions(3);

        const rawError = new Error("Module not found");

        rawError.stack = `Error: Module not found
    at /mock/project/root/src/App.tsx:10:5`;

        const result = await enhanceViteSsrError(rawError, mockServer);

        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toContain("Module not found");
    });

    it("should handle errors without stack traces", async () => {
        expect.assertions(2);

        const rawError = new Error("Simple error");

        const result = await enhanceViteSsrError(rawError, mockServer);

        expect(result).toBeDefined();
        expect(result.message).toBe("Simple error");
    });

    it("should handle non-Error objects", async () => {
        expect.assertions(2);

        const rawError = "String error";

        const result = await enhanceViteSsrError(rawError, mockServer);

        expect(result).toBeDefined();
        expect(result).toBeInstanceOf(Error);
    });

    it("should handle null or undefined errors", async () => {
        expect.assertions(4);

        const result1 = await enhanceViteSsrError(null, mockServer);
        const result2 = await enhanceViteSsrError(undefined, mockServer);

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
        expect(result1).toBeInstanceOf(Error);
        expect(result2).toBeInstanceOf(Error);
    });

    it("should enhance errors with additional properties", async () => {
        expect.assertions(3);

        const rawError = new Error("Custom error");

        (rawError as any).code = "MODULE_NOT_FOUND";
        (rawError as any).hint = "Try installing the missing package";

        const result = await enhanceViteSsrError(rawError, mockServer);

        expect(result).toBeDefined();
        expect((result as any).code).toBe("MODULE_NOT_FOUND");
        expect((result as any).hint).toBe("Try installing the missing package");
    });

    it("should handle errors with complex stack traces", async () => {
        expect.assertions(3);

        const rawError = new Error("Complex error");

        rawError.stack = `Error: Complex error
    at Component (/mock/project/root/src/components/Button.tsx:25:10)
    at App (/mock/project/root/src/App.tsx:15:5)
    at render (/node_modules/react-dom/index.js:100:20)`;

        const result = await enhanceViteSsrError(rawError, mockServer);

        expect(result).toBeDefined();
        expect(result.stack).toContain("Button.tsx");
        expect(result.stack).toContain("App.tsx");
    });

    it("should preserve error name", async () => {
        expect.assertions(1);

        const rawError = new Error("Named error");

        rawError.name = "CustomError";

        const result = await enhanceViteSsrError(rawError, mockServer);

        expect(result.name).toBe("CustomError");
    });
});
