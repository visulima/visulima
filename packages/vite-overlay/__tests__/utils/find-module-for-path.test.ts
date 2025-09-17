import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import findModuleForPath from "../../src/utils/find-module-for-path";

describe(findModuleForPath, () => {
    const mockServer = {
        moduleGraph: {
            getModuleById: vi.fn(),
            idToModuleMap: new Map(),
            getModuleByUrl: vi.fn(),
        },
    } as unknown as ViteDevServer;

    beforeEach(() => {
        vi.clearAllMocks();
        mockServer.moduleGraph.idToModuleMap.clear();
    });

    it("should return module when found by exact id", () => {
        const mockModule = { id: "/src/App.tsx" };

        mockServer.moduleGraph.idToModuleMap.set("/src/App.tsx", mockModule);
        mockServer.moduleGraph.getModuleById.mockReturnValue(mockModule);

        const result = findModuleForPath(mockServer, ["/src/App.tsx"]);

        expect(result).toBe(mockModule);
        expect(mockServer.moduleGraph.getModuleById).toHaveBeenCalledWith("/src/App.tsx");
    });

    it("should return module when found by url", () => {
        const mockModule = { url: "/src/Component.tsx" };

        mockServer.moduleGraph.idToModuleMap.set("/src/Component.tsx", mockModule);
        mockServer.moduleGraph.getModuleById.mockReturnValue(mockModule);

        const result = findModuleForPath(mockServer, ["/src/Component.tsx"]);

        expect(result).toBe(mockModule);
    });

    it("should try multiple candidates", () => {
        const mockModule = { id: "/src/Utils.ts" };

        mockServer.moduleGraph.getModuleById.mockReturnValueOnce(null);
        mockServer.moduleGraph.getModuleById.mockReturnValueOnce(mockModule);

        const result = findModuleForPath(mockServer, ["/src/Missing.ts", "/src/Utils.ts"]);

        expect(result).toBe(mockModule);
        expect(mockServer.moduleGraph.getModuleById).toHaveBeenCalledTimes(6); // 3 candidates × 2 lookups each
    });

    it("should return undefined when no module is found", () => {
        mockServer.moduleGraph.getModuleById.mockReturnValue(null);

        const result = findModuleForPath(mockServer, ["/src/Missing.tsx"]);

        expect(result).toBeUndefined();
    });

    it("should handle empty candidates array", () => {
        const result = findModuleForPath(mockServer, []);

        expect(result).toBeUndefined();
    });

    it("should handle null or undefined server", () => {
        // These should throw because we can't access moduleGraph on null/undefined
        expect(() => findModuleForPath(null as any, ["/src/App.tsx"])).toThrow();
        expect(() => findModuleForPath(undefined as any, ["/src/App.tsx"])).toThrow();
    });

    describe("module scoring and prioritization", () => {
        it("should prioritize modules with transform result (score 2)", () => {
            const moduleWithoutTransform = {
                id: "/src/App.tsx",
                url: "/src/App.tsx",
                // No transformResult
            };

            const moduleWithTransform = {
                id: "/src/App.tsx",
                url: "/src/App.tsx",
                transformResult: { code: "compiled code" },
            };

            mockServer.moduleGraph.getModuleById.mockReturnValueOnce(moduleWithoutTransform);
            mockServer.moduleGraph.getModuleById.mockReturnValueOnce(moduleWithTransform);

            const result = findModuleForPath(mockServer, ["/src/App.tsx"]);

            expect(result).toBe(moduleWithTransform);
        });

        it("should return valid module without transform result when no better option (score 1)", () => {
            const validModule = {
                id: "/src/App.tsx",
                url: "/src/App.tsx",
                // No transformResult but has properties
            };

            mockServer.moduleGraph.getModuleById.mockReturnValue(validModule);

            const result = findModuleForPath(mockServer, ["/src/App.tsx"]);

            expect(result).toBe(validModule);
        });

        it("should skip invalid modules (empty objects, score 0)", () => {
            const invalidModule = {}; // Empty object - no properties
            const validModule = {
                id: "/src/App.tsx",
                url: "/src/App.tsx",
            };

            mockServer.moduleGraph.getModuleById.mockReturnValueOnce(invalidModule);
            mockServer.moduleGraph.getModuleById.mockReturnValueOnce(validModule);

            const result = findModuleForPath(mockServer, ["/src/App.tsx"]);

            // Should return the valid module, not the invalid one
            expect(result).toBe(validModule);
        });

        it("should handle URL lookup returning invalid modules", () => {
            const invalidUrlModule = {}; // Empty object from URL lookup
            const validIdModule = {
                id: "/src/App.tsx",
                url: "/src/App.tsx",
            };

            mockServer.moduleGraph.getModuleById.mockReturnValue(null);
            mockServer.moduleGraph.getModuleByUrl.mockReturnValue(invalidUrlModule);

            // Mock the expensive iteration to return the valid module
            mockServer.moduleGraph.idToModuleMap.set("/src/App.tsx", validIdModule);

            const result = findModuleForPath(mockServer, ["/src/App.tsx"]);

            expect(result).toBe(validIdModule);
        });

        it("should handle missing files that result in invalid modules", () => {
            // Simulate a missing file that returns empty module objects
            const invalidModule = {}; // Empty object - represents missing file

            mockServer.moduleGraph.getModuleById.mockReturnValue(invalidModule);
            mockServer.moduleGraph.getModuleByUrl.mockReturnValue(invalidModule);

            const result = findModuleForPath(mockServer, ["/missing/file.svg"]);

            // Should return undefined when expensive iteration fails to find any module
            expect(result).toBeUndefined();
        });

        it("should prefer modules with transform result over URL lookup without transform result", () => {
            const urlModule = {
                url: "/src/App.tsx",
                // No transformResult
            };

            const idModule = {
                id: "/src/App.tsx",
                transformResult: { code: "compiled code" },
            };

            mockServer.moduleGraph.getModuleById.mockReturnValueOnce(null);
            mockServer.moduleGraph.getModuleById.mockReturnValueOnce(idModule);
            mockServer.moduleGraph.getModuleByUrl.mockReturnValue(urlModule);

            const result = findModuleForPath(mockServer, ["/src/App.tsx"]);

            expect(result).toBe(idModule);
        });
    });

    describe("real-world error scenarios", () => {
        it("should handle vite.svg import error gracefully", () => {
            // Simulate the vite.svg missing file scenario
            const invalidModule = {}; // Empty object representing missing file

            mockServer.moduleGraph.getModuleById.mockReturnValue(invalidModule);
            mockServer.moduleGraph.getModuleByUrl.mockReturnValue(invalidModule);

            const result = findModuleForPath(mockServer, ["../vite.svg"]);

            // Should return undefined when no valid module is found in expensive iteration
            expect(result).toBeUndefined();
        });

        it("should handle multiple invalid candidates before finding valid one", () => {
            const invalidModule1 = {};
            const invalidModule2 = {};
            const validModule = {
                id: "/src/App.tsx",
                transformResult: { code: "compiled code" },
            };

            mockServer.moduleGraph.getModuleById
                .mockReturnValueOnce(invalidModule1)
                .mockReturnValueOnce(invalidModule2)
                .mockReturnValueOnce(validModule);

            const result = findModuleForPath(mockServer, ["/missing1", "/missing2", "/src/App.tsx"]);

            expect(result).toBe(validModule);
        });
    });
});
