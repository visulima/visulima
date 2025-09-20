import { describe, expect, it } from "vitest";

import getSourceFromMap from "../../../src/utils/get-source-from-map";

describe(getSourceFromMap, () => {
    it("should return source content when found by exact match", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/App.tsx", "src/utils/helpers.ts"],
            sourcesContent: ["console.log('app code');", "export const helper = () => {};"],
        };

        const result = getSourceFromMap(map, "src/App.tsx");

        expect(result).toBe("console.log('app code');");
    });

    it("should return source content when found by partial match", () => {
        expect.assertions(1);

        const map = {
            sources: ["/full/path/to/src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "src/App.tsx");

        expect(result).toBe("console.log('app code');");
    });

    it("should fall back to first source when requested source is not found", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "src/Missing.tsx");

        // Function falls back to first source when requested source is not found
        expect(result).toBe("console.log('app code');");
    });

    it("should return undefined for empty or invalid map", () => {
        expect.assertions(3);

        expect(getSourceFromMap(null as any, "src/App.tsx")).toBeUndefined();
        expect(getSourceFromMap({}, "src/App.tsx")).toBeUndefined();
        expect(getSourceFromMap({ sources: [] }, "src/App.tsx")).toBeUndefined();
    });

    it("should return undefined when sourcesContent is null", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: [null],
        };

        const result = getSourceFromMap(map, "src/App.tsx");

        expect(result).toBeUndefined();
    });

    it("should fall back to first source when sourcesContent is shorter than sources", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/App.tsx", "src/utils.ts"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "src/utils.ts");

        // Function falls back to first available source content
        expect(result).toBe("console.log('app code');");
    });

    it("should handle null wantedSource", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, null as any);

        // Function treats null as empty string and falls back to first source
        expect(result).toBe("console.log('app code');");
    });

    it("should handle empty wantedSource", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: ["console.log('app code');"],
        };

        const result = getSourceFromMap(map, "");

        // Function treats empty string as no specific source and falls back to first source
        expect(result).toBe("console.log('app code');");
    });
});
