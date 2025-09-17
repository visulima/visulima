import { describe, expect, it } from "vitest";

import { getSourceFromMap } from "../../src/utils/source-map-utils";

describe(getSourceFromMap, () => {
    it("should return source content when found by exact match", () => {
        const map = {
            sources: ["src/App.tsx", "src/utils/helpers.ts"],
            sourcesContent: ["console.log('app code');", "export const helper = () => {};"],
        };

        const result = getSourceFromMap(map, "src/App.tsx");

        expect(result).toBe("console.log('app code');");
    });

    it("should return source content when found by partial match", () => {
        const map = {
            sources: ["/full/path/to/src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "src/App.tsx");

        expect(result).toBe("console.log('app code');");
    });

    it("should return undefined when source is not found", () => {
        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "src/Missing.tsx");

        expect(result).toBeUndefined();
    });

    it("should return undefined for empty or invalid map", () => {
        expect(getSourceFromMap(null as any, "src/App.tsx")).toBeUndefined();
        expect(getSourceFromMap({}, "src/App.tsx")).toBeUndefined();
        expect(getSourceFromMap({ sources: [] }, "src/App.tsx")).toBeUndefined();
    });

    it("should return undefined when sourcesContent is null", () => {
        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: [null],
        };

        const result = getSourceFromMap(map, "src/App.tsx");

        expect(result).toBeUndefined();
    });

    it("should handle sourcesContent shorter than sources", () => {
        const map = {
            sources: ["src/App.tsx", "src/utils.ts"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "src/utils.ts");

        expect(result).toBeUndefined();
    });

    it("should handle null wantedSource", () => {
        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, null as any);

        expect(result).toBeUndefined();
    });

    it("should handle empty wantedSource", () => {
        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "");

        expect(result).toBeUndefined();
    });
});
