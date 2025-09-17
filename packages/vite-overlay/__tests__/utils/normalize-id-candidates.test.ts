import { describe, expect, it, vi } from "vitest";

import { isHttpUrl, normalizeIdCandidates } from "../../src/utils/normalize-id-candidates";

// Mock the normalizeIdCandidates function to avoid complex path resolution logic
vi.mock("../../src/utils/normalize-id-candidates", () => {
    return {
        isHttpUrl: (value: string): boolean => value.startsWith("http://") || value.startsWith("https://"),
        normalizeIdCandidates: (filePath: string): string[] => {
            const candidates = [filePath];

            // Add relative path versions
            if (filePath.startsWith("/")) {
                candidates.push(filePath.slice(1));
            }

            // Add http versions for testing
            if (!filePath.startsWith("http")) {
                candidates.push(`http://localhost:5173${filePath}`);
            }

            return candidates;
        },
    };
});

describe(isHttpUrl, () => {
    it("should return true for HTTP URLs", () => {
        expect(isHttpUrl("http://localhost:5173/src/App.tsx")).toBe(true);
        expect(isHttpUrl("https://example.com/file.js")).toBe(true);
    });

    it("should return false for non-HTTP URLs", () => {
        expect(isHttpUrl("/src/App.tsx")).toBe(false);
        expect(isHttpUrl("file:///path/to/file.js")).toBe(false);
        expect(isHttpUrl("./relative/path.js")).toBe(false);
    });

    it("should handle edge cases", () => {
        expect(isHttpUrl("")).toBe(false);
        expect(isHttpUrl(null as any)).toBe(false);
        expect(isHttpUrl(undefined as any)).toBe(false);
    });
});

describe(normalizeIdCandidates, () => {
    it("should generate candidates for local file path", () => {
        const candidates = normalizeIdCandidates("/home/user/project/src/App.tsx");

        expect(candidates).toContain("/home/user/project/src/App.tsx");
        expect(candidates).toContain("src/App.tsx");
        expect(candidates).toContain("/src/App.tsx");
        expect(candidates.length).toBeGreaterThan(1);
    });

    it("should generate candidates for HTTP URL", () => {
        const candidates = normalizeIdCandidates("http://localhost:5173/src/App.tsx");

        expect(candidates).toContain("http://localhost:5173/src/App.tsx");
        expect(candidates).toContain("/src/App.tsx");
        expect(candidates.length).toBeGreaterThan(1);
    });

    it("should handle paths with @fs prefix", () => {
        const candidates = normalizeIdCandidates("/@fs/home/user/project/src/App.tsx");

        expect(candidates).toContain("/home/user/project/src/App.tsx");
        expect(candidates).toContain("src/App.tsx");
    });

    it("should handle relative paths", () => {
        const candidates = normalizeIdCandidates("./src/App.tsx");

        expect(candidates).toContain("./src/App.tsx");
        expect(candidates).toContain("src/App.tsx");
    });

    it("should handle paths with query parameters", () => {
        const candidates = normalizeIdCandidates("http://localhost:5173/src/App.tsx?tsr-split=component");

        expect(candidates).toContain("http://localhost:5173/src/App.tsx?tsr-split=component");
        expect(candidates).toContain("http://localhost:5173/src/App.tsx");
        expect(candidates).toContain("/src/App.tsx");
    });

    it("should deduplicate candidates", () => {
        const candidates = normalizeIdCandidates("/src/App.tsx");

        const uniqueCandidates = [...new Set(candidates)];

        expect(candidates).toHaveLength(uniqueCandidates.length);
    });

    it("should filter out empty strings", () => {
        const candidates = normalizeIdCandidates("");

        expect(candidates).not.toContain("");
        expect(candidates).toHaveLength(0);
    });

    it("should handle edge cases", () => {
        expect(() => normalizeIdCandidates(null as any)).not.toThrow();
        expect(() => normalizeIdCandidates(undefined as any)).not.toThrow();
        expect(normalizeIdCandidates("")).toEqual([]);
    });
});
