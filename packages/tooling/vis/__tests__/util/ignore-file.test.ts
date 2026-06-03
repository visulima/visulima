import { describe, expect, it } from "vitest";

import { buildIgnorePatterns, IGNORE_FILENAMES, mergeIgnore } from "../../src/util/ignore-file";

describe("ignore-file", () => {
    it("maps every target to a filename", () => {
        expect.assertions(1);

        expect(IGNORE_FILENAMES).toStrictEqual({
            docker: ".dockerignore",
            npm: ".npmignore",
            slug: ".slugignore",
            vercel: ".vercelignore",
        });
    });

    it("builds a de-duplicated pattern list", () => {
        expect.assertions(2);

        const patterns = buildIgnorePatterns("docker");

        expect(new Set(patterns).size).toBe(patterns.length);
        expect(patterns).toContain("node_modules");
    });

    it("omits node_modules for the npm target (npm excludes it already)", () => {
        expect.assertions(2);

        expect(buildIgnorePatterns("npm")).not.toContain("node_modules");
        expect(buildIgnorePatterns("vercel")).toContain("node_modules");
    });

    it("adds every pattern when the file is new", () => {
        expect.assertions(2);

        const patterns = buildIgnorePatterns("docker");
        const { added, content } = mergeIgnore("", patterns);

        expect(added).toStrictEqual(patterns);
        expect(content).toContain("# Added by vis ignore");
    });

    it("skips patterns already present (no duplicate entries)", () => {
        expect.assertions(3);

        const existing = "node_modules\n.git\n# my comment\ncustom-thing\n";
        const { added, content } = mergeIgnore(existing, ["node_modules", ".git", "*.log"]);

        expect(added).toStrictEqual(["*.log"]);
        // existing entries are not repeated
        expect(content.match(/^node_modules$/gmu)).toHaveLength(1);
        expect(content).toContain("*.log");
    });

    it("returns existing content untouched when nothing new", () => {
        expect.assertions(2);

        const existing = "node_modules\n.git\n";
        const { added, content } = mergeIgnore(existing, ["node_modules", ".git"]);

        expect(added).toStrictEqual([]);
        expect(content).toBe(existing);
    });
});
