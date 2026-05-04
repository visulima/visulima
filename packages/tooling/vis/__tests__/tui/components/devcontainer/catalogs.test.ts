import { describe, expect, it } from "vitest";

import { EXTENSION_CATALOG } from "../../../../src/tui/components/devcontainer/catalogs/extensions";
import { FEATURE_CATALOG } from "../../../../src/tui/components/devcontainer/catalogs/features";
import { filterExtensions, filterFeatures } from "../../../../src/tui/components/devcontainer/catalogs/filters";
import { getSuggestedMounts, PM_MOUNTS } from "../../../../src/tui/components/devcontainer/catalogs/mount-suggestions";
import { TEMPLATES } from "../../../../src/tui/components/devcontainer/catalogs/templates";

describe("features catalog", () => {
    it("should have no duplicate IDs", () => {
        expect.assertions(1);

        const ids = FEATURE_CATALOG.map((f) => f.id);
        const unique = new Set(ids);

        expect(unique.size).toBe(ids.length);
    });

    it("should have valid categories for all entries", () => {
        expect.assertions(1);

        const validCategories = new Set(["cloud", "database", "language", "other", "tool"]);
        const invalid = FEATURE_CATALOG.filter((f) => !validCategories.has(f.category));

        expect(invalid).toHaveLength(0);
    });

    it("should have non-empty name and description for all entries", () => {
        expect.assertions(1);

        const empty = FEATURE_CATALOG.filter((f) => !f.name || !f.description);

        expect(empty).toHaveLength(0);
    });

    it("should have ghcr.io IDs for all entries", () => {
        expect.assertions(1);

        const invalid = FEATURE_CATALOG.filter((f) => !f.id.startsWith("ghcr.io/"));

        expect(invalid).toHaveLength(0);
    });

    it("should include all major language runtimes", () => {
        expect.assertions(1);

        const names = FEATURE_CATALOG.map((f) => f.name);

        expect(names).toEqual(expect.arrayContaining(["Node.js", "Python", "Go", "Rust", "Java"]));
    });
});

describe("extensions catalog", () => {
    it("should have no duplicate IDs", () => {
        expect.assertions(1);

        const ids = EXTENSION_CATALOG.map((e) => e.id);
        const unique = new Set(ids);

        expect(unique.size).toBe(ids.length);
    });

    it("should have publisher.name format for all IDs", () => {
        expect.assertions(1);

        const invalid = EXTENSION_CATALOG.filter((e) => !/^[\w-]+\.[\w-]+$/u.test(e.id));

        expect(invalid).toHaveLength(0);
    });

    it("should have valid categories for all entries", () => {
        expect.assertions(1);

        const validCategories = new Set(["debugging", "formatting", "git", "language", "linting", "other", "testing"]);
        const invalid = EXTENSION_CATALOG.filter((e) => !validCategories.has(e.category));

        expect(invalid).toHaveLength(0);
    });
});

describe("templates", () => {
    it("should have no duplicate IDs", () => {
        expect.assertions(1);

        const ids = TEMPLATES.map((t) => t.id);
        const unique = new Set(ids);

        expect(unique.size).toBe(ids.length);
    });

    it("should have all expected templates", () => {
        expect.assertions(1);

        const ids = TEMPLATES.map((t) => t.id);

        expect(ids).toEqual(
            expect.arrayContaining([
                "node",
                "node-pnpm",
                "node-postgres",
                "node-dind",
                "fullstack",
                "python",
                "go",
                "rust",
                "java",
                "devops",
                "minimal",
                "custom",
            ]),
        );
    });

    it("should have image or dockerComposeFile for every template", () => {
        expect.assertions(1);

        const invalid = TEMPLATES.filter((t) => !t.config.image && !t.config.dockerComposeFile);

        expect(invalid).toHaveLength(0);
    });

    it("should have non-empty name and description", () => {
        expect.assertions(1);

        const empty = TEMPLATES.filter((t) => !t.name || !t.description);

        expect(empty).toHaveLength(0);
    });
});

describe(filterFeatures, () => {
    it("should return all features with empty search", () => {
        expect.assertions(1);

        expect(filterFeatures("")).toEqual(FEATURE_CATALOG);
    });

    it("should filter by name", () => {
        expect.assertions(2);

        const results = filterFeatures("Node");

        expect(results.length).toBeGreaterThan(0);
        expect(
            results.every((f) => f.name.toLowerCase().includes("node") || f.id.toLowerCase().includes("node") || f.description.toLowerCase().includes("node")),
        ).toBe(true);
    });

    it("should filter by ID substring", () => {
        expect.assertions(1);

        const results = filterFeatures("docker-in-docker");

        expect(results.length).toBeGreaterThan(0);
    });

    it("should be case-insensitive", () => {
        expect.assertions(1);

        const upper = filterFeatures("PYTHON");
        const lower = filterFeatures("python");

        expect(upper).toEqual(lower);
    });

    it("should return empty for non-matching query", () => {
        expect.assertions(1);

        expect(filterFeatures("zzzznonexistent")).toHaveLength(0);
    });
});

describe(filterExtensions, () => {
    it("should return all extensions with empty search", () => {
        expect.assertions(1);

        expect(filterExtensions("")).toEqual(EXTENSION_CATALOG);
    });

    it("should filter by name", () => {
        expect.assertions(1);

        const results = filterExtensions("ESLint");

        expect(results.length).toBeGreaterThan(0);
    });

    it("should filter by extension ID", () => {
        expect.assertions(1);

        const results = filterExtensions("dbaeumer");

        expect(results.length).toBeGreaterThan(0);
    });
});

describe("mount suggestions", () => {
    it("should suggest pnpm mounts for pnpm package manager", () => {
        expect.assertions(2);

        const mounts = getSuggestedMounts("pnpm", {}, []);

        expect(mounts.length).toBeGreaterThan(0);
        expect(mounts).toEqual(PM_MOUNTS.pnpm);
    });

    it("should suggest npm mounts for npm package manager", () => {
        expect.assertions(1);

        const mounts = getSuggestedMounts("npm", {}, []);

        expect(mounts).toEqual(PM_MOUNTS.npm);
    });

    it("should return empty when no PM detected and no features", () => {
        expect.assertions(1);

        const mounts = getSuggestedMounts(null, {}, []);

        expect(mounts).toHaveLength(0);
    });

    it("should not suggest mounts that already exist", () => {
        expect.assertions(1);

        const existingMounts = PM_MOUNTS.pnpm.map((m) => {
            return { ...m };
        });
        const mounts = getSuggestedMounts("pnpm", {}, existingMounts);

        expect(mounts).toHaveLength(0);
    });

    it("should suggest docker socket mount for docker-outside-of-docker feature", () => {
        expect.assertions(2);

        const features = { "ghcr.io/devcontainers/features/docker-outside-of-docker:1": {} };
        const mounts = getSuggestedMounts(null, features, []);

        expect(mounts.length).toBeGreaterThan(0);
        expect(mounts.some((m) => m.target === "/var/run/docker.sock")).toBe(true);
    });
});
