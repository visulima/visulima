import type { ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import findModuleForPath from "../../src/utils/find-module-for-path";

describe(findModuleForPath, () => {
    const mockServer = {
        moduleGraph: {
            getModuleById: vi.fn(),
            idToModuleMap: new Map(),
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
        expect(mockServer.moduleGraph.getModuleById).toHaveBeenCalledTimes(2);
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
        expect(() => findModuleForPath(null as any, ["/src/App.tsx"])).not.toThrow();
        expect(() => findModuleForPath(undefined as any, ["/src/App.tsx"])).not.toThrow();
    });
});
