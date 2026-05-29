/* eslint-disable @typescript-eslint/no-unsafe-argument */
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

    it("returns the first source content directly when no source is requested", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: ["first content"],
        };

        const result = getSourceFromMap(map, undefined);

        expect(result).toBe("first content");
    });

    it("returns undefined for an extension-only name with no separators that does not match", () => {
        expect.assertions(1);

        // "Missing" has no slash/backslash, so normalization is skipped and -1 is returned;
        // sourcesContent[0] is null so there is no fallback either.
        const map = {
            sources: ["src/App.tsx"],
            sourcesContent: [null],
        };

        const result = getSourceFromMap(map, "Missing");

        expect(result).toBeUndefined();
    });

    it("matches a source after path normalization (backslashes -> forward slashes)", () => {
        expect.assertions(1);

        const map = {
            sources: ["src/components/Button.tsx"],
            sourcesContent: ["button content"],
        };

        // The wanted source uses backslashes; normalization makes it match the stored source.
        const result = getSourceFromMap(map, String.raw`src\components\Button.tsx`);

        expect(result).toBe("button content");
    });

    it("matches a source via suffix partial-match when exact and normalized lookups fail", () => {
        expect.assertions(1);

        const map = {
            sources: ["/abs/project/src/deep/Widget.tsx"],
            sourcesContent: ["widget content"],
        };

        // No exact match; partial match because the stored source ends with the wanted suffix.
        const result = getSourceFromMap(map, "src/deep/Widget.tsx");

        expect(result).toBe("widget content");
    });

    it("skips null entries in the sources array during partial matching", () => {
        expect.assertions(1);

        const map = {
            sources: [null as unknown as string, "/abs/src/Real.tsx"],
            sourcesContent: ["ignored", "real content"],
        };

        const result = getSourceFromMap(map, "src/Real.tsx");

        expect(result).toBe("real content");
    });

    it("returns undefined when sources is an empty array but content exists at no matching index", () => {
        expect.assertions(1);

        // sources empty -> findSourceIndex short-circuits to -1; falls back to first content.
        const map = {
            sources: [] as string[],
            sourcesContent: ["fallback content"],
        };

        const result = getSourceFromMap(map, "src/whatever.tsx");

        expect(result).toBe("fallback content");
    });
});
