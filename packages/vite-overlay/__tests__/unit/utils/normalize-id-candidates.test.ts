import { describe, expect, it } from "vitest";

import { isHttpUrl, normalizeIdCandidates } from "../../../src/utils/normalize-id-candidates";

// Import the actual functions without mocking

describe(isHttpUrl, () => {
    it("should return true for HTTP URLs", () => {
        expect.assertions(2);

        expect(isHttpUrl("http://localhost:5173/src/App.tsx")).toBe(true);
        expect(isHttpUrl("https://example.com/file.js")).toBe(true);
    });

    it("should return false for non-HTTP URLs", () => {
        expect.assertions(3);

        expect(isHttpUrl("/src/App.tsx")).toBe(false);
        expect(isHttpUrl("file:///path/to/file.js")).toBe(false);
        expect(isHttpUrl("./relative/path.js")).toBe(false);
    });

    it("should handle edge cases", () => {
        expect.assertions(3);

        expect(isHttpUrl("")).toBe(false);
        expect(isHttpUrl(null as any)).toBe(false);
        expect(isHttpUrl(undefined as any)).toBe(false);
    });
});

describe(normalizeIdCandidates, () => {
    it("should generate candidates for local file path", () => {
        expect.assertions(3);

        const candidates = normalizeIdCandidates("/home/user/project/src/App.tsx");

        expect(candidates).toContain("/home/user/project/src/App.tsx");
        expect(candidates).toContain("home/user/project/src/App.tsx"); // Remove leading slash
        expect(candidates).toHaveLength(2);
    });

    it("should generate candidates for HTTP URL", () => {
        expect.assertions(2);

        const candidates = normalizeIdCandidates("http://localhost:5173/src/App.tsx");

        expect(candidates).toContain("/src/App.tsx");
        expect(candidates.length).toBeGreaterThan(0);
    });

    it("should handle paths with @fs prefix", () => {
        expect.assertions(3);

        const candidates = normalizeIdCandidates("/@fs/home/user/project/src/App.tsx");

        expect(candidates).toContain("/@fs/home/user/project/src/App.tsx");
        expect(candidates).toContain("@fs/home/user/project/src/App.tsx"); // Remove leading slash
        expect(candidates).toHaveLength(2);
    });

    it("should handle relative paths", () => {
        expect.assertions(2);

        const candidates = normalizeIdCandidates("./src/App.tsx");

        expect(candidates).toContain("./src/App.tsx");
        expect(candidates).toHaveLength(1); // No leading slash to remove
    });

    it("should handle paths with query parameters", () => {
        expect.assertions(3);

        const candidates = normalizeIdCandidates("http://localhost:5173/src/App.tsx?tsr-split=component");

        expect(candidates).toContain("/src/App.tsx?tsr-split=component");
        expect(candidates).toContain("/src/App.tsx");
        expect(candidates).toHaveLength(2);
    });

    it("should deduplicate candidates", () => {
        expect.assertions(1);

        const candidates = normalizeIdCandidates("/src/App.tsx");

        const uniqueCandidates = [...new Set(candidates)];

        expect(candidates).toHaveLength(uniqueCandidates.length);
    });

    it("should filter out empty strings", () => {
        expect.assertions(2);

        const candidates = normalizeIdCandidates("");

        expect(candidates).toStrictEqual([]);
        expect(candidates).toHaveLength(0);
    });

    it("should handle edge cases", () => {
        expect.assertions(3);

        expect(() => normalizeIdCandidates(null as any)).not.toThrow();
        expect(() => normalizeIdCandidates(undefined as any)).not.toThrow();
        expect(normalizeIdCandidates("")).toStrictEqual([]);
    });
});
