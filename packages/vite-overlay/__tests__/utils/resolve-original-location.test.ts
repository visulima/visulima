import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import resolveOriginalLocation from "../../src/utils/resolve-original-location";

describe(resolveOriginalLocation, () => {
    const mockServer = {
        config: {
            root: "/mock/project/root",
        },
        transformRequest: vi.fn(),
    } as unknown as ViteDevServer;

    const mockModule = {
        id: "/src/App.tsx",
        transformResult: {
            map: {
                mappings: "AAAA",
                sources: ["src/App.tsx"],
                sourcesContent: ["console.log('original code');"],
                version: 3,
            },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should resolve location using source map", async () => {
        expect.assertions(2);

        mockServer.transformRequest.mockResolvedValue({
            map: {
                mappings: "AAAA",
                sources: ["src/App.tsx"],
                sourcesContent: ["console.log('original code');"],
                version: 3,
            },
        });

        const result = await resolveOriginalLocation(mockServer, mockModule, "/src/App.tsx", 10, 5);

        expect(result).toBeDefined();
        expect(result.originalFilePath).toBeDefined();

        expectTypeOf(result.originalFileLine).toBeNumber();
        expectTypeOf(result.originalFileColumn).toBeNumber();
    });

    it("should handle cached transform result", async () => {
        expect.assertions(2);

        const result = await resolveOriginalLocation(mockServer, mockModule, "/src/App.tsx", 10, 5);

        expect(result).toBeDefined();
        expect(mockServer.transformRequest).not.toHaveBeenCalled(); // Should use cached result
    });

    it("should fall back to estimation when source map resolution fails", async () => {
        expect.assertions(2);

        mockServer.transformRequest.mockResolvedValue({
            // eslint-disable-next-line unicorn/no-null
            map: null, // No source map
        });

        const result = await resolveOriginalLocation(mockServer, { id: "/src/App.tsx" }, "/src/App.tsx", 10, 5);

        expect(result).toBeDefined();
        expect(result.originalFilePath).toBe("/src/App.tsx");

        expectTypeOf(result.originalFileLine).toBeNumber();
        expectTypeOf(result.originalFileColumn).toBeNumber();
    });

    it("should handle HTTP URLs", async () => {
        expect.assertions(2);

        const httpModule = {
            id: "http://localhost:5173/src/App.tsx",
        };

        const result = await resolveOriginalLocation(mockServer, httpModule, "http://localhost:5173/src/App.tsx", 10, 5);

        expect(result).toBeDefined();
        expect(result.originalFilePath).toBeDefined();
    });

    it("should handle missing module", async () => {
        expect.assertions(2);

        // eslint-disable-next-line unicorn/no-null, @typescript-eslint/no-explicit-any
        const result = await resolveOriginalLocation(mockServer, null as any, "/src/App.tsx", 10, 5);

        expect(result).toBeDefined();
        expect(result.originalFilePath).toBe("/src/App.tsx");
    });

    it("should handle transform request errors gracefully", async () => {
        expect.assertions(2);

        mockServer.transformRequest.mockRejectedValue(new Error("Transform failed"));

        const result = await resolveOriginalLocation(mockServer, { id: "/src/App.tsx" }, "/src/App.tsx", 10, 5);

        expect(result).toBeDefined();
        expect(result.originalFilePath).toBe("/src/App.tsx");
    });

    it("should handle edge cases with line/column values", async () => {
        expect.assertions(2);

        const result = await resolveOriginalLocation(mockServer, mockModule, "/src/App.tsx", 0, 0);

        expect(result).toBeDefined();
        expect(result.originalFilePath).toBeDefined();
    });
});
